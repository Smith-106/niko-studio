#!/bin/bash
# Kimi CLI startup script that uses the embedded standalone Python
# This script is used by AI Now to run kimi-cli with ACP protocol

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# =============================================================================
# Config Setup: Copy from kimi_config to .kimi (Tauri can't create dot-dirs)
# =============================================================================
# When HOME is set to our isolated directory, kimi-cli expects config at:
#   $HOME/.kimi/config.toml (v0.66+) or $HOME/.kimi/config.json (legacy)
# But Tauri can't create dot-prefixed directories, so we write to:
#   $HOME/kimi_config/config.json
# This script copies the config to the correct location before running kimi.
#
# IMPORTANT: kimi-cli v0.66+ migrates config.json to config.toml on first load.
# If an old config.toml exists, kimi-cli ignores our fresh config.json.
# We delete config.toml to force re-migration with our current settings.

if [[ -n "$HOME" && -f "$HOME/kimi_config/config.json" ]]; then
    mkdir -p "$HOME/.kimi" 2>/dev/null
    # Delete old config.toml to force kimi-cli to use our fresh config.json
    rm -f "$HOME/.kimi/config.toml" 2>/dev/null
    cp "$HOME/kimi_config/config.json" "$HOME/.kimi/config.json" 2>/dev/null
fi

# Prefer the embedded standalone Python over venv (venvs are not relocatable)
EMBEDDED_PYTHON="$SCRIPT_DIR/python/bin/python3"
VENV_PYTHON="$SCRIPT_DIR/app/.venv/bin/python3"

# Default to embedded Python; fallback to venv Python only if embedded is missing
if [[ -x "$EMBEDDED_PYTHON" ]]; then
    PYTHON_STANDALONE="$EMBEDDED_PYTHON"
else
    PYTHON_STANDALONE="$VENV_PYTHON"
fi

# Check for Windows executable name
if [[ "$(uname)" == "MINGW"* ]] || [[ "$(uname)" == "CYGWIN"* ]]; then
    PYTHON_STANDALONE="$SCRIPT_DIR/python/python.exe"
fi

# Set library path for shared libraries and PYTHONHOME for embedded runtime
if [[ -d "$SCRIPT_DIR/python/lib" ]]; then
    if [[ "$(uname)" == "Darwin" ]]; then
        export DYLD_LIBRARY_PATH="$SCRIPT_DIR/python/lib:${DYLD_LIBRARY_PATH}"
    elif [[ "$(uname)" == "Linux" ]]; then
        export LD_LIBRARY_PATH="$SCRIPT_DIR/python/lib:${LD_LIBRARY_PATH}"
    fi
    # Ensure the embedded Python can find its stdlib (fixes 'encodings' error)
    export PYTHONHOME="$SCRIPT_DIR/python"
fi

# Check if Python executable exists
if [ ! -x "$PYTHON_STANDALONE" ]; then
    echo "Error: Python executable not found at: $PYTHON_STANDALONE" >&2
    exit 1
fi

# Export SCRIPT_DIR so Python code can find the custom agent file
export KIMI_SCRIPT_DIR="$SCRIPT_DIR"

# Run kimi CLI directly by importing and calling the cli function
# This bypasses the need for console_scripts entry point which isn't created
# when installing from requirements.txt
# The cli function is at kimi_cli.cli:cli (from pyproject.toml [project.scripts])
#
# NOTE: We use -c instead of heredoc because ACP mode needs stdin for protocol communication
# The arguments are passed after -c and become sys.argv[1:]
#
# WARNING: The Python code below is inside a shell double-quoted string!
# - DO NOT use backticks (`) in comments - shell interprets them as command substitution
# - Use single quotes ('example') instead of backticks for inline code references
# - This caused "command not found" errors when backticks were used
exec "$PYTHON_STANDALONE" -c "
import sys
import os
import json

# =============================================================================
# CRITICAL: Clean up Python environment for subprocesses
#
# 1. Unset PYTHONHOME: We set it in bash so the embedded Python finds its
#    stdlib (fixes 'encodings' error). But subprocesses (shell commands run
#    by kimi-cli) would inherit it and break if they use a different Python.
#
# 2. Clean DYLD_LIBRARY_PATH/LD_LIBRARY_PATH: Remove our embedded Python lib
#    path so it doesn't interfere with other processes.
#
# 3. Set up PATH: Put all plugin venvs FIRST so 'python' command uses them.
#    This allows the agent to just call 'python' without full paths.
#    Priority order:
#      a) All plugin venvs under $AINOW_PLUGIN_DIR/*/venv/bin/
#      b) Embedded standalone Python (fallback)
#      c) Original PATH (system commands)
#
# 4. Set PYTHONNOUSERSITE=1: Prevents picking up user site-packages which
#    can break determinism. (Same as lib.rs does for the backend.)
# =============================================================================

# Unset PYTHONHOME - no longer needed after Python starts
if 'PYTHONHOME' in os.environ:
    del os.environ['PYTHONHOME']

# Clean DYLD_LIBRARY_PATH (macOS)
if 'DYLD_LIBRARY_PATH' in os.environ:
    dyld = os.environ['DYLD_LIBRARY_PATH']
    script_dir = os.environ.get('KIMI_SCRIPT_DIR', '')
    if script_dir:
        our_lib = os.path.join(script_dir, 'python', 'lib')
        paths = [p for p in dyld.split(':') if p and p != our_lib]
        if paths:
            os.environ['DYLD_LIBRARY_PATH'] = ':'.join(paths)
        else:
            del os.environ['DYLD_LIBRARY_PATH']

# Clean LD_LIBRARY_PATH (Linux)
if 'LD_LIBRARY_PATH' in os.environ:
    ld = os.environ['LD_LIBRARY_PATH']
    script_dir = os.environ.get('KIMI_SCRIPT_DIR', '')
    if script_dir:
        our_lib = os.path.join(script_dir, 'python', 'lib')
        paths = [p for p in ld.split(':') if p and p != our_lib]
        if paths:
            os.environ['LD_LIBRARY_PATH'] = ':'.join(paths)
        else:
            del os.environ['LD_LIBRARY_PATH']

# =============================================================================
# Set up PATH with shared plugin venv at highest priority
# All plugins share a single venv at $AINOW_PLUGIN_DIR/venv
# This allows agent to call 'python' and get the right interpreter
# =============================================================================
def setup_plugin_python_path():
    import pathlib

    plugin_dir = os.environ.get('AINOW_PLUGIN_DIR', '')
    script_dir = os.environ.get('KIMI_SCRIPT_DIR', '')
    original_path = os.environ.get('PATH', '')

    # Check for shared venv at $AINOW_PLUGIN_DIR/venv
    shared_venv_bin = None
    if plugin_dir and os.path.isdir(plugin_dir):
        plugin_path = pathlib.Path(plugin_dir)
        # macOS/Linux: $AINOW_PLUGIN_DIR/venv/bin
        venv_bin = plugin_path / 'venv' / 'bin'
        if venv_bin.exists():
            shared_venv_bin = str(venv_bin)
        else:
            # Windows: $AINOW_PLUGIN_DIR/venv/Scripts
            venv_scripts = plugin_path / 'venv' / 'Scripts'
            if venv_scripts.exists():
                shared_venv_bin = str(venv_scripts)

    # Add embedded Python as fallback (after shared venv)
    embedded_bin = ''
    if script_dir:
        embedded_bin = os.path.join(script_dir, 'python', 'bin')
        if not os.path.exists(embedded_bin):
            # Windows
            embedded_bin = os.path.join(script_dir, 'python')

    # Build new PATH: shared venv -> embedded python -> original
    new_path_parts = []
    if shared_venv_bin:
        new_path_parts.append(shared_venv_bin)
    if embedded_bin and os.path.exists(embedded_bin):
        new_path_parts.append(embedded_bin)
    if original_path:
        new_path_parts.append(original_path)

    new_path = os.pathsep.join(new_path_parts)
    os.environ['PATH'] = new_path

    if shared_venv_bin:
        print(f'[AI Now] Using shared plugin venv: {shared_venv_bin}', file=sys.stderr)

setup_plugin_python_path()

# Prevent user site-packages from being picked up
os.environ['PYTHONNOUSERSITE'] = '1'

# =============================================================================
# GitHub Copilot (AI Now) - Pure client-mode token injection (NO PROXY)
#
# kimi-cli doesn't have native Copilot support. We configure it as openai_legacy
# and inject a Copilot *API token* + required IDE headers at startup.
#
# IMPORTANT:
# - We reuse the same token cache directory as the main app backend:
#   {AppData}/github_copilot (sibling of {AppData}/kimi_home).
# - We NEVER start blocking device-flow polling here (would hang ACP startup).
#   Instead, users authenticate Copilot in the Remote LLM Settings UI, which
#   performs the device flow and writes the access-token cache.
#
# After authentication exists (access-token file), we refresh the Copilot API
# token using LiteLLM's Authenticator (non-blocking) and write it into kimi's
# config provider api_key + base_url.
# =============================================================================
def _bootstrap_github_copilot_token_if_needed():
    try:
        import sys
        import json as _json
        import time as _time

        home = os.environ.get('HOME', '')
        if not home:
            return

        # Try config.json first, then config.toml (kimi-cli v0.66+ uses TOML)
        kimi_cfg_path = os.path.join(home, '.kimi', 'config.json')
        kimi_cfg_toml = os.path.join(home, '.kimi', 'config.toml')

        cfg = None
        try:
            if os.path.exists(kimi_cfg_path):
                with open(kimi_cfg_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f) or {}
            elif os.path.exists(kimi_cfg_toml):
                import tomlkit
                with open(kimi_cfg_toml, 'r', encoding='utf-8') as f:
                    cfg = tomlkit.load(f) or {}
        except Exception:
            return

        if not cfg:
            return

        default_model = cfg.get('default_model') or ''
        models = cfg.get('models') or {}
        providers = cfg.get('providers') or {}
        if not default_model or default_model not in models:
            return

        model_entry = models.get(default_model) or {}
        provider_name = model_entry.get('provider') or ''
        provider = providers.get(provider_name) or {}

        # Only bootstrap when the selected provider is our Copilot provider entry.
        if 'github_copilot' not in str(provider_name).lower():
            return
        if provider.get('type') != 'openai_legacy':
            return

        # Use shared token storage under AppData (sibling of kimi_home).
        # Example:
        #   HOME = .../Application Support/co.nowledge.mem.desktop/kimi_home
        #   token_dir = .../Application Support/co.nowledge.mem.desktop/github_copilot
        parent = os.path.dirname(home.rstrip(os.sep)) or home
        token_dir = os.path.join(parent, 'github_copilot')
        os.makedirs(token_dir, exist_ok=True)
        os.environ['GITHUB_COPILOT_TOKEN_DIR'] = token_dir
        os.environ.setdefault('GITHUB_COPILOT_ACCESS_TOKEN_FILE', 'access-token')
        os.environ.setdefault('GITHUB_COPILOT_API_KEY_FILE', 'api-key.json')

        # Pre-create api-key.json (LiteLLM reads endpoints.api from this file)
        try:
            api_key_path = os.path.join(token_dir, os.environ['GITHUB_COPILOT_API_KEY_FILE'])
            if not os.path.exists(api_key_path):
                with open(api_key_path, 'w', encoding='utf-8') as f:
                    _json.dump({'endpoints': {'api': 'https://api.githubcopilot.com'}}, f)
        except Exception as e:
            print(f'[AI Now] GitHub Copilot: failed to write api-key.json: {e}', file=sys.stderr)

        # Require prior authentication (done via Settings UI) to avoid blocking device-flow here.
        access_token_path = os.path.join(token_dir, os.environ['GITHUB_COPILOT_ACCESS_TOKEN_FILE'])
        access_token = ''
        try:
            if os.path.exists(access_token_path):
                with open(access_token_path, 'r', encoding='utf-8') as f:
                    access_token = (f.read() or '').strip()
        except Exception:
            access_token = ''

        if not access_token:
            print(
                '[AI Now] GitHub Copilot: not authenticated. '
                'Open Settings → Remote LLM → GitHub Copilot and click Authenticate, then retry AI Now.',
                file=sys.stderr
            )
            return

        # Refresh Copilot API token using LiteLLM's authenticator (non-blocking when access-token exists).
        try:
            from litellm.llms.github_copilot.authenticator import Authenticator  # type: ignore
            auth = Authenticator()
            _ = auth.get_api_key()  # writes token + endpoints into api-key.json
        except Exception as e:
            print(f'[AI Now] GitHub Copilot: failed to refresh API token: {e}', file=sys.stderr)
            return

        # Read API token + endpoint from api-key.json
        api_key_path = os.path.join(token_dir, os.environ['GITHUB_COPILOT_API_KEY_FILE'])
        try:
            with open(api_key_path, 'r', encoding='utf-8') as f:
                api_key_info = _json.load(f) or {}
        except Exception as e:
            print(f'[AI Now] GitHub Copilot: failed to read api-key.json: {e}', file=sys.stderr)
            return

        api_token = api_key_info.get('token') if isinstance(api_key_info, dict) else None
        endpoints = api_key_info.get('endpoints') if isinstance(api_key_info, dict) else None
        api_base = None
        if isinstance(endpoints, dict):
            api_base = endpoints.get('api')
        if not isinstance(api_token, str) or not api_token.strip():
            print('[AI Now] GitHub Copilot: missing API token in api-key.json (will fail).', file=sys.stderr)
            return

        # Some Copilot hosts do not support /v1; OpenAI client will call /chat/completions.
        provider['base_url'] = str(api_base or provider.get('base_url') or 'https://api.individual.githubcopilot.com')
        provider['api_key'] = api_token.strip()
        provider.setdefault('custom_headers', {})
        provider['custom_headers'].update({
            'Editor-Version': 'vscode/1.85.1',
            'Editor-Plugin-Version': 'copilot/1.155.0',
            'Copilot-Integration-Id': 'vscode-chat',
            'User-Agent': 'GithubCopilot/1.155.0',
            'Accept': 'application/json',
        })
        providers[provider_name] = provider
        cfg['providers'] = providers

        try:
            with open(kimi_cfg_path, 'w', encoding='utf-8') as f:
                json.dump(cfg, f, indent=2)
            print('[AI Now] GitHub Copilot: injected API token into kimi config.', file=sys.stderr)
        except Exception:
            pass
    except Exception:
        # Never crash agent startup due to auth bootstrap
        return

_bootstrap_github_copilot_token_if_needed()

# =============================================================================
# OpenAI Codex Token Bootstrap
#
# Similar to GitHub Copilot, OpenAI Codex uses OAuth device flow authentication.
# This function reads the access token from the Codex token cache and injects
# it into the kimi-cli config at startup.
# =============================================================================
def _bootstrap_openai_codex_token_if_needed():
    try:
        import sys
        import json as _json
        import time as _time

        home = os.environ.get('HOME', '')
        if not home:
            return

        # Try config.json first, then config.toml (kimi-cli v0.66+ uses TOML)
        kimi_cfg_path = os.path.join(home, '.kimi', 'config.json')
        kimi_cfg_toml = os.path.join(home, '.kimi', 'config.toml')

        cfg = None
        try:
            if os.path.exists(kimi_cfg_path):
                with open(kimi_cfg_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f) or {}
            elif os.path.exists(kimi_cfg_toml):
                import tomlkit
                with open(kimi_cfg_toml, 'r', encoding='utf-8') as f:
                    cfg = tomlkit.load(f) or {}
        except Exception:
            return

        if not cfg:
            return

        default_model = cfg.get('default_model') or ''
        models = cfg.get('models') or {}
        providers = cfg.get('providers') or {}
        if not default_model or default_model not in models:
            return

        model_entry = models.get(default_model) or {}
        provider_name = model_entry.get('provider') or ''
        provider = providers.get(provider_name) or {}

        # Only bootstrap when the selected provider is our OpenAI Codex provider entry.
        if 'openai_codex' not in str(provider_name).lower():
            return
        if provider.get('type') not in ('openai_responses', 'openai_legacy'):
            return

        # Use shared token storage under AppData (sibling of kimi_home).
        parent = os.path.dirname(home.rstrip(os.sep)) or home
        token_dir = os.path.join(parent, 'openai_codex')
        os.makedirs(token_dir, exist_ok=True)
        os.environ['OPENAI_CODEX_TOKEN_DIR'] = token_dir
        os.environ.setdefault('OPENAI_CODEX_ACCESS_TOKEN_FILE', 'access-token.json')

        # Read access token from cache
        access_token_path = os.path.join(token_dir, os.environ['OPENAI_CODEX_ACCESS_TOKEN_FILE'])
        token_data = {}
        try:
            if os.path.exists(access_token_path):
                with open(access_token_path, 'r', encoding='utf-8') as f:
                    token_data = _json.load(f) or {}
        except Exception:
            token_data = {}

        access_token = token_data.get('access_token', '').strip() if isinstance(token_data, dict) else ''
        if not access_token:
            print(
                '[AI Now] ChatGPT Subscription: not authenticated. '
                'Open Settings → Remote LLM → ChatGPT Subscription and click Authenticate, then retry AI Now.',
                file=sys.stderr
            )
            return

        # Check if token is expired and try to refresh if needed
        expires_at = token_data.get('expires_at', 0)
        refresh_token = token_data.get('refresh_token', '').strip()
        if expires_at and _time.time() > expires_at - 60 and refresh_token:
            # Token expired or about to expire, try to refresh
            try:
                import httpx
                import base64 as _b64

                def _jwt_claims(tok):
                    try:
                        parts = tok.split('.')
                        if len(parts) < 2:
                            return {}
                        p = parts[1] + '=' * (4 - len(parts[1]) % 4)
                        return _json.loads(_b64.urlsafe_b64decode(p))
                    except Exception:
                        return {}

                resp = httpx.post(
                    'https://auth.openai.com/oauth/token',
                    headers={
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json',
                    },
                    data={
                        'grant_type': 'refresh_token',
                        'refresh_token': refresh_token,
                        'client_id': 'app_EMoamEEZ73f0CkXaXp7hrann',
                        'scope': 'openid profile email',
                    },
                    timeout=30.0,
                )
                resp.raise_for_status()
                new_data = resp.json()
                if new_data.get('access_token'):
                    _new_at = new_data['access_token']
                    _new_id = new_data.get('id_token', '')
                    # Prefer JWT exp claim for expires_at (matches LiteLLM)
                    _exp_at = _jwt_claims(_new_at).get('exp')
                    if _exp_at is None:
                        _exp_in = new_data.get('expires_in') or 3600
                        _exp_at = int(_time.time() + _exp_in)
                    else:
                        _exp_at = int(_exp_at)
                    _acct = None
                    if _new_id:
                        try:
                            _acct = _jwt_claims(_new_id).get('https://api.openai.com/auth', {}).get('chatgpt_account_id')
                        except Exception:
                            pass
                    token_data = {
                        'access_token': _new_at,
                        'refresh_token': new_data.get('refresh_token', refresh_token),
                        'id_token': _new_id,
                        'expires_at': _exp_at,
                        'account_id': _acct,
                        'api_base': 'https://chatgpt.com/backend-api/codex',
                    }
                    with open(access_token_path, 'w', encoding='utf-8') as f:
                        _json.dump(token_data, f)
                    access_token = token_data['access_token']
                    print('[AI Now] ChatGPT Subscription: refreshed access token.', file=sys.stderr)
            except Exception as e:
                print(f'[AI Now] ChatGPT Subscription: failed to refresh token: {e}', file=sys.stderr)
                # Continue with existing token even if refresh failed

        # Inject token into kimi config
        provider['base_url'] = 'https://chatgpt.com/backend-api/codex'
        provider['api_key'] = access_token
        provider.setdefault('custom_headers', {})
        provider['custom_headers'].update({
            'User-Agent': 'Codex-CLI/1.0 Nowledge/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        })
        providers[provider_name] = provider
        cfg['providers'] = providers

        try:
            with open(kimi_cfg_path, 'w', encoding='utf-8') as f:
                json.dump(cfg, f, indent=2)
            print('[AI Now] ChatGPT Subscription: injected API token into kimi config.', file=sys.stderr)
        except Exception:
            pass
    except Exception:
        # Never crash agent startup due to auth bootstrap
        return

_bootstrap_openai_codex_token_if_needed()

# =============================================================================
# Monkey Patch: ChatGPT Backend API Compatibility
#
# The ChatGPT backend (chatgpt.com/backend-api/codex/responses) has specific
# requirements that differ from the standard OpenAI Responses API:
# - "instructions" field is REQUIRED (system prompt)
# - "store" MUST be false (rejects store=true)
# - "previous_response_id" must be stripped (store=false means server doesn't
#   persist responses, so referencing them in follow-up requests causes 404)
# - Rejects: max_tokens, max_output_tokens, max_completion_tokens, metadata
#
# Kosong's openai_responses provider calls the API directly without these
# adjustments, so we monkey-patch httpx to intercept and fix requests.
# =============================================================================
def _patch_chatgpt_backend_requests():
    try:
        import httpx
        import json as _json

        _CHATGPT_MARKER = 'chatgpt.com/backend-api/codex'
        _STRIP_FIELDS = ('max_tokens', 'max_output_tokens', 'max_completion_tokens', 'metadata', 'previous_response_id')

        def _patch_request(request):
            '''Modify request body for ChatGPT backend compatibility.'''
            if _CHATGPT_MARKER not in str(request.url):
                return request
            if request.method.upper() != 'POST':
                return request
            if not request.content:
                return request
            try:
                body = _json.loads(request.content)
            except Exception:
                return request

            modified = False

            # Inject instructions if missing (ChatGPT backend requires it)
            if not body.get('instructions'):
                body['instructions'] = 'You are a helpful assistant.'
                modified = True

            # Force store=false (ChatGPT backend rejects store=true)
            if body.get('store') is not False:
                body['store'] = False
                modified = True

            # Force stream=true (ChatGPT backend rejects stream=false)
            if body.get('stream') is not True:
                body['stream'] = True
                modified = True

            # Strip unsupported fields
            for field in _STRIP_FIELDS:
                if field in body:
                    del body[field]
                    modified = True

            if not modified:
                return request

            new_content = _json.dumps(body).encode('utf-8')
            # Rebuild request with modified body (drop stale content-length)
            headers = {k: v for k, v in request.headers.items()
                       if k.lower() != 'content-length'}
            return httpx.Request(
                method=request.method,
                url=request.url,
                headers=headers,
                content=new_content,
            )

        # Patch synchronous Client.send
        _original_sync_send = httpx.Client.send

        def _patched_sync_send(self, request, *args, **kwargs):
            request = _patch_request(request)
            return _original_sync_send(self, request, *args, **kwargs)

        httpx.Client.send = _patched_sync_send

        # Patch asynchronous AsyncClient.send
        _original_async_send = httpx.AsyncClient.send

        async def _patched_async_send(self, request, *args, **kwargs):
            request = _patch_request(request)
            return await _original_async_send(self, request, *args, **kwargs)

        httpx.AsyncClient.send = _patched_async_send

        print('[AI Now] Applied ChatGPT backend compatibility patch for httpx', file=sys.stderr, flush=True)
    except Exception as e:
        print(f'[AI Now] Failed to apply ChatGPT backend patch: {e}', file=sys.stderr, flush=True)

_patch_chatgpt_backend_requests()

# =============================================================================
# NOTE: MCP Session-Id stripping patch REMOVED in v1.3 update
# kimi-cli v0.88 removed mcp-session-id header injection upstream (PR #681)
# =============================================================================

sys.argv[0] = 'kimi'
from kimi_cli.app import enable_logging
enable_logging(debug=True)
# NOTE: After enable_logging, stderr is redirected to loguru logger

# =============================================================================
# Patch: MCP tool schema sanitization for LLM compatibility
#
# Many LLM providers have strict requirements for function/tool schemas:
# - Google Gemini: rejects 'examples' / 'example' fields
# - OpenAI-compatible (Groq, etc.): may reject '$schema' field or complex schemas
#
# This patch strips problematic fields from MCP tool schemas to improve compatibility.
# =============================================================================
def _patch_mcp_tool_schema_sanitization():
    try:
        import sys
        import copy

        # v0.66: MCPTool moved from kimi_cli.tools.mcp to kimi_cli.soul.toolset
        from kimi_cli.soul import toolset as toolset_mod

        original_init = toolset_mod.MCPTool.__init__

        def _sanitize_schema(obj):
            '''Recursively sanitize JSON schema for LLM function calling compatibility.'''
            if isinstance(obj, dict):
                # Move examples into description (best-effort) then drop
                if 'examples' in obj:
                    ex = obj.get('examples')
                    if ex and isinstance(obj.get('description'), str):
                        try:
                            ex_text = ', '.join([str(x) for x in ex][:3]) if isinstance(ex, list) else str(ex)
                            obj['description'] = obj['description'].rstrip() + f\"\\n\\nExamples: {ex_text}\"
                        except Exception:
                            pass
                    obj.pop('examples', None)
                # Remove problematic fields that some LLMs don't support
                obj.pop('example', None)
                obj.pop('$schema', None)  # Not needed for function calling, causes issues with some LLMs
                return {k: _sanitize_schema(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_sanitize_schema(x) for x in obj]
            return obj

        # Get original signature to determine if server_name param exists
        # v0.66 (a34d310+): server_name is first positional param
        # earlier versions: no server_name param
        import inspect
        sig = inspect.signature(original_init)
        has_server_name = 'server_name' in sig.parameters

        def patched_init(self, *args, runtime, **kwargs):
            # Handle both old (mcp_tool, client) and new (server_name, mcp_tool, client) signatures
            if has_server_name:
                server_name, mcp_tool, client = args[0], args[1], args[2]
            else:
                server_name, mcp_tool, client = None, args[0], args[1]

            try:
                schema = getattr(mcp_tool, 'inputSchema', None)
                if isinstance(schema, dict):
                    cleaned = _sanitize_schema(copy.deepcopy(schema))
                    # Rebuild mcp.Tool instance with sanitized schema (pydantic model_copy)
                    try:
                        mcp_tool = mcp_tool.model_copy(update={'inputSchema': cleaned})
                    except Exception:
                        setattr(mcp_tool, 'inputSchema', cleaned)
            except Exception as e:
                print(f'[AI Now] Warning: failed to sanitize MCP tool schema: {e}', file=sys.stderr)

            if has_server_name:
                return original_init(self, server_name, mcp_tool, client, runtime=runtime, **kwargs)
            else:
                return original_init(self, mcp_tool, client, runtime=runtime, **kwargs)

        toolset_mod.MCPTool.__init__ = patched_init
        print('[AI Now] Applied MCP tool schema sanitization', file=sys.stderr)
    except Exception as e:
        print(f'[AI Now] Failed to apply MCP schema patch: {e}', file=sys.stderr)
        return

_patch_mcp_tool_schema_sanitization()

# =============================================================================
# Monkey Patch: Restore deprecated --acp mode functionality
#
# kimi-cli v0.74+ deprecated --acp mode in favor of 'kimi acp' subcommand.
# The ACPServerSingleSession class was replaced with stubs that reject all
# requests with a deprecation error.
#
# However, 'kimi acp' does not support:
# - Custom agent files (--agent-file)
# - CLI-specified MCP configs (--mcp-config)
# - Our skill prompt injection
#
# This patch replaces run_acp() to use a working implementation that accepts
# the pre-configured KimiCLI instance, allowing --acp mode to continue working.
# =============================================================================
def _patch_restore_acp_mode():
    try:
        from typing import Any
        import acp
        from kimi_cli import app as app_module
        from kimi_cli.acp.session import ACPSession
        from kimi_cli.acp.types import MCPServer
        from kimi_cli.constant import NAME, VERSION
        from kimi_cli.utils.logging import logger

        class WorkingACPServerSingleSession:
            '''ACP server that works with pre-configured KimiCLI instance.

            This replaces the deprecated ACPServerSingleSession to allow --acp
            mode to continue working with custom agent files and MCP configs.

            v0.76 compatible: Uses KimiCLI instead of Soul directly, and the
            new ACPSession constructor that takes KimiCLI.
            '''
            def __init__(self, cli_instance):
                '''
                Args:
                    cli_instance: The pre-configured KimiCLI instance
                '''
                self._cli = cli_instance
                self._client_capabilities: acp.schema.ClientCapabilities | None = None
                self._conn: acp.Client | None = None
                self._session: ACPSession | None = None

            def on_connect(self, conn: acp.Client) -> None:
                logger.info('ACP client connected')
                self._conn = conn

            async def initialize(
                self,
                protocol_version: int,
                client_capabilities: acp.schema.ClientCapabilities | None = None,
                client_info: acp.schema.Implementation | None = None,
                **kwargs: Any,
            ) -> acp.InitializeResponse:
                logger.info(
                    'ACP server initialized with protocol version: {version}, '
                    'client capabilities: {capabilities}, client info: {info}',
                    version=protocol_version,
                    capabilities=client_capabilities,
                    info=client_info,
                )
                self._client_capabilities = client_capabilities
                return acp.InitializeResponse(
                    protocol_version=protocol_version,
                    agent_capabilities=acp.schema.AgentCapabilities(
                        load_session=False,
                        prompt_capabilities=acp.schema.PromptCapabilities(
                            embedded_context=False, image=True, audio=False
                        ),
                        mcp_capabilities=acp.schema.McpCapabilities(http=True, sse=False),
                        session_capabilities=acp.schema.SessionCapabilities(),
                    ),
                    auth_methods=[],
                    agent_info=acp.schema.Implementation(name=NAME, version=VERSION),
                )

            async def new_session(
                self, cwd: str, mcp_servers: list[MCPServer], **kwargs: Any
            ) -> acp.NewSessionResponse:
                logger.info('Creating new session for working directory: {cwd}', cwd=cwd)
                assert self._conn is not None, 'ACP client not connected'
                assert self._client_capabilities is not None, 'ACP connection not initialized'

                import uuid
                session_id = str(uuid.uuid4())
                # v0.76 ACPSession takes (id, cli, acp_conn, kaos)
                self._session = ACPSession(session_id, self._cli, self._conn)
                return acp.NewSessionResponse(session_id=session_id)

            async def load_session(
                self, cwd: str, mcp_servers: list[MCPServer], session_id: str, **kwargs: Any
            ) -> None:
                logger.warning('load_session not supported in single-session mode')
                raise acp.RequestError.invalid_params({'error': 'load_session not supported'})

            async def list_sessions(
                self, cursor: str | None = None, cwd: str | None = None, **kwargs: Any
            ) -> acp.schema.ListSessionsResponse:
                return acp.schema.ListSessionsResponse(sessions=[], next_cursor=None)

            async def set_session_mode(
                self, mode_id: str, session_id: str, **kwargs: Any
            ) -> acp.SetSessionModeResponse | None:
                return None

            async def set_session_model(
                self, model_id: str, session_id: str, **kwargs: Any
            ) -> acp.SetSessionModelResponse | None:
                return None

            async def authenticate(self, method_id: str, **kwargs: Any) -> acp.AuthenticateResponse | None:
                return None

            async def prompt(
                self, prompt: list, session_id: str, **kwargs: Any
            ) -> acp.PromptResponse:
                logger.info('Received prompt request for session: {id}', id=session_id)
                if self._session is None:
                    raise acp.RequestError.invalid_params({'session_id': 'No session created'})
                return await self._session.prompt(prompt)

            async def cancel(self, session_id: str, **kwargs: Any) -> None:
                logger.info('Received cancel request for session: {id}', id=session_id)
                if self._session is not None:
                    await self._session.cancel()

            async def ext_method(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
                raise NotImplementedError

            async def ext_notification(self, method: str, params: dict[str, Any]) -> None:
                pass

        # Patch run_acp to use our working implementation instead of deprecated one
        original_run_acp = app_module.KimiCLI.run_acp

        async def patched_run_acp(self) -> None:
            '''Patched run_acp that uses working ACP server implementation.'''
            logger.info('Starting ACP server (AI Now patched) on stdio')
            async with self._env():
                server = WorkingACPServerSingleSession(self)
                await acp.run_agent(server)

        app_module.KimiCLI.run_acp = patched_run_acp
        print('[AI Now] Patched run_acp() for --acp mode compatibility', file=sys.stderr)

    except Exception as e:
        print(f'[AI Now] Failed to patch run_acp: {e}', file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)

_patch_restore_acp_mode()

# =============================================================================
# Monkey Patch: Forward ALL tool results via ACP (not just SetTodoList)
# This enables MCP tool results to be displayed in the AI Now UI
#
# Patched for: kimi-cli v1.12.0
# Target: kimi_cli.acp.session.ACPSession
#
# v1.12.0 changes from v1.3:
# - Added TurnEnd event (v1.6)
# - Added _terminal_tool_call_ids context var
# - Added kaos context handling (set_current_kaos/reset_current_kaos)
# - LLMNotSet now raises auth_required() instead of internal_error()
# - Updated finally block token reset order
# - SubagentEvent still ignored (case SubagentEvent(): pass)
# - We still need patches for: subagent auto-approve, subagent events forwarding
# =============================================================================
def apply_acp_patches():
    import sys
    from kimi_cli.acp import session as acp_session_module
    from kimi_cli.acp.convert import tool_result_to_acp_content

    # ==========================================================================
    # Patch 1: Auto-approve subagent tool calls
    # When a subagent (spawned by Task tool) requests approval for its tools,
    # the tool_call_id won't be found in _turn_state.tool_calls because only
    # parent agent's tool calls are tracked there.
    #
    # Original behavior: Rejects approval if tool_call_id not found
    # Patched behavior: Auto-approves if tool_call_id not found (subagent)
    # ==========================================================================
    original_handle_approval_request = acp_session_module.ACPSession._handle_approval_request

    async def patched_handle_approval_request(self, request):
        '''Patched version that auto-approves subagent tool calls.

        CRITICAL: Must handle all edge cases gracefully to prevent
        approval requests from hanging the agent indefinitely.
        '''
        try:
            if self._turn_state is None or not self._id:
                print(f'[AI Now] Rejecting approval (no _turn_state or _id)', file=sys.stderr)
                request.resolve('reject')
                return

            state = self._turn_state.tool_calls.get(request.tool_call_id, None)
            if state is None:
                # Tool call not found - this is likely a subagent's tool call
                # Auto-approve since user already approved the parent Task
                print(f'[AI Now] Auto-approving subagent tool: {request.action} - {request.description}', file=sys.stderr)
                request.resolve('approve')
                return

            # Otherwise, use original handler for parent agent tools
            await original_handle_approval_request(self, request)
        except Exception as e:
            print(f'[AI Now] Error in _handle_approval_request: {e}', file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            # On error, reject to prevent hanging
            try:
                request.resolve('reject')
            except:
                pass

    acp_session_module.ACPSession._handle_approval_request = patched_handle_approval_request

    # ==========================================================================
    # Patch 2: Forward subagent events to UI with parent tracking
    # SubagentEvent wraps tool calls/results from subagents. In v0.68, the
    # prompt() method STILL ignores SubagentEvent (case SubagentEvent(): pass).
    # We patch to forward them with parentToolCallId so UI can nest them.
    # ==========================================================================

    # Track mapping from kimi internal tool_call_id to ACP tool_call_id
    _tool_call_id_mapping = {}

    async def _send_subagent_tool_call(session, tool_call, parent_task_id):
        '''Send a subagent tool call with parentToolCallId for nesting in UI.'''
        import acp
        import uuid

        try:
            if session._turn_state is None or not session._id or not session._conn:
                print(f'[AI Now] Warning: Cannot send subagent tool call - no session', file=sys.stderr)
                return

            acp_tool_call_id = str(uuid.uuid4())
            _tool_call_id_mapping[tool_call.id] = acp_tool_call_id

            parent_acp_id = None
            parent_state = session._turn_state.tool_calls.get(parent_task_id)
            if parent_state:
                parent_acp_id = parent_state.acp_tool_call_id
                print(f'[AI Now] Subagent tool {tool_call.function.name} -> parent Task {parent_acp_id}', file=sys.stderr)

            update = acp.schema.ToolCallStart(
                session_update='tool_call',
                tool_call_id=acp_tool_call_id,
                title=f'{tool_call.function.name}: {tool_call.function.arguments or "{}"}',
                status='in_progress',
            )

            await session._conn.session_update(session._id, update)
        except Exception as e:
            print(f'[AI Now] Error in _send_subagent_tool_call: {e}', file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)

    async def _send_subagent_tool_result(session, result, parent_task_id):
        '''Send a subagent tool result with proper ID mapping.'''
        import acp

        try:
            if not session._id or not session._conn:
                return

            tool_ret = result.return_value
            is_error = tool_ret.is_error

            acp_tool_call_id = _tool_call_id_mapping.pop(result.tool_call_id, None)
            if not acp_tool_call_id:
                print(f'[AI Now] Warning: No ACP ID for subagent tool result {result.tool_call_id}', file=sys.stderr)
                return

            update = acp.schema.ToolCallProgress(
                session_update='tool_call_update',
                tool_call_id=acp_tool_call_id,
                status='failed' if is_error else 'completed',
            )

            contents = tool_result_to_acp_content(tool_ret)
            if contents:
                update.content = contents

            await session._conn.session_update(session._id, update)
        except Exception as e:
            print(f'[AI Now] Error in _send_subagent_tool_result: {e}', file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)

    # Patch the prompt() method to handle SubagentEvent
    original_prompt = acp_session_module.ACPSession.prompt

    async def patched_prompt(self, prompt_blocks):
        '''Patched prompt that forwards subagent events.

        Updated for v1.12.0: adds TurnEnd, kaos context, terminal tool calls tracking.
        '''
        import acp
        from kaos import Kaos, reset_current_kaos, set_current_kaos
        from kosong.message import ContentPart, TextPart, ThinkPart, ToolCall, ToolCallPart
        from kosong.tooling import ToolResult
        from kimi_cli.acp.convert import acp_blocks_to_content_parts
        from kimi_cli.acp.types import ACPContentBlock
        from kimi_cli.soul import LLMNotSet, LLMNotSupported, MaxStepsReached, RunCancelled
        from kosong.chat_provider import ChatProviderError
        # v1.12.0: wire.types - added TurnEnd (v1.6)
        from kimi_cli.wire.types import (
            SubagentEvent, ApprovalRequest, ApprovalResponse, ToolCallRequest,
            TurnBegin, TurnEnd, StepBegin, StepInterrupted, CompactionBegin, CompactionEnd, StatusUpdate
        )
        from kimi_cli.utils.logging import logger

        user_input = acp_blocks_to_content_parts(prompt_blocks)
        self._turn_state = acp_session_module._TurnState()
        token = acp_session_module._current_turn_id.set(self._turn_state.id)
        # v1.12.0: kaos context and terminal tool calls tracking
        kaos_token = set_current_kaos(self._kaos) if self._kaos is not None else None
        terminal_tool_calls_token = acp_session_module._terminal_tool_call_ids.set(set())
        try:
            async for msg in self._cli.run(user_input, self._turn_state.cancel_event):
                match msg:
                    case TurnBegin() | TurnEnd() | StepBegin() | CompactionBegin() | CompactionEnd() | StatusUpdate():
                        pass
                    case StepInterrupted():
                        break
                    case ThinkPart(think=think):
                        await self._send_thinking(think)
                    case TextPart(text=text):
                        await self._send_text(text)
                    case ContentPart():
                        logger.warning('Unsupported content part: {part}', part=msg)
                        await self._send_text(f'[{msg.__class__.__name__}]')
                    case ToolCall():
                        await self._send_tool_call(msg)
                    case ToolCallPart():
                        await self._send_tool_call_part(msg)
                    case ToolResult():
                        await self._send_tool_result(msg)
                    case SubagentEvent(event=event, task_tool_call_id=task_id):
                        # PATCH: Forward subagent events WITH parent Task ID
                        print(f'[AI Now] SubagentEvent: {type(event).__name__} (parent: {task_id})', file=sys.stderr)
                        match event:
                            case ToolCall():
                                await _send_subagent_tool_call(self, event, task_id)
                            case ToolCallPart():
                                await self._send_tool_call_part(event)
                            case ToolResult():
                                await _send_subagent_tool_result(self, event, task_id)
                            case TextPart(text=text):
                                await self._send_text(text)
                            case ThinkPart(think=think):
                                await self._send_thinking(think)
                            case _:
                                pass
                    case ApprovalResponse():
                        pass
                    case ApprovalRequest():
                        await self._handle_approval_request(msg)
                    case ToolCallRequest():
                        logger.warning('Unexpected ToolCallRequest in ACP session: {msg}', msg=msg)
                    case _:
                        logger.warning('Unsupported wire message: {msg}', msg=msg)
        except LLMNotSet as e:
            # v1.12.0: Changed to auth_required() instead of internal_error()
            logger.exception('LLM not set:')
            raise acp.RequestError.auth_required() from e
        except LLMNotSupported as e:
            logger.exception('LLM not supported:')
            raise acp.RequestError.internal_error({'error': str(e)}) from e
        except ChatProviderError as e:
            logger.exception('LLM provider error:')
            raise acp.RequestError.internal_error({'error': str(e)}) from e
        except MaxStepsReached as e:
            logger.warning('Max steps reached: {n_steps}', n_steps=e.n_steps)
            return acp.PromptResponse(stop_reason='max_turn_requests')
        except RunCancelled:
            logger.info('Prompt cancelled by user')
            return acp.PromptResponse(stop_reason='cancelled')
        except Exception as e:
            logger.exception('Unexpected error during prompt:')
            raise acp.RequestError.internal_error({'error': str(e)}) from e
        finally:
            self._turn_state = None
            # v1.12.0: Updated token reset order - kaos first, then terminal, then turn_id
            if kaos_token is not None:
                reset_current_kaos(kaos_token)
            acp_session_module._terminal_tool_call_ids.reset(terminal_tool_calls_token)
            acp_session_module._current_turn_id.reset(token)
            # Clean up orphaned subagent tool call mappings from this prompt
            _tool_call_id_mapping.clear()
        return acp.PromptResponse(stop_reason='end_turn')

    acp_session_module.ACPSession.prompt = patched_prompt
    print('[AI Now] Applied ACP session patches (subagent auto-approve, event forwarding)', file=sys.stderr)

apply_acp_patches()

# =============================================================================
# Monkey Patch: Universal OpenAI-compatible provider with maximum compatibility
#
# Problem: Many "OpenAI-compatible" APIs don't fully implement the spec:
# - Some reject array content format (MiMo, older vLLM, local models)
# - Some reject null content (LM Studio, others)
# - Some require reasoning_content field (DeepSeek)
#
# Solution: Use the MOST COMPATIBLE format for ALL openai_legacy providers:
# - Content is always a string (never array, never null)
# - Empty string "" instead of null for assistant messages with only tool_calls
# - DeepSeek-specific: reasoning_content field on all assistant messages
#
# This approach works with OpenAI (which accepts both formats) and with
# strict providers that only accept string content.
#
# References:
# - OpenAI spec: content can be string OR array of {type, text} objects
# - https://github.com/lemonade-sdk/lemonade/issues/629
# - https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/261
# =============================================================================
def apply_llm_patches():
    import kimi_cli.llm as llm_module
    original_create_llm = llm_module.create_llm

    def patched_create_llm(provider, model, *, thinking=None, session_id=None, oauth=None):
        if provider.type == 'openai_legacy':
            from kosong.contrib.chat_provider.openai_legacy import OpenAILegacy
            from kosong.message import Message, ThinkPart, ContentPart, TextPart
            from typing import cast
            from openai.types.chat import ChatCompletionMessageParam
            from loguru import logger

            extra_kwargs = {}
            extra_capabilities = set()

            # Pass custom headers if configured
            if provider.custom_headers:
                extra_kwargs['default_headers'] = provider.custom_headers

            # Detect DeepSeek for reasoning_content requirement
            base_url_lower = (provider.base_url or '').lower()
            is_deepseek = 'deepseek' in base_url_lower
            if is_deepseek:
                extra_kwargs['reasoning_key'] = 'reasoning_content'
                extra_capabilities.add('thinking')
                logger.info('[AI Now] DeepSeek detected, enabling reasoning_content')

            # =================================================================
            # UniversalOpenAILegacy: Maximum compatibility provider
            #
            # Always converts content to string format because:
            # 1. OpenAI accepts both string and array - string works everywhere
            # 2. Many providers reject array format with cryptic errors
            # 3. Empty string is safer than null for tool-only messages
            # =================================================================
            class UniversalOpenAILegacy(OpenAILegacy):
                _is_deepseek: bool = False

                def _convert_message(self, message: Message) -> ChatCompletionMessageParam:
                    message = message.model_copy(deep=True)

                    # Separate thinking content from regular content
                    reasoning_content = ''
                    text_parts = []
                    for part in message.content:
                        if isinstance(part, ThinkPart):
                            reasoning_content += part.think
                        elif isinstance(part, TextPart):
                            text_parts.append(part.text)
                        # Skip other content types (images, etc.) for text-only APIs
                        # They wouldn't work anyway on most OpenAI-compatible endpoints

                    # Build message with string content (never array, never null)
                    text_content = ''.join(text_parts)

                    # For serialization, temporarily set content to extracted text
                    message.content = [TextPart(text=text_content)] if text_content else []
                    dumped_message = message.model_dump(exclude_none=True)

                    # CRITICAL: Force content to be string, even if empty
                    # Many providers reject null or array content
                    dumped_message['content'] = text_content

                    # DeepSeek requires reasoning_content on ALL assistant messages
                    if self._is_deepseek and message.role == 'assistant':
                        dumped_message['reasoning_content'] = reasoning_content
                    elif reasoning_content and self._reasoning_key:
                        # For other providers with reasoning support
                        dumped_message[self._reasoning_key] = reasoning_content

                    return cast(ChatCompletionMessageParam, dumped_message)

            logger.info('[AI Now] Using UniversalOpenAILegacy provider (string content, max compat)')

            chat_provider = UniversalOpenAILegacy(
                model=model.model,
                base_url=provider.base_url,
                api_key=provider.api_key.get_secret_value(),
                **extra_kwargs,
            )
            chat_provider._is_deepseek = is_deepseek

            # v0.76: _derive_capabilities renamed to derive_model_capabilities, takes only model
            from kimi_cli.llm import LLM, derive_model_capabilities
            capabilities = derive_model_capabilities(model)
            capabilities.update(extra_capabilities)

            return LLM(
                chat_provider=chat_provider,
                max_context_size=model.max_context_size,
                capabilities=capabilities,
                model_config=model,
                provider_config=provider,
            )

        # Fall back to original for non-openai_legacy providers
        return original_create_llm(provider, model, thinking=thinking, session_id=session_id, oauth=oauth)

    llm_module.create_llm = patched_create_llm
    # Also patch in app module since it imports create_llm directly
    import kimi_cli.app as app_module
    app_module.create_llm = patched_create_llm
    print('[AI Now] Applied LLM patches (UniversalOpenAILegacy provider)', file=sys.stderr)

apply_llm_patches()

from kimi_cli.cli import cli
import os

# Base MCP config with nowledge-mem server (always included)
mcp_llm_provider_type = ''
try:
    # Derive active provider type from kimi config so MCP server can tailor schemas.
    # Note: At this point, kimi-cli has migrated config.json to config.toml
    home = os.environ.get('HOME', '')
    cfg_json = os.path.join(home, '.kimi', 'config.json') if home else ''
    cfg_toml = os.path.join(home, '.kimi', 'config.toml') if home else ''
    _cfg = None
    if cfg_toml and os.path.exists(cfg_toml):
        import tomlkit
        with open(cfg_toml, 'r', encoding='utf-8') as f:
            _cfg = tomlkit.load(f) or {}
    elif cfg_json and os.path.exists(cfg_json):
        with open(cfg_json, 'r', encoding='utf-8') as f:
            _cfg = json.load(f) or {}
    if _cfg:
        dm = _cfg.get('default_model') or ''
        models = _cfg.get('models') or {}
        providers = _cfg.get('providers') or {}
        if dm and dm in models:
            prov_name = (models.get(dm) or {}).get('provider') or ''
            prov = providers.get(prov_name) or {}
            mcp_llm_provider_type = str(prov.get('type') or '').strip()
except Exception:
    mcp_llm_provider_type = ''

mcp_config_dict = {
    \"mcpServers\": {
        \"nowledge-mem\": {
            \"url\": \"http://localhost:14242/mcp\",
            \"type\": \"streamableHttp\",
            \"headers\": {
                \"Accept\": \"application/json, text/event-stream\",
                \"APP\": \"AI-NOW\",
                # Allow MCP server to strip unsupported schema fields for strict providers (e.g. google_genai)
                \"X-AINOW-LLM-PROVIDER\": mcp_llm_provider_type
            }
        }
    }
}

# Merge additional HTTP MCP servers from KIMI_MCP_SERVERS_JSON env var
# This is set by acp-client.ts for enabled HTTP plugins (like Notion, Didi, etc.)
kimi_mcp_servers_json = os.environ.get('KIMI_MCP_SERVERS_JSON', '')
from loguru import logger as ainow_logger
if kimi_mcp_servers_json:
    try:
        additional_servers = json.loads(kimi_mcp_servers_json)
        mcp_config_dict['mcpServers'].update(additional_servers)
        ainow_logger.info(f'[AI Now] Merged {len(additional_servers)} additional MCP servers: {list(additional_servers.keys())}')
    except json.JSONDecodeError as e:
        ainow_logger.error(f'[AI Now] Failed to parse KIMI_MCP_SERVERS_JSON: {e}')
else:
    ainow_logger.info('[AI Now] No additional HTTP MCP servers to merge (KIMI_MCP_SERVERS_JSON not set)')

mcp_config_json = json.dumps(mcp_config_dict)

# Get the script directory for locating the custom agent file
# This matches SCRIPT_DIR from the bash wrapper
import pathlib
import tempfile
import shutil
script_dir = pathlib.Path(__file__).parent if '__file__' in dir() else pathlib.Path.cwd()
# When running via -c, we need to get SCRIPT_DIR from environment or construct it
script_dir_str = os.environ.get('KIMI_SCRIPT_DIR', '')
if script_dir_str:
    agent_file = os.path.join(script_dir_str, 'ai-now-agent', 'agent.yaml')
else:
    agent_file = None

# =============================================================================
# Skill Plugin Injection
# Read enabled skill prompts and inject into agent's ROLE_ADDITIONAL
# =============================================================================
def load_skill_prompts():
    '''Load skill prompts from the skill_prompts.md file if it exists.

    Tries these locations in order:
    1. KIMI_SKILL_PROMPTS_PATH env var (explicit path from AI Now)
    2. HOME/skill_prompts.md (fallback if HOME is set to kimi_home)
    '''
    # Try explicit path first (set by acp-client.ts)
    explicit_path = os.environ.get('KIMI_SKILL_PROMPTS_PATH', '')
    if explicit_path and os.path.exists(explicit_path):
        try:
            with open(explicit_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    print(f'[AI Now] Loaded skill prompts from explicit path ({len(content)} chars)', file=sys.stderr)
                return content
        except Exception as e:
            print(f'[AI Now] Failed to read skill prompts from {explicit_path}: {e}', file=sys.stderr)

    # Fallback to HOME-based lookup
    home = os.environ.get('HOME', '')
    if home:
        skill_prompts_file = os.path.join(home, 'skill_prompts.md')
        if os.path.exists(skill_prompts_file):
            try:
                with open(skill_prompts_file, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        print(f'[AI Now] Loaded skill prompts from HOME ({len(content)} chars)', file=sys.stderr)
                    return content
            except Exception as e:
                print(f'[AI Now] Failed to read skill prompts: {e}', file=sys.stderr)

    return ''

def create_agent_with_skills(agent_dir, skill_prompts):
    '''Create a temporary agent directory with skill prompts injected into ROLE_ADDITIONAL'''
    import yaml

    # Create temp directory for modified agent
    temp_dir = tempfile.mkdtemp(prefix='ai-now-agent-')

    # Copy all agent files to temp
    for item in os.listdir(agent_dir):
        src = os.path.join(agent_dir, item)
        dst = os.path.join(temp_dir, item)
        if os.path.isfile(src):
            shutil.copy2(src, dst)

    # Modify agent.yaml to inject skill prompts into ROLE_ADDITIONAL
    agent_yaml_path = os.path.join(temp_dir, 'agent.yaml')
    with open(agent_yaml_path, 'r', encoding='utf-8') as f:
        agent_config = yaml.safe_load(f)

    # Inject skill prompts into system_prompt_args.ROLE_ADDITIONAL
    if 'agent' in agent_config:
        if 'system_prompt_args' not in agent_config['agent']:
            agent_config['agent']['system_prompt_args'] = {}
        agent_config['agent']['system_prompt_args']['ROLE_ADDITIONAL'] = skill_prompts

    # Write modified config
    with open(agent_yaml_path, 'w', encoding='utf-8') as f:
        yaml.dump(agent_config, f, default_flow_style=False, allow_unicode=True)

    print(f'[AI Now] Created agent with skills: {temp_dir}', file=sys.stderr)
    return os.path.join(temp_dir, 'agent.yaml')

# Load skill prompts and potentially create modified agent
skill_prompts = load_skill_prompts()
if agent_file and os.path.exists(agent_file) and skill_prompts:
    agent_dir = os.path.dirname(agent_file)
    agent_file = create_agent_with_skills(agent_dir, skill_prompts)

# Build args list - note: --acp should only be added here, NOT in the bash args
# The --work-dir is passed via command line but --acp is added here to ensure proper ordering
args_to_add = ['--mcp-config', mcp_config_json, '--acp']

# Add custom agent file if available (AI Now persona instead of default coding agent)
if agent_file and os.path.exists(agent_file):
    args_to_add = ['--agent-file', agent_file] + args_to_add
    print(f'[AI Now] Using custom agent: {agent_file}', file=sys.stderr)

# Check for KIMI_CONTINUE env var to resume previous session
# We use env var instead of passing --continue via command line because
# kimi-cli's --continue needs to come before other flags and we need control over ordering
if os.environ.get('KIMI_CONTINUE') == '1':
    # Insert --continue at the beginning so it comes right after kimi command
    args_to_add = ['--continue'] + args_to_add

sys.argv.extend(args_to_add)
try:
    cli()
except SystemExit:
    raise
except Exception as e:
    print(f'[AI Now] cli() raised exception: {type(e).__name__}: {e}', file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    raise
" "$@"
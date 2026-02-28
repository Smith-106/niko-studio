# AI Now Agent Architecture

This document describes the AI Now agent system, which uses kimi-cli as its core runtime with custom patches for ACP-based UI integration.

## Overview

AI Now is a desktop AI assistant built on kimi-cli. The agent runs as an ACP (Agent Client Protocol) server, communicating with the Tauri frontend via stdio.

## Agent Files

| File | Purpose |
|------|---------|
| `agent.yaml` | Main agent configuration (model, tools, prompts) |
| `sub.yaml` | Subagent configuration for Task tool |
| `system.md` | System prompt with AI Now persona |

## Start Scripts

The agent is launched via shell scripts that:
1. Set up the Python environment
2. Apply monkey patches for compatibility
3. Inject skill prompts
4. Start the ACP server

**Files:**
- `scripts/start_kimi.sh` - macOS/Linux
- `scripts/start_kimi.ps1` - Windows

## Key Patches

Our start scripts apply several patches to kimi-cli (current: v1.12.0):

### Required Patches
1. **ChatGPT Backend Requests** - Modify httpx requests for ChatGPT API compatibility
2. **ACP Mode Restoration** - Enables deprecated `--acp` mode with custom agent support
3. **Subagent Auto-Approve** - Auto-approves subagent tool calls
4. **ACP Tool Result Forwarding** - Forwards MCP tool results to AI Now UI
5. **MCP Tool Schema Sanitization** - Strips incompatible fields from MCP tools

### Removed Patches (fixed upstream)
- **MCP Session-Id Stripping** - Removed in v1.3 (fixed upstream in v0.88, PR #681)

For detailed patch documentation and version update procedures, see [kimi-cli Bump Guide](../../docs/design/kimi-cli-bump-guide.md).

## Skill System

Skills extend the agent's capabilities. When enabled, their system prompts are injected into the agent.

**Skill files:**
- `src/services/skills/definitions/` - Skill definitions (TypeScript)
- `~/Library/Application Support/co.nowledge.mem.desktop/kimi_home/skill_prompts.md` - Injected prompts

## MCP Integration

The agent connects to MCP servers for external tools:
- `nowledge-mem` - Memory search, web search, Obsidian integration

MCP config is passed via `--mcp-config` CLI argument.

## Version Updates

When updating kimi-cli (current: v1.12.0):
1. Pull latest kimi-cli tag to `3pp/kimi-cli/`
2. Review release notes for breaking changes
3. Follow the [kimi-cli Bump Guide](../../docs/design/kimi-cli-bump-guide.md)
4. Update patches in start scripts
5. Test all patches (startup, chat, MCP tools, subagents)
6. Update version comments in start scripts

## Design Documents

- [kimi-cli Bump Guide](../../docs/design/kimi-cli-bump-guide.md) - Version update procedures
- [Presentation Skills Enhancement](../../docs/design/PRESENTATION_SKILLS_ENHANCEMENT_RESEARCH.md) - Infographic skills research
- [Deep Research Tool](../../docs/design/deep-research-tool.md) - Research mode design

## Troubleshooting

### Agent Won't Start
Check stderr for patch messages. Look for:
```
[AI Now] Patched run_acp() for --acp mode compatibility
[AI Now] Applied MCP tool schema sanitization
```

### Shell Commands Fail
Verify PATH setup includes plugin venv. Check terminal tool output in ACP client.

### Subagent Tasks Hang
Check subagent auto-approve patch is active. Verify SubagentEvent forwarding.

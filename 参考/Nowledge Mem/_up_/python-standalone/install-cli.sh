#!/bin/bash
#
# install-cli.sh - Install nmem CLI symlink
# Called by deb/rpm post-install scripts
#

set -e

# Installation paths to check (in order of preference)
INSTALL_PATHS=(
    "/usr/lib/Nowledge Mem/_up_/python-standalone"
    "/usr/lib/Nowledge Mem/python-standalone"
    "/usr/lib/nowledge-mem/_up_/python-standalone"
    "/usr/lib/nowledge-mem/python-standalone"
    "/opt/nowledge-mem/python-standalone"
)

# Target for symlink
SYMLINK_TARGET="/usr/local/bin/nmem"

# Find the installation path
INSTALL_PATH=""
for path in "${INSTALL_PATHS[@]}"; do
    if [ -d "$path" ]; then
        INSTALL_PATH="$path"
        break
    fi
done

if [ -z "$INSTALL_PATH" ]; then
    echo "Warning: Could not find Nowledge Mem installation path"
    echo "The nmem CLI will not be available in PATH"
    exit 0
fi

# Create the nmem wrapper script
WRAPPER_SCRIPT="$INSTALL_PATH/nmem"

cat > "$WRAPPER_SCRIPT" << 'WRAPPER_EOF'
#!/bin/bash
# nmem - Nowledge Mem CLI
# Uses bundled Python from the Nowledge Mem installation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Find Python
PYTHON=""
for py in "$SCRIPT_DIR/python/bin/python3" "$SCRIPT_DIR/../python/bin/python3"; do
    if [ -x "$py" ]; then
        PYTHON="$py"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo "Error: Could not find bundled Python" >&2
    exit 1
fi

# Find ncli module
NCLI=""
for ncli in "$SCRIPT_DIR/app/src/nowledge_graph_server/ncli.py" "$SCRIPT_DIR/../app/src/nowledge_graph_server/ncli.py"; do
    if [ -f "$ncli" ]; then
        NCLI="$ncli"
        break
    fi
done

if [ -z "$NCLI" ]; then
    echo "Error: Could not find nmem CLI module" >&2
    exit 1
fi

# Set PYTHONPATH
APP_SRC=$(dirname "$(dirname "$NCLI")")
export PYTHONPATH="$APP_SRC:$PYTHONPATH"

# Run the CLI
exec "$PYTHON" "$NCLI" "$@"
WRAPPER_EOF

chmod +x "$WRAPPER_SCRIPT"

# Create symlink in /usr/local/bin
if [ -d "/usr/local/bin" ]; then
    # Remove existing symlink if it exists
    [ -L "$SYMLINK_TARGET" ] && rm -f "$SYMLINK_TARGET"
    
    # Create new symlink
    ln -sf "$WRAPPER_SCRIPT" "$SYMLINK_TARGET"
    echo "Installed nmem CLI to $SYMLINK_TARGET"
else
    echo "Warning: /usr/local/bin does not exist, nmem CLI not added to PATH"
fi

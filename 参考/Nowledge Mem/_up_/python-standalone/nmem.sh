#!/bin/bash
#
# nmem - Nowledge Mem CLI wrapper
# This script uses the bundled Python from the Tauri app installation
#

set -e

# Resolve the actual script location (following symlinks)
resolve_script_path() {
    local source="${BASH_SOURCE[0]}"
    while [ -L "$source" ]; do
        local dir="$(cd -P "$(dirname "$source")" && pwd)"
        source="$(readlink "$source")"
        [[ $source != /* ]] && source="$dir/$source"
    done
    cd -P "$(dirname "$source")" && pwd
}

SCRIPT_DIR="$(resolve_script_path)"

# Find Python executable - check multiple locations
find_python() {
    local possible_paths=(
        # Relative to script (when script is in python-standalone) - HIGHEST PRIORITY
        "$SCRIPT_DIR/python/bin/python3"
        # macOS bundle
        "/Applications/Nowledge Mem.app/Contents/Resources/_up_/python-standalone/python/bin/python3"
        "/Applications/Nowledge Mem.app/Contents/Resources/python-standalone/python/bin/python3"
        # Installed with the app (deb/rpm)
        "/usr/lib/Nowledge Mem/_up_/python-standalone/python/bin/python3"
        "/usr/lib/Nowledge Mem/python-standalone/python/bin/python3"
        "/usr/lib/nowledge-mem/_up_/python-standalone/python/bin/python3"
        "/usr/lib/nowledge-mem/python-standalone/python/bin/python3"
        "/opt/nowledge-mem/python-standalone/python/bin/python3"
        # Development paths
        "$SCRIPT_DIR/../python-standalone/python/bin/python3"
        "$SCRIPT_DIR/../../python-standalone/python/bin/python3"
    )
    
    for path in "${possible_paths[@]}"; do
        if [ -x "$path" ]; then
            echo "$path"
            return 0
        fi
    done
    
    return 1
}

# Find the ncli module
find_ncli_module() {
    local possible_paths=(
        # Relative to script (when script is in python-standalone) - HIGHEST PRIORITY
        "$SCRIPT_DIR/app/src/nowledge_graph_server/ncli.py"
        # macOS bundle
        "/Applications/Nowledge Mem.app/Contents/Resources/_up_/python-standalone/app/src/nowledge_graph_server/ncli.py"
        "/Applications/Nowledge Mem.app/Contents/Resources/python-standalone/app/src/nowledge_graph_server/ncli.py"
        # Installed with the app (deb/rpm)
        "/usr/lib/Nowledge Mem/_up_/python-standalone/app/src/nowledge_graph_server/ncli.py"
        "/usr/lib/Nowledge Mem/python-standalone/app/src/nowledge_graph_server/ncli.py"
        "/usr/lib/nowledge-mem/_up_/python-standalone/app/src/nowledge_graph_server/ncli.py"
        "/usr/lib/nowledge-mem/python-standalone/app/src/nowledge_graph_server/ncli.py"
        "/opt/nowledge-mem/python-standalone/app/src/nowledge_graph_server/ncli.py"
        # Development paths
        "$SCRIPT_DIR/../python-standalone/app/src/nowledge_graph_server/ncli.py"
        "$SCRIPT_DIR/../nowledge-graph-py/src/nowledge_graph_server/ncli.py"
        "$SCRIPT_DIR/../../nowledge-graph-py/src/nowledge_graph_server/ncli.py"
    )
    
    for path in "${possible_paths[@]}"; do
        if [ -f "$path" ]; then
            echo "$path"
            return 0
        fi
    done
    
    return 1
}

# Find Python
PYTHON=$(find_python)
if [ -z "$PYTHON" ]; then
    echo "Error: Could not find Python executable" >&2
    echo "Make sure Nowledge Mem is installed correctly." >&2
    echo "Script location: $SCRIPT_DIR" >&2
    exit 1
fi

# Find ncli module
NCLI_MODULE=$(find_ncli_module)
if [ -z "$NCLI_MODULE" ]; then
    echo "Error: Could not find nmem CLI module" >&2
    echo "Make sure Nowledge Mem is installed correctly." >&2
    echo "Script location: $SCRIPT_DIR" >&2
    exit 1
fi

# Set PYTHONPATH for the app modules
NCLI_DIR=$(dirname "$NCLI_MODULE")
APP_SRC_DIR=$(dirname "$NCLI_DIR")
export PYTHONPATH="$APP_SRC_DIR:$PYTHONPATH"

# Set library path for bundled Python (macOS)
PYTHON_DIR=$(dirname "$(dirname "$PYTHON")")
export DYLD_LIBRARY_PATH="$PYTHON_DIR/lib:$DYLD_LIBRARY_PATH"

# Run the CLI
exec "$PYTHON" "$NCLI_MODULE" "$@"

#!/bin/bash
#
# uninstall-cli.sh - Remove nmem CLI symlink
# Called by deb/rpm post-remove scripts
#

set -e

SYMLINK_TARGET="/usr/local/bin/nmem"

# Remove symlink if it exists and points to our installation
if [ -L "$SYMLINK_TARGET" ]; then
    TARGET=$(readlink "$SYMLINK_TARGET")
    if [[ "$TARGET" == *"nowledge"* ]] || [[ "$TARGET" == *"Nowledge"* ]]; then
        rm -f "$SYMLINK_TARGET"
        echo "Removed nmem CLI from $SYMLINK_TARGET"
    fi
fi

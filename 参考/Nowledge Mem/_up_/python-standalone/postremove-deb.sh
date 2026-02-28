#!/bin/bash
#
# postremove-deb.sh - Post-removal script for Linux packages (deb, rpm, Arch)
#
# This script is used by:
# - Debian/Ubuntu: .deb packages
# - Fedora/RHEL: .rpm packages
# - Arch Linux: via debtap conversion
#
# It performs:
# 1. Removes the extracted python-standalone directory (created by postinstall)
# 2. Removes the nmem CLI symlink
# 3. Updates icon cache and desktop database
#
# Note: .desktop file is managed by the package manager, not removed here.
#
# =============================================================================
# DEBTAP COMPATIBILITY NOTES (for Arch Linux)
# =============================================================================
# See postinstall-deb.sh for detailed notes. Key points:
# - DO NOT use 'exit 0' - use conditional blocks instead
# - DO NOT use heredocs - use multiple 'echo' statements
# - DO NOT leave empty if-then-fi blocks
# Test changes by running: bash -n postremove-deb.sh
# =============================================================================
#

# Update icon cache (GTK requirement)
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor 2>/dev/null || true
fi

# =============================================================================
# Step 1: Remove extracted python-standalone directory
# =============================================================================
# The python-standalone directory was extracted by postinstall from python-runtime.tar.zst
# and is not tracked by the package manager, so we need to clean it up here.
#
# Arguments passed by dpkg (Debian/Ubuntu):
#   - "upgrade <new-version>" - upgrading to new version (DON'T remove)
#   - "remove" - package being removed
#   - "purge" - package being purged
#   - "failed-upgrade <old-version>" - upgrade failed
#   - "abort-install" - install aborted
#   - "abort-upgrade <old-version>" - upgrade aborted
#   - "disappear <overwriter> <version>" - package disappeared
#
# Arguments on Arch Linux (via debtap):
#   - post_remove() receives the OLD VERSION as $1 (e.g., "1.0.0")
#   - post_remove() is ONLY called on actual removal, NOT on upgrade
#   - For upgrades, post_upgrade() is called instead
#
# Strategy: Whitelist dpkg upgrade scenarios where we should NOT clean up.
# In all other cases (dpkg remove/purge, or Arch removal), clean up.

ACTION="$1"

# Determine if we should clean up
# - On dpkg upgrade: $1 is "upgrade" -> DON'T clean up (postinst will handle)
# - On dpkg remove/purge: $1 is "remove" or "purge" -> clean up
# - On Arch Linux: $1 is version number, and post_remove only runs on uninstall -> clean up
SKIP_CLEANUP=false
case "$ACTION" in
    upgrade|failed-upgrade|abort-install|abort-upgrade)
        # dpkg upgrade/abort scenario - don't remove, postinst will handle it
        SKIP_CLEANUP=true
        ;;
esac

if [ "$SKIP_CLEANUP" = "false" ]; then
    EXTRACTED_PATHS=(
        "/usr/lib/Nowledge Mem/_up_/python-standalone"
        "/usr/lib/Nowledge Mem/python-standalone"
        "/usr/lib/nowledge-mem/_up_/python-standalone"
        "/usr/lib/nowledge-mem/python-standalone"
        "/usr/lib64/Nowledge Mem/_up_/python-standalone"
        "/usr/lib64/Nowledge Mem/python-standalone"
        "/usr/lib64/nowledge-mem/python-standalone"
    )

    for path in "${EXTRACTED_PATHS[@]}"; do
        if [ -d "$path" ]; then
            echo "Removing extracted Python runtime: $path"
            rm -rf "$path"
        fi
    done
fi

# =============================================================================
# Step 2: Remove nmem CLI symlink
# =============================================================================

# Check both possible symlink locations
for SYMLINK_TARGET in "/usr/local/bin/nmem" "/usr/bin/nmem"; do
    # Remove symlink if it exists and points to our installation
    if [ -L "$SYMLINK_TARGET" ]; then
        TARGET=$(readlink "$SYMLINK_TARGET" 2>/dev/null || true)
        if [ -n "$TARGET" ]; then
            # Check if it points to our installation
            case "$TARGET" in
                *nowledge*|*Nowledge*|*python-standalone*)
                    rm -f "$SYMLINK_TARGET"
                    echo "Removed nmem CLI from $SYMLINK_TARGET"
                    ;;
            esac
        fi
    fi
done

# Note: We don't remove the .desktop file here.
# The package manager handles .desktop file removal.
# We only added the GDK_BACKEND workaround to Tauri's .desktop file,
# which will be removed along with the whole file during uninstallation.

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q 2>/dev/null || true
fi

# NOTE: Do NOT use 'exit 0' here!
# When debtap converts this script to Arch Linux .INSTALL format, it wraps
# the script body inside post_remove() function. Using 'exit' would terminate
# the entire pacman process instead of just returning from the function.
# The script will return success (0) naturally when it reaches the end.

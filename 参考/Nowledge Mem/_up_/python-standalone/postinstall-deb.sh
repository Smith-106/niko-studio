#!/bin/bash
#
# postinstall-deb.sh - Post-installation script for Linux packages (deb, rpm, Arch)
# 
# This script is used by:
# - Debian/Ubuntu: .deb packages
# - Fedora/RHEL: .rpm packages  
# - Arch Linux: via debtap conversion
#
# It performs:
# 1. Extracts the Python runtime archive (python-runtime.tar.zst)
# 2. Creates the nmem CLI wrapper and symlink
# 3. Generates .desktop file with Wayland workaround (if not exists)
# 4. Updates icon cache and desktop database
#
# =============================================================================
# DEBTAP COMPATIBILITY NOTES (for Arch Linux)
# =============================================================================
# When users convert our .deb package to Arch using debtap, this script gets
# wrapped inside a post_install() function in the .INSTALL file. This means:
#
# 1. DO NOT use 'exit 0' for early returns - use conditional blocks instead.
#    'exit' would terminate pacman, not just skip to the next section.
#    Exception: 'exit 1' for critical failures is OK (fails the installation).
#
# 2. DO NOT use heredocs (cat <<EOF) - debtap may corrupt them during conversion.
#    Use multiple 'echo' statements instead for file generation.
#
# 3. DO NOT leave empty if-then-fi blocks - bash syntax error after conversion.
#    Every 'if' must have at least one command in the 'then' block.
#
# 4. The script body becomes the function body, so:
#    - Variables are function-local
#    - Any 'exit' affects the parent pacman process
#    - 'return' would work but isn't portable to deb/rpm
#
# Test changes by running: bash -n postinstall-deb.sh
# =============================================================================
#

# Don't use set -e as we want to handle errors gracefully
# set -e

# Update icon cache (GTK requirement)
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor 2>/dev/null || true
fi

# =============================================================================
# Step 1: Extract Python Runtime Archive
# =============================================================================
# The package ships with python-runtime.tar.zst instead of 22,864 individual files.
# This makes package build (especially RPM) 50x faster and install much faster.
# We extract the archive here during postinst.

echo "Extracting Python runtime..."

# Find the archive location
ARCHIVE_PATHS=(
    "/usr/lib/Nowledge Mem/_up_/python-runtime.tar.zst"
    "/usr/lib/Nowledge Mem/python-runtime.tar.zst"
    "/usr/lib/nowledge-mem/_up_/python-runtime.tar.zst"
    "/usr/lib/nowledge-mem/python-runtime.tar.zst"
    "/usr/lib64/Nowledge Mem/_up_/python-runtime.tar.zst"
    "/usr/lib64/Nowledge Mem/python-runtime.tar.zst"
    "/usr/lib64/nowledge-mem/python-runtime.tar.zst"
)

ARCHIVE_PATH=""
for path in "${ARCHIVE_PATHS[@]}"; do
    if [ -f "$path" ]; then
        ARCHIVE_PATH="$path"
        break
    fi
done

if [ -n "$ARCHIVE_PATH" ]; then
    # Get the directory containing the archive
    EXTRACT_DIR=$(dirname "$ARCHIVE_PATH")
    
    # Check if already extracted (python-standalone directory exists with python binary)
    if [ -x "$EXTRACT_DIR/python-standalone/python/bin/python3" ]; then
        # Check version to see if we need to re-extract
        VERSION_FILE="$EXTRACT_DIR/runtime-version.txt"
        INSTALLED_VERSION_FILE="$EXTRACT_DIR/python-standalone/.runtime-version"
        
        if [ -f "$VERSION_FILE" ] && [ -f "$INSTALLED_VERSION_FILE" ]; then
            BUNDLE_VERSION=$(cat "$VERSION_FILE" 2>/dev/null)
            INSTALLED_VERSION=$(cat "$INSTALLED_VERSION_FILE" 2>/dev/null)
            
            if [ "$BUNDLE_VERSION" = "$INSTALLED_VERSION" ]; then
                echo "Python runtime already extracted and up to date."
            else
                echo "Updating Python runtime (new version detected)..."
                rm -rf "$EXTRACT_DIR/python-standalone"
            fi
        fi
    fi
    
    # Extract if not already done
    if [ ! -x "$EXTRACT_DIR/python-standalone/python/bin/python3" ]; then
        echo "Extracting to $EXTRACT_DIR..."
        
        # Check for zstd
        if ! command -v zstd >/dev/null 2>&1; then
            echo "Error: zstd is required but not installed."
            echo "Please install it with:"
            echo "  sudo apt install zstd     (Debian/Ubuntu)"
            echo "  sudo dnf install zstd     (Fedora/RHEL)"
            echo "  sudo pacman -S zstd       (Arch Linux)"
            # NOTE: exit 1 is intentional here - this is a critical failure.
            # On Arch Linux, zstd is a core dependency of pacman, so this shouldn't happen.
            exit 1
        fi
        
        # Clean up any leftover python-standalone directory from previous installs
        # This prevents dpkg warnings about "Directory not empty" during upgrades
        if [ -d "$EXTRACT_DIR/python-standalone" ]; then
            echo "Removing old python-standalone directory..."
            rm -rf "$EXTRACT_DIR/python-standalone"
        fi
        
        # Extract the archive
        # The archive contains python-standalone/ at the root
        if tar --zstd -xf "$ARCHIVE_PATH" -C "$EXTRACT_DIR"; then
            echo "Python runtime extracted successfully."
            
            # Save version marker inside the extracted directory
            VERSION_FILE="$EXTRACT_DIR/runtime-version.txt"
            if [ -f "$VERSION_FILE" ]; then
                cp "$VERSION_FILE" "$EXTRACT_DIR/python-standalone/.runtime-version"
            fi
            
            # Optional: Remove the archive to save disk space
            # Uncomment the next line if you want to delete the archive after extraction
            # rm -f "$ARCHIVE_PATH"
        else
            echo "Error: Failed to extract Python runtime archive."
            echo "The application may not work correctly."
        fi
    fi
else
    echo "Note: No Python runtime archive found (may be development build or already extracted)."
fi

# =============================================================================
# Step 2: Find Python Standalone Directory and Setup CLI
# =============================================================================

# Installation paths to check (in order of preference)
INSTALL_PATHS=(
    "/usr/lib/Nowledge Mem/_up_/python-standalone"
    "/usr/lib/Nowledge Mem/python-standalone"
    "/usr/lib/nowledge-mem/_up_/python-standalone"
    "/usr/lib/nowledge-mem/python-standalone"
    "/usr/lib64/Nowledge Mem/_up_/python-standalone"
    "/usr/lib64/Nowledge Mem/python-standalone"
    "/usr/lib64/nowledge-mem/python-standalone"
    "/opt/nowledge-mem/python-standalone"
)

# Target for symlink
SYMLINK_TARGET="/usr/local/bin/nmem"

# Find the installation path
INSTALL_PATH=""
for path in "${INSTALL_PATHS[@]}"; do
    if [ -d "$path" ] && [ -d "$path/python" ]; then
        INSTALL_PATH="$path"
        break
    fi
done

# CLI installation is optional - continue with desktop file setup even if CLI fails
# NOTE: Using conditional blocks instead of 'exit 0' for debtap compatibility.
# When debtap converts this to Arch .INSTALL format, it wraps the script in a function,
# so 'exit' would terminate pacman instead of just skipping CLI installation.

if [ -z "$INSTALL_PATH" ]; then
    echo "Warning: Could not find python-standalone directory, CLI not installed"
elif [ ! -x "$INSTALL_PATH/python/bin/python3" ]; then
    echo "Warning: Bundled Python not found at $INSTALL_PATH/python/bin/python3, CLI not installed"
elif [ ! -f "$INSTALL_PATH/app/src/nowledge_graph_server/ncli.py" ]; then
    echo "Warning: CLI module not found, CLI not installed"
else
    # All prerequisites met - create the nmem wrapper script
    PYTHON_EXEC="$INSTALL_PATH/python/bin/python3"
    NCLI_MODULE="$INSTALL_PATH/app/src/nowledge_graph_server/ncli.py"
    WRAPPER_SCRIPT="$INSTALL_PATH/nmem-wrapper"

    # Write wrapper script line by line (avoids heredoc issues with debtap)
    echo '#!/bin/bash' > "$WRAPPER_SCRIPT"
    echo '# nmem - Nowledge Mem CLI' >> "$WRAPPER_SCRIPT"
    echo '# Uses bundled Python from the Nowledge Mem installation' >> "$WRAPPER_SCRIPT"
    echo '# Auto-generated by postinstall-deb.sh' >> "$WRAPPER_SCRIPT"
    echo '' >> "$WRAPPER_SCRIPT"
    echo "# Hardcoded paths to the bundle (set at install time)" >> "$WRAPPER_SCRIPT"
    echo "PYTHON_STANDALONE=\"$INSTALL_PATH\"" >> "$WRAPPER_SCRIPT"
    echo 'PYTHON="$PYTHON_STANDALONE/python/bin/python3"' >> "$WRAPPER_SCRIPT"
    echo 'NCLI="$PYTHON_STANDALONE/app/src/nowledge_graph_server/ncli.py"' >> "$WRAPPER_SCRIPT"
    echo '' >> "$WRAPPER_SCRIPT"
    echo '# Verify Python exists' >> "$WRAPPER_SCRIPT"
    echo 'if [ ! -x "$PYTHON" ]; then' >> "$WRAPPER_SCRIPT"
    echo '    echo "Error: Bundled Python not found at $PYTHON" >&2' >> "$WRAPPER_SCRIPT"
    echo '    echo "Nowledge Mem may have been uninstalled or moved." >&2' >> "$WRAPPER_SCRIPT"
    echo '    exit 1' >> "$WRAPPER_SCRIPT"
    echo 'fi' >> "$WRAPPER_SCRIPT"
    echo '' >> "$WRAPPER_SCRIPT"
    echo '# Verify ncli module exists' >> "$WRAPPER_SCRIPT"
    echo 'if [ ! -f "$NCLI" ]; then' >> "$WRAPPER_SCRIPT"
    echo '    echo "Error: CLI module not found at $NCLI" >&2' >> "$WRAPPER_SCRIPT"
    echo '    exit 1' >> "$WRAPPER_SCRIPT"
    echo 'fi' >> "$WRAPPER_SCRIPT"
    echo '' >> "$WRAPPER_SCRIPT"
    echo '# Verify nmem_cli package is installed (required dependency)' >> "$WRAPPER_SCRIPT"
    echo 'if ! "$PYTHON" -c "import nmem_cli" 2>/dev/null; then' >> "$WRAPPER_SCRIPT"
    echo '    echo "Error: nmem_cli package not found in bundled Python" >&2' >> "$WRAPPER_SCRIPT"
    echo '    echo "This may indicate a corrupted installation." >&2' >> "$WRAPPER_SCRIPT"
    echo '    echo "Try reinstalling Nowledge Mem or run: $PYTHON -m pip install nmem-cli" >&2' >> "$WRAPPER_SCRIPT"
    echo '    exit 1' >> "$WRAPPER_SCRIPT"
    echo 'fi' >> "$WRAPPER_SCRIPT"
    echo '' >> "$WRAPPER_SCRIPT"
    echo '# Set PYTHONPATH for the app modules' >> "$WRAPPER_SCRIPT"
    echo 'APP_SRC="$PYTHON_STANDALONE/app/src"' >> "$WRAPPER_SCRIPT"
    echo 'export PYTHONPATH="$APP_SRC:$PYTHONPATH"' >> "$WRAPPER_SCRIPT"
    echo '' >> "$WRAPPER_SCRIPT"
    echo '# Run the CLI' >> "$WRAPPER_SCRIPT"
    echo 'exec "$PYTHON" "$NCLI" "$@"' >> "$WRAPPER_SCRIPT"

    chmod +x "$WRAPPER_SCRIPT"

    # Create symlink in /usr/local/bin (preferred) or /usr/bin (fallback)
    if [ -d "/usr/local/bin" ]; then
        mkdir -p /usr/local/bin
        [ -e "$SYMLINK_TARGET" ] && rm -f "$SYMLINK_TARGET"
        ln -sf "$WRAPPER_SCRIPT" "$SYMLINK_TARGET"
        echo "Installed nmem CLI to $SYMLINK_TARGET"
    elif [ -d "/usr/bin" ]; then
        SYMLINK_TARGET="/usr/bin/nmem"
        [ -e "$SYMLINK_TARGET" ] && rm -f "$SYMLINK_TARGET"
        ln -sf "$WRAPPER_SCRIPT" "$SYMLINK_TARGET"
        echo "Installed nmem CLI to $SYMLINK_TARGET"
    fi

    # --- browse-now CLI wrapper ---
    # browse-now is bundled in the same Python runtime, invoked via module entry point
    BROWSE_WRAPPER_SCRIPT="$INSTALL_PATH/browse-now-wrapper"
    BROWSE_SYMLINK_TARGET="/usr/local/bin/browse-now"

    echo '#!/bin/bash' > "$BROWSE_WRAPPER_SCRIPT"
    echo '# browse-now - Browser Automation CLI' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '# Uses bundled Python from the Nowledge Mem installation' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '# Auto-generated by postinstall-deb.sh' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '' >> "$BROWSE_WRAPPER_SCRIPT"
    echo "# Hardcoded paths to the bundle (set at install time)" >> "$BROWSE_WRAPPER_SCRIPT"
    echo "PYTHON_STANDALONE=\"$INSTALL_PATH\"" >> "$BROWSE_WRAPPER_SCRIPT"
    echo 'PYTHON="$PYTHON_STANDALONE/python/bin/python3"' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '# Verify Python exists' >> "$BROWSE_WRAPPER_SCRIPT"
    echo 'if [ ! -x "$PYTHON" ]; then' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '    echo "Error: Bundled Python not found at $PYTHON" >&2' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '    echo "Nowledge Mem may have been uninstalled or moved." >&2' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '    exit 1' >> "$BROWSE_WRAPPER_SCRIPT"
    echo 'fi' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '' >> "$BROWSE_WRAPPER_SCRIPT"
    echo '# Run browse-now via module entry point' >> "$BROWSE_WRAPPER_SCRIPT"
    echo 'exec "$PYTHON" -c "from browse_now.cli import main; main()" "$@"' >> "$BROWSE_WRAPPER_SCRIPT"

    chmod +x "$BROWSE_WRAPPER_SCRIPT"

    if [ -d "/usr/local/bin" ]; then
        mkdir -p /usr/local/bin
        [ -e "$BROWSE_SYMLINK_TARGET" ] && rm -f "$BROWSE_SYMLINK_TARGET"
        ln -sf "$BROWSE_WRAPPER_SCRIPT" "$BROWSE_SYMLINK_TARGET"
        echo "Installed browse-now CLI to $BROWSE_SYMLINK_TARGET"
    elif [ -d "/usr/bin" ]; then
        BROWSE_SYMLINK_TARGET="/usr/bin/browse-now"
        [ -e "$BROWSE_SYMLINK_TARGET" ] && rm -f "$BROWSE_SYMLINK_TARGET"
        ln -sf "$BROWSE_WRAPPER_SCRIPT" "$BROWSE_SYMLINK_TARGET"
        echo "Installed browse-now CLI to $BROWSE_SYMLINK_TARGET"
    fi
fi

# =============================================================================
# Update .desktop file with Wayland workaround
# =============================================================================
# WebKitGTK has performance issues on Wayland (laggy window dragging, slow menus).
# Using X11 backend (via XWayland) provides much better performance.
#
# Tauri automatically creates a .desktop file during package build.
# We UPDATE the existing file to add the GDK_BACKEND=x11 workaround,
# rather than creating a new one (which would cause duplicate icons).
#
# UPGRADE HANDLING: Previous versions created "nowledge-mem.desktop" while
# Tauri creates "Nowledge Mem.desktop". We need to clean up the old one.

# First, clean up old .desktop file created by previous versions of our installer
# This prevents duplicate icons after upgrade
OLD_DESKTOP="/usr/share/applications/nowledge-mem.desktop"
TAURI_DESKTOP="/usr/share/applications/Nowledge Mem.desktop"

if [ -f "$OLD_DESKTOP" ] && [ -f "$TAURI_DESKTOP" ]; then
    # Both exist - this is an upgrade scenario with duplicates
    # Remove the old one we created, keep Tauri's
    echo "Upgrade detected: removing old $OLD_DESKTOP (duplicate of Tauri's .desktop)"
    rm -f "$OLD_DESKTOP"
fi

# Check for existing .desktop files (Tauri may use different naming)
DESKTOP_FILE=""
for desktop_path in "/usr/share/applications/Nowledge Mem.desktop" \
                    "/usr/share/applications/nowledge-mem.desktop" \
                    "/usr/share/applications/nowledge-mem.Nowledge Mem.desktop" \
                    "/usr/share/applications/co.nowledge.mem.desktop.desktop"; do
    if [ -f "$desktop_path" ]; then
        DESKTOP_FILE="$desktop_path"
        break
    fi
done

# Find the main executable
# Check common installation paths for both deb and rpm packages
NOWLEDGE_EXEC=""

# Primary locations (most common)
for exec_path in "/usr/bin/nowledge-mem" "/usr/bin/Nowledge Mem" "/opt/nowledge-mem/nowledge-mem"; do
    if [ -x "$exec_path" ]; then
        NOWLEDGE_EXEC="$exec_path"
        break
    fi
done

# Check lib directories (Tauri deb default location)
if [ -z "$NOWLEDGE_EXEC" ]; then
    for exec_path in "/usr/lib/nowledge-mem/nowledge-mem" "/usr/lib/Nowledge Mem/nowledge-mem" "/usr/lib/Nowledge Mem/Nowledge Mem"; do
        if [ -x "$exec_path" ]; then
            NOWLEDGE_EXEC="$exec_path"
            break
        fi
    done
fi

# Check lib64 directories (RPM 64-bit systems like Fedora/RHEL)
if [ -z "$NOWLEDGE_EXEC" ]; then
    for exec_path in "/usr/lib64/nowledge-mem/nowledge-mem" "/usr/lib64/Nowledge Mem/nowledge-mem" "/usr/lib64/Nowledge Mem/Nowledge Mem"; do
        if [ -x "$exec_path" ]; then
            NOWLEDGE_EXEC="$exec_path"
            break
        fi
    done
fi

# Update existing .desktop file with Wayland workaround, or create if none exists
if [ -n "$DESKTOP_FILE" ]; then
    # Existing .desktop file found - update it with GDK_BACKEND=x11 workaround
    echo "Found existing .desktop file at $DESKTOP_FILE"
    
    # Check if it already has the workaround
    if grep -q "GDK_BACKEND=x11" "$DESKTOP_FILE" 2>/dev/null; then
        echo "Desktop file already has Wayland workaround, skipping"
    else
        # Add GDK_BACKEND=x11 to the Exec line
        # This uses sed to modify the Exec= line in place
        if grep -q "^Exec=" "$DESKTOP_FILE" 2>/dev/null; then
            # Backup original
            cp "$DESKTOP_FILE" "$DESKTOP_FILE.bak" 2>/dev/null || true
            
            # Update Exec line to prepend "env GDK_BACKEND=x11 "
            sed -i 's|^Exec=|Exec=env GDK_BACKEND=x11 |' "$DESKTOP_FILE"
            
            echo "Updated $DESKTOP_FILE with Wayland workaround (original backed up)"
            
            # Clean up backup
            rm -f "$DESKTOP_FILE.bak" 2>/dev/null || true
        else
            echo "Warning: Could not find Exec line in $DESKTOP_FILE"
        fi
    fi
elif [ -n "$NOWLEDGE_EXEC" ]; then
    # No existing .desktop file - create one
    DESKTOP_FILE="/usr/share/applications/nowledge-mem.desktop"
    echo "Creating new .desktop file with Wayland workaround..."
    
    # Ensure directory exists
    mkdir -p /usr/share/applications
    
    # Write .desktop file line by line (avoids heredoc issues with debtap)
    echo '[Desktop Entry]' > "$DESKTOP_FILE"
    echo 'Name=Nowledge Mem' >> "$DESKTOP_FILE"
    echo 'Comment=Personal memory and context management system' >> "$DESKTOP_FILE"
    echo 'GenericName=Memory Manager' >> "$DESKTOP_FILE"
    echo "Exec=env GDK_BACKEND=x11 \"$NOWLEDGE_EXEC\" %U" >> "$DESKTOP_FILE"
    echo 'Icon=nowledge-mem' >> "$DESKTOP_FILE"
    echo 'Terminal=false' >> "$DESKTOP_FILE"
    echo 'Type=Application' >> "$DESKTOP_FILE"
    echo 'Categories=Utility;Office;' >> "$DESKTOP_FILE"
    echo 'StartupWMClass=nowledge-mem' >> "$DESKTOP_FILE"
    echo 'StartupNotify=true' >> "$DESKTOP_FILE"
    echo 'Keywords=memory;knowledge;notes;ai;graph;' >> "$DESKTOP_FILE"
    echo '# GDK_BACKEND=x11 is set for better performance on Wayland via XWayland' >> "$DESKTOP_FILE"
    
    chmod 644 "$DESKTOP_FILE"
    echo "Created $DESKTOP_FILE with Wayland workaround"
else
    echo "Warning: Could not find nowledge-mem executable, .desktop file not modified"
fi

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q 2>/dev/null || true
fi

# NOTE: Do NOT use 'exit 0' here!
# When debtap converts this script to Arch Linux .INSTALL format, it wraps
# the script body inside post_install() function. Using 'exit' would terminate
# the entire pacman process instead of just returning from the function.
# The script will return success (0) naturally when it reaches the end.

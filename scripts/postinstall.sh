#!/bin/bash

# Post-install script to remove quarantine attribute from JFlix.app
# This script runs after installation with admin privileges

APP_PATH="/Applications/JFlix.app"

# Check if app exists
if [ -d "$APP_PATH" ]; then
    echo "Removing quarantine attribute from $APP_PATH..."
    xattr -rd com.apple.quarantine "$APP_PATH" 2>/dev/null || true
    echo "Quarantine removed successfully."
    
    echo "Opening JFlix.app..."
    open "$APP_PATH"
    echo "JFlix.app launched."
else
    echo "Error: JFlix.app not found at $APP_PATH"
    exit 1
fi

exit 0

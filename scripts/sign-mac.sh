#!/bin/bash

# Improved Ad-hoc sign the macOS app to reduce Gatekeeper warnings
# This is not a replacement for proper Apple Developer ID signing

APP_PATH="$1"

if [ -z "$APP_PATH" ]; then
  echo "Usage: $0 <path-to-app>"
  exit 1
fi

echo "Ad-hoc signing $APP_PATH..."

# Remove any existing signatures
echo "Removing existing signatures..."
codesign --remove-signature "$APP_PATH" 2>/dev/null || true

# Sign all frameworks and binaries
echo "Signing frameworks and binaries..."
find "$APP_PATH/Contents" -type f \( -name "*.dylib" -o -name "*.so" -o -name "Electron" -o -name "*.app" \) -exec codesign --force --deep --sign - {} \; 2>/dev/null || true

# Sign the main app with ad-hoc signature
echo "Signing main app bundle..."
codesign --force --deep --sign - "$APP_PATH"

# Verify the signature
echo "Verifying signature..."
codesign --verify --verbose "$APP_PATH" 2>&1 || echo "Warning: Verification failed, but signing was attempted"

echo "Ad-hoc signing complete."

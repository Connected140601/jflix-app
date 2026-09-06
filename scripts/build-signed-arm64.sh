#!/bin/bash

# Build, sign, and create PKG for macOS ARM64

echo "Building macOS ARM64 app directory..."
npx electron-builder --mac dir --arm64

echo "Ad-hoc signing the app..."
./scripts/sign-mac.sh dist/mac-arm64/JFlix.app

echo "Creating PKG from signed app..."
npx electron-builder --mac pkg --arm64

echo "Done!"

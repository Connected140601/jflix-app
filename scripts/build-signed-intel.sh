#!/bin/bash

# Build, sign, and create PKG for macOS Intel

echo "Building macOS Intel app directory..."
npx electron-builder --mac dir --x64

echo "Ad-hoc signing the app..."
./scripts/sign-mac.sh dist/mac/JFlix.app

echo "Creating PKG from signed app..."
npx electron-builder --mac pkg --x64

echo "Done!"

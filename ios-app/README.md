# JFlix iOS

![version](https://img.shields.io/github/v/release/Connected140601/JFLIX-IOS?label=version)
![platform](https://img.shields.io/badge/platform-iOS%2015%2B-blue)
![downloads](https://img.shields.io/github/downloads/Connected140601/JFLIX-IOS/total?label=downloads)

Native iOS wrapper for [JFlix](https://jflix.uk) — full-screen app shell with
offline downloads, silent navigation guard, and native app treatment,
mirroring the Android and Electron apps.

## Download

Get the latest IPA from [**Releases**](https://github.com/Connected140601/JFLIX-IOS/releases)
(`JFlix-iOS-vX.Y.Z-unsigned.ipa`), then:

1. Sideload with [Sideloadly](https://sideloadly.io) or AltStore using a free Apple ID.
2. On iPhone: Settings → General → VPN & Device Management → trust your Apple ID.
3. Open **JFlix**.

Free Apple ID certificates last 7 days — re-sideload weekly.

## New version? (maintainers)

1. Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in
   `ios-app/JFlix.xcodeproj/project.pbxproj` (and any code changes).
2. Push to `main`.
3. Actions → **iOS unsigned IPA** → Run workflow.
4. The workflow archives, then **automatically publishes a Release named
   "JFlix iOS vX.Y.Z (build N)"** with the IPA attached — no manual steps.

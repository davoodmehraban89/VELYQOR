# ChartNova iOS + real WidgetKit extension

This folder contains the **native iPhone companion app and Home Screen widget source**, not a web shortcut. Unlike a PWA, the WidgetKit target appears in the iOS **Add Widget** picker after the containing app has been built, signed and installed.

## Features

- One widget with the standard iOS small, medium and large families, showing **2 / 4 / 6** user-selected instruments respectively.
- App screen to select up to six market symbols from ChartNova's live 58-symbol watchlist, favorite/unfavorite, reorder and choose Nova Glass, dark or light appearance.
- Shared App Group `group.ir.chartnova.widgets` persists preferences between app and widget.
- HTTPS `GET https://app.chartnova.ir/api/widget?symbols=...` with the selected ordered symbols. Zero API keys in the binary; request is served by Cloudflare KV and does not consume 250-per-day upstream requests per widget view.
- WidgetKit timeline asks for a refresh after 15 minutes; **iOS may defer updates** depending on power, budget, connectivity and system policy.
- When offline, last valid response is used and prominently marked as cached / stale. Placeholder **does not invent prices**.
- Tapping widget opens the companion app through `chartnova://widget`.

## Building on macOS (required)

1. Use a Mac with an Xcode version that supports iOS 17 or later.
2. Install **XcodeGen** (e.g. `brew install xcodegen`).
3. Run `cd ios/ChartNova && xcodegen generate`, then open `ChartNova.xcodeproj` in Xcode.
4. Select your Apple development team under Signing & Capabilities for both `ChartNova` and `ChartNovaWidgets`.
5. Register and enable the same **App Groups** capability, `group.ir.chartnova.widgets`, for both bundle IDs. Change the sample bundle IDs and group ID if your team's identifiers are different; update both `project.yml` and `Shared/WidgetSettings.swift`.
6. Build and run the **ChartNova** scheme on your physical iPhone; trust the developer identity if prompted.
7. Open ChartNova once, select favorites and rearrange the widget list. On the iPhone Home Screen, long-press empty space → **Edit → Add Widget** → search **ChartNova** → choose a size → Add Widget.
8. For iOS unit tests run `xcodebuild test -project ChartNova.xcodeproj -scheme ChartNova -destination 'platform=iOS Simulator,name=iPhone 16'`; choose an available simulator name if different.

The App Group and development provisioning are Apple-controlled; without them the widget cannot securely share app preferences. A paid Apple Developer membership may be required for distribution and/or capabilities. Nothing has been published to the App Store or installed on an actual iPhone by this repository change.

## Security & correctness

- Uses HTTPS-only ChartNova backend. No credentials, bearer tokens or API secret keys in the app.
- All selected symbols are allowlisted to uppercase `BASE-QUOTE` pairs with a six-symbol cap.
- Network data is decoded and validated before being cached, with explicit provider timestamps / stale indicators.
- Price values are **provider sell quotes**, not necessarily executable exchange prices, and are not guaranteed to update in real time.
- The iOS application and widget targets share code from `Shared/`. Native widget settings are separate from the browser's localStorage-based preview; automatic cross-device/browser sync requires account support and has **not** been built.

## Validation evidence

Automated tests against the real live ChartNova widget API and static project validation are possible from Windows/Linux. **Xcode compilation, simulator WidgetKit integration and physical iPhone installation require macOS/Xcode and must not be claimed passed until run.**

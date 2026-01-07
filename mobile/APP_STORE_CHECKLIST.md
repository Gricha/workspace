# App Store Submission Checklist

## Pre-Submission Setup

### App Store Connect
1. Log into [App Store Connect](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - Platform: iOS
   - Name: Perry
   - Primary Language: English (U.S.)
   - Bundle ID: `com.gricha.perry`
   - SKU: `perry-ios` (or any unique identifier)

### App Information (App Store Connect)
Fill in the following under "App Information":
- **Privacy Policy URL**: `https://gricha.github.io/perry/privacy`
- **Category**: Developer Tools (Primary), Utilities (Secondary)
- **Content Rights**: Does not contain third-party content
- **Age Rating**: Complete the questionnaire (all "No" for Perry)

## Screenshots Required

### iPhone 6.9" Display (Required)
- **Device**: iPhone 16 Pro Max (or simulator)
- **Resolution**: 1320 x 2868 (portrait) or 2868 x 1320 (landscape)
- **Count**: 1-10 screenshots

### iPhone 6.5" Display (Required)
- **Device**: iPhone 11 Pro Max, 12 Pro Max, 13 Pro Max, 14 Plus/Pro Max, 15 Plus/Pro Max
- **Resolution**: 1242 x 2688 (portrait) or 2688 x 1242 (landscape)
- **Count**: 1-10 screenshots

### iPad Pro 13" (Required if supporting tablet)
- **Device**: iPad Pro 12.9" (any generation)
- **Resolution**: 2064 x 2752 (portrait) or 2752 x 2064 (landscape)
- **Count**: 1-10 screenshots

### Taking Screenshots
```bash
# Run on simulator
npx expo run:ios --device "iPhone 16 Pro Max"

# Take screenshot: Cmd + S (saves to Desktop)
# Or: Device → Trigger Screenshot in Simulator menu
```

### Suggested Screenshots
1. Workspace list view (showing some workspaces)
2. Workspace detail view
3. Session terminal/webview
4. Settings page
5. Empty state with "Add workspace" prompt

## App Icon

**Important**: The App Store icon must NOT have transparency.

Current icon has alpha channel. Before submission:
1. Open `assets/icon.png` in an image editor
2. Add a solid background (white: #FFFFFF or match your splash background)
3. Export as PNG without alpha channel
4. Replace `assets/icon.png`

## Build & Submit

### Option 1: Using EAS (Recommended)
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to Expo account
eas login

# Configure project (one-time)
eas build:configure

# Build for App Store
eas build --platform ios --profile production

# Submit to App Store (after build completes)
eas submit --platform ios --latest
```

Before running `eas submit`, fill in `eas.json`:
- `appleId`: Your Apple ID email
- `ascAppId`: App Store Connect App ID (found in App Information → General → Apple ID)

### Option 2: Using Xcode
```bash
# Build release version
cd mobile
npx expo run:ios --configuration Release

# Or open in Xcode
open ios/Perry.xcworkspace
```

Then in Xcode:
1. Select "Any iOS Device (arm64)" as destination
2. Product → Archive
3. Window → Organizer → Distribute App
4. App Store Connect → Upload

## App Review Notes

Add these notes for the reviewer in App Store Connect:

```
Perry is a companion app for managing self-hosted Docker development environments.

To test this app, you need:
1. A Mac or Linux machine running the Perry agent (https://github.com/gricha/perry)
2. Install Perry: curl -fsSL https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash
3. Start the agent: perry agent run

The app connects to the Perry agent over your local network to:
- View and manage development workspaces
- Start/stop workspace containers
- Access workspace terminal sessions

Without a running Perry agent, the app will show connection errors, which is expected behavior.
```

## Version Management

For each submission:
1. Update `version` in `app.json` for new features (e.g., "1.0.0" → "1.1.0")
2. The `buildNumber` auto-increments via EAS, or manually update for Xcode builds
3. Keep `version` and `CFBundleShortVersionString` in sync

## Post-Submission

- App Review typically takes 24-48 hours
- Watch for messages in App Store Connect
- If rejected, address feedback and resubmit
- Once approved, manually release or set auto-release

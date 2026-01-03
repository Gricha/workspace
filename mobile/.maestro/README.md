# Mobile E2E Tests with Maestro

End-to-end tests for the Workspace mobile app using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

1. Install Maestro CLI:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. For iOS testing, install idb-companion:
   ```bash
   brew tap facebook/fb
   brew install facebook/fb/idb-companion
   ```

3. Build and run the app on a simulator/emulator:
   ```bash
   # iOS
   npx expo run:ios

   # Android
   npx expo run:android
   ```

## Running Tests

Run all tests:
```bash
npm run test:e2e
```

Run specific test flows:
```bash
npm run test:e2e:navigation    # Tab navigation test
npm run test:e2e:settings      # Settings screen test
npm run test:e2e:workspaces    # Workspaces screen test
```

Or run directly with Maestro:
```bash
maestro test .maestro/navigation.yaml
```

## Test Flows

- `navigation.yaml` - Tests tab navigation between screens
- `settings.yaml` - Tests settings screen content and scrolling
- `workspaces.yaml` - Tests workspace list and create modal
- `workspace-actions.yaml` - Tests workspace start/stop actions

## Configuration

Tests expect the app bundle ID `com.subroutine.workspace`. Update `appId` in test files if different.

## CI/CD Integration

See [Expo EAS Workflows documentation](https://docs.expo.dev/eas/workflows/examples/e2e-tests/) for CI setup.

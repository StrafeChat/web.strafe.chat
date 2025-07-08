# Update Notification System

This document describes the GitHub-integrated update notification system that shows users when new updates are available.

## Features

- **GitHub Integration**: Automatically checks for new releases and commits from the GitHub repository
- **Smart Notifications**: Only shows each update once per user
- **Release & Commit Support**: Can notify about both GitHub releases and recent commits
- **Persistent Storage**: Uses localStorage to track which updates have been shown
- **Automatic Checking**: Checks for updates on app startup and periodically (every 30 minutes)
- **Beautiful Modal**: Clean, modern modal design with update details

## Components

### 1. GitHub Service (`src/lib/services/githubService.ts`)
- Handles GitHub API communication
- Fetches latest releases and commits
- Compares versions to detect updates
- Configurable repository owner and name

### 2. Update Notification Hook (`src/lib/hooks/useUpdateNotification.ts`)
- Manages update checking logic
- Handles localStorage for tracking shown updates
- Provides reactive signals for modal state
- Implements automatic checking intervals

### 3. Update Notification Modal (`src/components/modals/UpdateNotificationModal.tsx`)
- Beautiful modal component for displaying update information
- Shows version, commit message/release notes, and publication date
- Provides "Later" and "View Update" buttons
- Responsive design with proper theming

## Configuration

### Repository Settings
Update the repository information in `src/lib/services/githubService.ts`:

```typescript
class GitHubService {
  private readonly owner = 'StrafeChat'; // GitHub username/organization
  private readonly repo = 'web'; // Repository name
  // ...
}
```

### App Version
The current app version is defined in `src/constants.ts`:

```typescript
export const APP_VERSION = "0.1.5-INDEV";
```

### Check Interval
Modify the checking interval in `src/lib/hooks/useUpdateNotification.ts`:

```typescript
const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
```

## How It Works

1. **Commit-Based Updates**: The system checks for updates from recent commits:
   - **Development Branch**: Primarily checks the `dev` branch for latest commits
   - **Fallback Branches**: Falls back to `main` then `master` if `dev` doesn't exist

2. **Smart Notifications**: 
   - Shows commit notifications for recent development activity (within 24 hours)
   - Prevents duplicate notifications using localStorage caching
   - Only notifies about commits, no release checking

3. **Automatic Checking**: Runs update checks every 30 minutes while the app is active

4. **User Control**: Users can dismiss notifications, and the system remembers dismissed updates

## Testing

The system includes built-in testing utilities available in the browser console:

### Available Console Commands

```javascript
// Test real GitHub API integration (checks dev branch commits)
testUpdateNotification()

// Clear the notification cache (allows re-showing notifications)
clearUpdateCache()

// Show a fake update notification for UI testing
simulateUpdate()

// View current cache status
getUpdateCacheStatus()
```

### Testing Workflow

1. Open browser developer tools
2. Go to the Console tab
3. Run `clearUpdateCache()` to reset notification history
4. Run `simulateUpdate()` to test the modal UI
5. Run `testUpdateNotification()` to test real GitHub integration
6. **Branch Testing**: The system will automatically try dev → main → master branch fallback

## Storage

The system uses localStorage with the key `strafe_chat_shown_updates` to store:

```typescript
interface ShownUpdate {
  version: string;        // Version or commit SHA
  type: 'release' | 'commit'; // Type of update
  timestamp: number;      // When it was shown
}
```

## Error Handling

- **Network Errors**: Gracefully handles API failures without breaking the app
- **Invalid Responses**: Validates GitHub API responses
- **Storage Errors**: Handles localStorage failures
- **Console Logging**: Provides detailed logs for debugging

## Customization

### Modal Styling
The modal uses the app's existing CSS variables and can be customized in:
`src/components/modals/UpdateNotificationModal.tsx`

### Update Logic
Customize when updates are considered "new" in:
`src/lib/services/githubService.ts` (see `isNewerVersion` method)

### Notification Frequency
Adjust checking intervals and delays in:
`src/lib/hooks/useUpdateNotification.ts`

## Integration

The system is automatically integrated into the app through:

1. **App.tsx**: Imports the hook and modal component
2. **Automatic Initialization**: Starts checking on app mount
3. **Modal Provider**: Uses the existing modal system
4. **Theme Integration**: Follows the app's design system

## Future Enhancements

- **Semantic Versioning**: Implement proper semver comparison
- **Update Categories**: Distinguish between major, minor, and patch updates
- **Changelog Integration**: Parse and display structured changelogs
- **Update Scheduling**: Allow users to schedule update notifications
- **Branch Selection**: Support checking different branches (dev, staging, etc.)
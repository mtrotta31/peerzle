// VAPID keys for Web Push notifications
// Generated using: npx web-push generate-vapid-keys
// These MUST be set in environment variables - no fallbacks allowed

// Fail loudly on startup if VAPID keys are missing
if (!process.env.VAPID_PUBLIC_KEY) {
  throw new Error('VAPID_PUBLIC_KEY environment variable is required for push notifications');
}
if (!process.env.VAPID_PRIVATE_KEY) {
  throw new Error('VAPID_PRIVATE_KEY environment variable is required for push notifications');
}
if (!process.env.VAPID_SUBJECT) {
  throw new Error('VAPID_SUBJECT environment variable is required (e.g., mailto:support@peerzle.com)');
}

export const VAPID_PUBLIC_KEY: string = process.env.VAPID_PUBLIC_KEY;
export const VAPID_PRIVATE_KEY: string = process.env.VAPID_PRIVATE_KEY;
export const VAPID_SUBJECT: string = process.env.VAPID_SUBJECT;

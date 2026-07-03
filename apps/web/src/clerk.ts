export function clerkPublishableKey(): string {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      'Missing VITE_CLERK_PUBLISHABLE_KEY — set it in apps/web/.env.local (dev) or the CI build environment.',
    );
  }
  return key;
}

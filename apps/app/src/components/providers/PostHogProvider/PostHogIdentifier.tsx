"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

/**
 * Identifies the current Clerk user in PostHog with metadata.
 * Must be rendered inside both <ClerkProvider> and <PostHogProvider>.
 *
 * Tracked metadata:
 * - email, name, username, avatar_url (updated each session)
 * - clerk_user_id, created_at (set once, never overwritten)
 */
export function PostHogIdentifier() {
  const { user, isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user) {
      // Identify the user with their Clerk ID as the distinct_id
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        username: user.username,
        avatar_url: user.imageUrl,
      });

      // Set properties that should only be written once
      posthog.setPersonProperties(
        {}, // $set (already handled above)
        {
          clerk_user_id: user.id,
          created_at: user.createdAt?.toISOString(),
        }
      );
    } else {
      // User signed out — reset so next user gets a fresh session
      posthog.reset();
    }
  }, [isSignedIn, isLoaded, user]);

  return null;
}

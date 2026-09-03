---
name: Firebase email verification flow
description: The correct email verification behavior for Firebase-authenticated Expo users.
---

Firebase email/password verification is link-based, not a Clerk-style numeric
code flow. The app must send a verification link, reload the Firebase user after
the user clicks it, and gate sign-in on emailVerified.

**Why:** Mixing a Clerk verification-code screen with Firebase account state
leaves the UI waiting for a code Firebase never sends.

**How to apply:** Keep Firebase email creation, verification email delivery,
resend, refresh, and sign-in checks in one provider flow. Use Clerk verification
only for accounts that are actually created by Clerk.

**Confirmed:** The link-based verification flow works after Firebase
Email/Password is enabled in the project settings.
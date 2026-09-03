---
name: Firebase OAuth platform split
description: Platform-specific requirements when adding Firebase Google authentication to Expo apps.
---

Firebase's web app configuration is sufficient for browser Google authentication with
the Firebase JS SDK, but it does not include the Android and iOS OAuth client IDs
needed for native Expo credential flows.

**Why:** The provided Firebase config contains the web app identifiers only, while
native Google auth needs platform OAuth registration and redirect configuration.

**How to apply:** Treat browser preview auth and native auth as separate completion
criteria. Before shipping native Google login, obtain the Firebase/Google OAuth
client IDs, add the app identifiers and redirect setup, then use the native
credential flow rather than a web popup.
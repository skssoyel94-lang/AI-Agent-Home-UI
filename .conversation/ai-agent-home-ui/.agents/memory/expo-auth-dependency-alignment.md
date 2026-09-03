---
name: Expo auth dependency alignment
description: Non-obvious compatibility checks for imported Expo authentication projects.
---

Imported Expo projects can carry APIs from a newer Expo Router release than the
workspace actually installs. Verify the installed package types before trusting
native tab or auth examples, and prefer the current package API over blindly
preserving source code.

**Why:** The imported app's native tab child API did not match the installed
Expo Router types even though the app otherwise started successfully.

**How to apply:** After importing an Expo app, run its package-specific
typecheck and Expo dependency check before runtime validation. Fix API-shape
mismatches without changing the app's auth provider or bundle scheme.
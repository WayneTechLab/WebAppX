# Step 07 — Security Rules

> Lock down Firestore, Storage, and (if used) Realtime Database with
> deny-by-default rules, and prove them with automated rules unit tests.

## 🎯 Goal
Rules that default-deny, allow only what each role needs, and a passing
`@firebase/rules-unit-testing` suite wired into CI.

## ✅ Preconditions
- Step 03 created `firestore.rules` / `storage.rules`.
- RBAC model decided (custom claims, e.g. `admin`, `member`).

## ❓ Operator prompts
1. What roles exist and what can each read/write?
2. Which collections are public-read vs. owner-only vs. admin-only?

## ⌨️ Commands

### `firestore.rules` (deny-by-default skeleton)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() { return isSignedIn() && request.auth.token.admin == true; }
    function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }

    // Default deny everything not explicitly matched below.
    match /{document=**} { allow read, write: if false; }

    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if isOwner(uid) || isAdmin();
    }

    match /public/{doc} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

### `storage.rules`
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{uid}/{file} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid
        && request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('image/.*|application/pdf');
    }
  }
}
```

### Rules unit tests
```bash
npm install -D @firebase/rules-unit-testing
# Write tests under scripts/security/ or src/__tests__/rules/, then:
firebase emulators:exec "node ./scripts/security/firestore_rules_test.cjs"
```

## 📄 Generated files
- `firestore.rules`, `storage.rules`, `database.rules.json` (if RTDB)
- `firestore.indexes.json` (add composite indexes as queries require)
- `scripts/security/firestore_rules_test.cjs` (or `.ts`)

## 🔒 Security notes
- **Deny by default**; never ship `allow read, write: if true` on real data.
- Enforce file **size + content-type** limits on Storage writes.
- Validate document shape in rules where feasible (`request.resource.data`).
- Re-run rules tests in CI on every PR — a rules regression is a data breach.
- Pair rules with **App Check** so only your apps can call the backend.

## 🚦 Verification gate
```bash
npx --yes firebase-tools emulators:exec "node ./scripts/security/firestore_rules_test.cjs"   # all green
bash .SYSTEMX/scripts/deploy.sh rules --project "${FIREBASE_PROJECT_ID}"
```
✅ Pass → proceed to [Step 08 — MCP Servers](./08-mcp-servers.md) *(optional)*.

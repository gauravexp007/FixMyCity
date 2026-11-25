# FixMyCity / CivicTrack

Civic issue reporting for citizens, municipal desks and ward officers. Report an
issue with geo-tagged photo/video evidence, and follow it from submission to
resolution.

## One deployment

The app is a single deployment: the React site in `client/` is built and served
statically, and it talks to **Firebase Firestore** directly. There is no API
server to deploy — accounts, complaints, notifications, counters and evidence
all live in Firebase.

```
client/          React app (single deployable build)
firebase.json    Firebase Hosting configuration (the only deployment file)
```

### Deploy

```bash
npm --prefix client ci
npm --prefix client run build
npx firebase-tools deploy --only hosting --project fixmycity-51576
```

The Firebase web configuration is public by design and already points at the
`fixmycity-51576` project. Override it with `VITE_FIREBASE_*` variables if you
move to another project.

### Firebase setup

In the Firebase console for `fixmycity-51576`:

1. Create the **Firestore Database** (production mode is fine).
2. Enable **Storage** for the evidence uploads (small photos fall back to
   Firestore if Storage is unavailable).
3. Publish Firestore/Storage rules that allow the app to read and write the
   `users`, `complaints`, `notifications`, `counters` collections and the
   `evidence/` storage prefix. This build has no server-side session, so the
   rules are what protect the data — tighten them before real-world use, e.g.
   by requiring `request.auth != null` once everyone signs in with Google.

The first load provisions the administrator and, on an empty database, clearly
labelled demo role accounts plus `[Sample]` complaints.

## Sign-in

Two methods are supported:

- **Continue with Google** — Firebase Authentication (Google provider) opens the
  account chooser, then the Google profile is stored in the Firestore `users`
  collection (`firebaseUid`, `authProvider: "google"`, avatar, last login). New
  Google accounts become citizens; the administrator email keeps the superior
  role.
- **Email and password** — the form checks the email against Firestore as before.

Enable **Google** under Firebase Console → Authentication → Sign-in method, and
make sure the site's domain is listed under Authentication → Settings →
Authorized domains (Firebase Hosting domains are added automatically; preview or
custom domains must be added by hand).

## Administrator

- Email: `fab.gaurav007@gmail.com`
- Password: set in `ADMIN_ACCOUNT` (`client/src/services/dataApi.js`)

Sign in with that account to reach `/dashboard/government` and the authority
management screen. Login details are read from the Firebase `users` collection
on every sign-in; nothing is hardcoded in the page.

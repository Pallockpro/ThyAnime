# Firebase setup (one time, ~3 minutes)

Project: `thyanime-88d67` → https://console.firebase.google.com/project/thyanime-88d67

## 1. Turn on Google sign-in
**Build → Authentication → Get started → Sign-in method → Google → Enable → Save.**

Then **Authentication → Settings → Authorized domains → Add domain** and add every address the site runs on, e.g.
your custom domain (the one in your `CNAME` file) and `pallockpro.github.io`. (`localhost` is already there.)
If you skip this, sign-in shows "This domain isn't authorised".

## 1b. Turn on username sign-in (needed for Family accounts)
**Build → Authentication → Sign-in method → Email/Password → Enable → Save** (leave “Email link” off).
Family accounts sign in with a plain username + password. Behind the scenes the username becomes `username@family.thyanime.me`
(it is never emailed — it only has to look like an email to Firebase). Change `FAMILY_DOMAIN` in `lib/profiles.js` if you want a different one.
Because there is no real email, a forgotten family password can’t be reset by email — you can reset it from
**Authentication → Users → ⋮ → Reset password / Delete account** in the console.

## 2. Paste the database rules
**Build → Realtime Database → Rules** → replace everything with `firebase/database.rules.json` → **Publish**.
- `config/*` is publicly readable (so visitors can see the maintenance flag) and only writable from the console.
- `presence/*` powers the **Live visitors** counter in Settings: each open tab writes a tiny entry that the server deletes automatically when the tab closes.
- `users/<uid>/settings`, `users/<uid>/history` and `users/<uid>/name` (settings, "Continue watching", custom display name) are readable/writable only by that signed-in user.
- `families/<familyUid>/profiles/<profileId>` holds each family profile (name, avatar, settings, history). The family login can read/write all of them; a Gmail that was linked to a profile can only read/write **its own** profile.
- `googleLinks/<googleUid>` = `{ fam, pid }` is the "this Gmail belongs to that profile" index. Only the family that owns the link can create/remove it.

## 3. Create the maintenance switch
**Realtime Database → Data →** click **+** next to the root, name it `config`, then **+** next to `config`, name it
`maintenance`, and add these children (`maintenance.json` in this folder shows the same thing; you can also use
**⋮ → Import JSON** on the `maintenance` node):

| key | value | meaning |
| --- | --- | --- |
| `enabled` | `false` | **`true` = maintenance page ON, `false` = site normal** |
| `title` | `We'll be right back` | headline |
| `message` | `ThyAnime is down for maintenance…` | text under it |
| `eta` | `` (e.g. `tonight 9 PM`) | optional "Expected back" pill |

Flip `enabled` in the console and every open tab switches within a couple of seconds. No redeploy.

## 4. Site banner (announcement bar)
Under `config`, add a `banner` node with these children (`banner.json` in this folder shows the same thing; **⋮ → Import JSON** works too):

| key | value | meaning |
| --- | --- | --- |
| `Text` | `Welcome to ThyAnime` | the message shown across the top of the site |
| `Text2` … `Text5` | `` (blank) | extra messages, only used when `rotations` is `true` |
| `Visible` | `true` | **`true` = banner shown, `false` = hidden** |
| `rotations` | `false` | **`false` = only `Text` is shown. `true` = cycle through `Text`, `Text2`, `Text3`… every 10 seconds** |

- With `rotations` on, any message that is blank is skipped, and after the last one it loops back to the first.
  If only one message is filled in, it just stays up (nothing to rotate).
- With `rotations` off, `Text2`–`Text5` are ignored: only `Text` (the one without a number) is shown.
- You can add `Text6`, `Text7`… the same way if you ever need more.
- Flip `Visible` / `rotations` or edit any text and every open tab updates within a couple of seconds. No redeploy.
- The banner hides if there is nothing to show. Visitors can close it with the X: it stays closed for **1 hour** in that browser (even across tabs and reloads) and then comes back by itself. To change the length, edit `DISMISS_MS` in `components/Banner.js`.
The maintenance node keeps working as before (`config/maintenance`).

## Admin bypass
Set the GitHub repo Variable **ADMIN_EMAILS** (Settings → Secrets and variables → Actions → Variables) to your Google email(s),
comma separated. While maintenance is ON you can open the site, click the small **Admin sign in** link on the maintenance page,
and you'll see the real site (with an orange "Maintenance mode is ON" pill so you don't forget).

## Force maintenance without Firebase
Repo Variable **MAINTENANCE = `true`** and re-run the deploy → maintenance is ON no matter what the database says.
Remove/empty it to go back to the console toggle.

## Family accounts (profiles)
- **Create:** `/signup/` → *Create family account* (username + password + your profile name). **Sign in:** `/login/`.
- After a family sign-in the site shows **“Who’s watching?”** every time a new browser session starts (and from the avatar menu → *Switch profile*). Up to **5 profiles** (enforced by the site, not the database rules); the first one can’t be deleted.
- **Manage profiles** (pencil): rename, change avatar, delete, and **link a Google account** to a profile. That person can then press *Continue with Google* on the Sign in page and land straight in their own profile — no password to share.
- Each profile has its own watch history and settings (server / sub-dub / source) under `families/<familyUid>/profiles/<id>`.
- Plain Google accounts (no family) work exactly like before, and can now rename themselves (avatar menu → *Edit name*).
- If a profile list shows “database rules haven’t been updated”, re-paste `database.rules.json` (step 2) and **Publish**.

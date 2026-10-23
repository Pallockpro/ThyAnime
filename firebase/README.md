# Firebase setup (one time, ~3 minutes)

Project: `thyanime-88d67` → https://console.firebase.google.com/project/thyanime-88d67

## 1. Turn on Google sign-in
**Build → Authentication → Get started → Sign-in method → Google → Enable → Save.**

Then **Authentication → Settings → Authorized domains → Add domain** and add every address the site runs on, e.g.
your custom domain (the one in your `CNAME` file) and `pallockpro.github.io`. (`localhost` is already there.)
If you skip this, sign-in shows "This domain isn't authorised".

## 2. Paste the database rules
**Build → Realtime Database → Rules** → replace everything with `firebase/database.rules.json` → **Publish**.
- `config/*` is publicly readable (so visitors can see the maintenance flag) and only writable from the console.
- `presence/*` powers the **Live visitors** counter in Settings: each open tab writes a tiny entry that the server deletes automatically when the tab closes.
- `users/<uid>/settings` and `users/<uid>/history` (settings + "Continue watching") are readable/writable only by that signed-in user.

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
- The banner hides if there is nothing to show. Visitors can close it (it stays closed for that browser session, and comes back if you change any of the texts).
The maintenance node keeps working as before (`config/maintenance`).

## Admin bypass
Set the GitHub repo Variable **ADMIN_EMAILS** (Settings → Secrets and variables → Actions → Variables) to your Google email(s),
comma separated. While maintenance is ON you can open the site, click the small **Admin sign in** link on the maintenance page,
and you'll see the real site (with an orange "Maintenance mode is ON" pill so you don't forget).

## Force maintenance without Firebase
Repo Variable **MAINTENANCE = `true`** and re-run the deploy → maintenance is ON no matter what the database says.
Remove/empty it to go back to the console toggle.

# Player Avatar Photos — Design

## Context

Every avatar in the app today is a colored circle with the person's initial — there's no way to actually recognize teammates at a glance. The ask: let a player upload a profile photo, shown everywhere that circle currently appears (Profile, the mix "bolinhas" roster, Rankings, player details, Admin's member list).

No Storage bucket exists in this project yet — this is the first feature to use Supabase Storage.

## Data model

- `profiles.avatar_url TEXT` (nullable) — the full public URL of the photo, or `NULL` for "no photo, show the initial."
- New Storage bucket `avatars`, **public** (read). Profile photos aren't sensitive, and public read means every `<img src>` just works with no signed-URL refresh logic anywhere.
- One object per person, fixed path: `avatars/<user_id>/avatar.jpg`. A re-upload overwrites in place (`upsert: true`) — no accumulation of old files, no cleanup job needed.
- Cache-busting: since the path never changes across re-uploads, a browser could keep showing a stale cached image after someone changes their photo. The URL saved to `profiles.avatar_url` gets a `?v=<timestamp>` query string appended at upload time, so a new photo always gets a new URL.

### Storage policies (on `storage.objects`, scoped to `bucket_id = 'avatars'`)

- **SELECT**: public — anyone (including anon) can read.
- **INSERT / UPDATE / DELETE**: only the authenticated owner, enforced via the folder-name convention: `(storage.foldername(name))[1] = auth.uid()::text`. This is why the path is `<user_id>/avatar.jpg` and not a flat `<user_id>.jpg` — `storage.foldername()` needs an actual folder segment to check against.

## Upload flow

1. In `Profile.jsx`, the existing avatar circle (in the hero, at the top of the page) becomes tappable — a small camera-icon badge overlaid at its bottom-right signals this. Tapping opens the OS's native file picker (`<input type="file" accept="image/*">`, hidden, triggered via a ref) — no custom camera UI, no new dependency.
2. On file selection, before upload: resize/compress client-side via an off-screen `<canvas>` (`src/lib/compressImage.js`, new) — max dimension 480px, JPEG quality 0.85. This is a phone-camera app; without this step people would routinely upload 3-10MB HEIC/JPEG photos for what renders as a ~40px circle. Uses `createImageBitmap` + canvas only, no new npm package. A file over 15MB is rejected before even attempting compression (guard against hanging the browser on something absurd).
3. Upload the compressed blob to `avatars/<user_id>/avatar.jpg` with `upsert: true`, get the public URL, append the cache-busting query param, and save it via the existing `updateProfile({ avatar_url })` (already used for other profile fields).
4. A "Remover foto" text action appears once `profile.avatar_url` is set — deletes the Storage object and sets `avatar_url` back to `NULL`.
5. Upload/remove both show a brief loading state on the avatar circle (reusing the pattern already used elsewhere in this file for async actions) and surface failures inline, same style as the existing phone-number field's error handling in this same page.

Only the account's own photo is ever editable — there is no admin-upload-for-someone-else path in this pass.

## Rendering: one shared `Avatar` component

New `Avatar` component in `src/components/ui.jsx`: shows the photo if `url` is present, otherwise the existing colored-circle-with-initial fallback. Each call site keeps its own current size and fallback color (`bg-court-600 text-white` in most places, `bg-volt-400 text-court-900` in Profile's hero) — this component only unifies the photo-vs-initial *logic*, not the visual style, so nothing existing shifts in appearance for anyone without a photo yet.

```
Avatar({ name, url, size, colorClass })
```

Replaces the hand-rolled circle+initial markup in all of these (confirmed exact locations):

- `src/components/ui.jsx` — `PlayerAvatarRow` (the mix "bolinhas"), which is what `MixCard` (Home, Rankings' Mixes tab) and `GameDetails.jsx`'s hero both use.
- `src/pages/Profile.jsx` — both the normal and guest hero avatars.
- `src/pages/Rankings.jsx` — the expandable player list.
- `src/pages/PlayerDetails.jsx` — the page hero only (see exception below).
- `src/pages/GameDetails.jsx` — the pre-mix "Jogadores" list.
- `src/pages/Admin.jsx` — the members list.

**Exception, deliberately out of scope for this pass:** `PlayerDetails.jsx`'s head-to-head opponent row gets its name from the `mix_head_to_head` RPC (`supabase/schema.sql`), not a `profiles` select. Adding `avatar_url` there means changing that function's `RETURNS TABLE` column list, which Postgres requires dropping and recreating the function for (not just `CREATE OR REPLACE`) — a bigger, separate change for one secondary spot. That row keeps showing an initial for now.

## Query changes

`avatar_url` needs adding to every `profiles` fetch that feeds one of the swapped render sites:

- `src/contexts/AuthContext.jsx` — already `select('*')` on `profiles`; no change needed, `avatar_url` comes along automatically.
- `src/pages/Rankings.jsx` — two selects: the membership-map query (`profile:profiles(name)` → `profile:profiles(name, avatar_url)`) and the mixes query (`user:profiles!participants_user_id_fkey (name)` / `partner:...` → add `avatar_url` to both).
- `src/pages/PlayerDetails.jsx` — `supabase.from('profiles').select('id, name')` → add `avatar_url`.
- `src/pages/GameDetails.jsx` — the participants query's `user:profiles!participants_user_id_fkey (id, name, preferred_side)` / `partner:...` → add `avatar_url` to both.
- `src/pages/Admin.jsx` — `profile:profiles(*)` already selects every column; no change needed.
- `src/pages/Home.jsx` — the games query's `user:profiles!participants_user_id_fkey (name)` / `partner:...` → add `avatar_url` to both.

## Files touched

- `supabase/migration_add_avatar_url.sql` (new) — `profiles.avatar_url` column + bucket creation + 4 storage policies.
- `supabase/schema.sql` — same additions, for fresh installs.
- `src/lib/compressImage.js` (new) — canvas-based resize/compress helper.
- `src/lib/avatarStorage.js` (new) — `uploadAvatar(userId, file)` and `removeAvatar(userId)`, wrapping the Storage calls + cache-busting URL construction.
- `src/components/ui.jsx` — new `Avatar` component; `PlayerAvatarRow` updated to use it and to accept `avatar_url` per player.
- `src/pages/Profile.jsx` — tappable avatar, hidden file input, camera badge, remove action, loading/error states.
- `src/pages/Rankings.jsx`, `src/pages/PlayerDetails.jsx`, `src/pages/GameDetails.jsx`, `src/pages/Admin.jsx` — swap hand-rolled circles for `Avatar`; add `avatar_url` to the queries listed above.
- `src/pages/Home.jsx` — query change only (rendering is entirely inside `MixCard`/`PlayerAvatarRow`, already covered by the `ui.jsx` change).

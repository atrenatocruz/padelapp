# Player Avatar Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player upload a profile photo (shown wherever the app currently shows a colored circle with their initial), backed by a new Supabase Storage bucket.

**Architecture:** One Storage bucket (`avatars`, public read), one new `profiles.avatar_url` column holding the full public URL. Client-side canvas compression before upload keeps files small. A single new `Avatar` component centralizes the "photo if present, else initial" logic; every existing avatar-circle call site swaps to it and gets `avatar_url` added to its data fetch.

**Tech Stack:** React (Vite), Supabase (Postgres + RLS + Storage), Tailwind, native browser Canvas/`createImageBitmap` (no new npm dependency).

## Global Constraints

- No JS test framework exists in this repo — verification is `npx vite build` (compile-time correctness) plus manual click-through in the browser, matching every other feature in this codebase.
- SQL migrations are applied by the user manually in the Supabase SQL Editor — writing/committing the `.sql` file is the deliverable; running it is a separate manual step, called out explicitly.
- Portuguese user-facing copy throughout, matching the rest of the app.
- Only the account's own photo is ever editable in this pass — no admin-upload-for-someone-else path.
- `PlayerDetails.jsx`'s head-to-head opponent row (fed by the `mix_head_to_head` RPC, not a `profiles` select) is explicitly OUT of scope for this pass — do not touch that RPC's return signature.

---

## Task 1: Database migration — avatar_url column + Storage bucket + policies

**Files:**
- Create: `supabase/migration_add_avatar_url.sql`
- Modify: `supabase/schema.sql`

**Interfaces:**
- Produces: `profiles.avatar_url` (TEXT, nullable); Storage bucket `avatars` (public); 4 RLS policies on `storage.objects` scoped to `bucket_id = 'avatars'`. Every later task reads/writes `profiles.avatar_url` and uploads to path `<user_id>/avatar.jpg` in this bucket.

- [ ] **Step 1: Write the migration file**

```sql
-- ════════════════════════════════════════════════════════════════════════
-- Player avatar photos: profiles.avatar_url + the `avatars` Storage bucket.
--
-- Public bucket (read) — profile photos aren't sensitive, and public read
-- means every <img src> just works with no signed-URL refresh logic
-- anywhere in the app. Upload/replace/delete is restricted to the file's
-- own owner via the folder-name convention: each person's photo lives at
-- avatars/<user_id>/avatar.jpg, so (storage.foldername(name))[1] is their
-- user_id — this is why a flat <user_id>.jpg path wouldn't work here,
-- storage.foldername() needs an actual folder segment to check against.
--
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 2: Add the same column to `schema.sql`, for fresh installs**

In `supabase/schema.sql`, find the `profiles` table definition:

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  birthday DATE,
  gender TEXT,
  phone_hash TEXT,
  preferred_side TEXT NOT NULL DEFAULT 'both' CHECK (preferred_side IN ('left', 'right', 'both')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
```

Replace with:

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  birthday DATE,
  gender TEXT,
  phone_hash TEXT,
  avatar_url TEXT,
  preferred_side TEXT NOT NULL DEFAULT 'both' CHECK (preferred_side IN ('left', 'right', 'both')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
```

- [ ] **Step 3: Add the bucket + policies to `schema.sql` too**

At the very end of `supabase/schema.sql`, append:

```sql

-- ════════════════════════════════════════════════════════════════════════
-- Storage: player avatar photos (public read, owner-only write — see
-- migration_add_avatar_url.sql for the full rationale)
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 4: Verify both files by re-reading them**

Confirm: `migration_add_avatar_url.sql` has a `DROP POLICY IF EXISTS` immediately before each `CREATE POLICY` (safe to re-run), the `ALTER TABLE` uses `IF NOT EXISTS`, and the bucket insert uses `ON CONFLICT (id) DO NOTHING`. Confirm `schema.sql`'s `profiles` table now has `avatar_url TEXT` and the new Storage section appears once, at the end of the file.

- [ ] **Step 5: Commit**

```bash
git add supabase/migration_add_avatar_url.sql supabase/schema.sql
git commit -m "Add avatar_url column and avatars Storage bucket"
```

**Note for whoever runs this in production:** this migration needs to be run manually in Supabase → SQL Editor before Task 4 (upload UI) will work — nothing in the app uses `avatar_url` until then, so there's no urgency to run it before that.

---

## Task 2: Client-side compression + Storage upload helpers

**Files:**
- Create: `src/lib/compressImage.js`
- Create: `src/lib/avatarStorage.js`

**Interfaces:**
- Produces: `compressImage(file, options?) => Promise<Blob>` (JPEG blob, options default `{ maxSize: 480, quality: 0.85 }`). `uploadAvatar(userId, file) => Promise<string>` (resolves to a cache-busted public URL, ready to save into `profiles.avatar_url`). `removeAvatar(userId) => Promise<void>`. Task 4 (Profile.jsx) calls `uploadAvatar`/`removeAvatar` directly; neither is called anywhere else in this plan.
- Consumes: `supabase` client from `src/lib/supabase.js` (existing); the `avatars` bucket from Task 1.

- [ ] **Step 1: Write `compressImage.js`**

```js
/**
 * Resizes+compresses an image file client-side before upload — phone
 * camera photos are routinely 3-10MB for what renders as a ~40px circle.
 * Uses only native browser APIs (createImageBitmap + canvas), no new
 * dependency. Returns a JPEG Blob.
 */
export async function compressImage(file, { maxSize = 480, quality = 0.85 } = {}) {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Imagem demasiado grande (máx. 15MB)')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao comprimir a imagem'))),
      'image/jpeg',
      quality
    )
  })
}
```

- [ ] **Step 2: Write `avatarStorage.js`**

```js
import { supabase } from './supabase'
import { compressImage } from './compressImage'

const BUCKET = 'avatars'

function avatarPath(userId) {
  return `${userId}/avatar.jpg`
}

/**
 * Compresses, uploads (overwriting any previous photo at the same fixed
 * path), and returns a cache-busted public URL to save onto
 * profiles.avatar_url. Without the ?v= query param, a browser could keep
 * showing a stale cached image after someone changes their photo, since
 * the underlying path never changes.
 */
export async function uploadAvatar(userId, file) {
  const blob = await compressImage(file)
  const path = avatarPath(userId)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

export async function removeAvatar(userId) {
  const { error } = await supabase.storage.from(BUCKET).remove([avatarPath(userId)])
  if (error) throw error
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors (neither file has a caller yet, so this only proves both are syntactically valid and free of import errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/compressImage.js src/lib/avatarStorage.js
git commit -m "Add image compression and avatar upload helpers"
```

---

## Task 3: `Avatar` component + `PlayerAvatarRow`/`MixCard` wiring

**Files:**
- Modify: `src/components/ui.jsx`

**Interfaces:**
- Produces: `Avatar({ name, url, size, colorClass })` — `size` is a Tailwind class string covering width/height/text-size and any extra utility classes a call site needs (e.g. a ring or `relative`); `colorClass` is the fallback bg/text pair shown when `url` is falsy. Defaults: `size = 'w-10 h-10 text-sm'`, `colorClass = 'bg-court-600 text-white'`. Every later task in this plan (Task 4, Task 5) renders avatars through this component with this exact signature.
- Modifies: `PlayerAvatarRow({ players, max, size, cap })` — `players` items now read an `avatar_url` field (in addition to the existing `id`/`name`); `MixCard`'s internal `players` array (which feeds `PlayerAvatarRow`) is updated to carry it through from `p.user`/`p.partner`.

- [ ] **Step 1: Add the `Avatar` component**

In `src/components/ui.jsx`, directly above the `/* ─── PlayerAvatarRow ─── */` comment block, add:

```jsx
/* ─── Avatar ─────────────────────────────────────────────────────────────
   Shows the person's photo when they have one, otherwise the existing
   colored-circle-with-initial. `size` carries width/height/text-size (and
   any extra utility classes a call site needs, e.g. a ring); `colorClass`
   is the fallback bg/text pair — each call site keeps its own current
   look for people with no photo yet. */
export function Avatar({ name, url, size = 'w-10 h-10 text-sm', colorClass = 'bg-court-600 text-white' }) {
  const base = `${size} rounded-full flex items-center justify-center shrink-0 font-extrabold overflow-hidden`
  if (url) {
    return <img src={url} alt={name || ''} className={`${base} object-cover`} />
  }
  return <div className={`${base} ${colorClass}`}>{(name || '?').charAt(0).toUpperCase()}</div>
}
```

- [ ] **Step 2: Use `Avatar` inside `PlayerAvatarRow`**

Find:

```jsx
export function PlayerAvatarRow({ players = [], max = 4, size = 'md', cap = 6 }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-sm'
  const shown = players.slice(0, cap)
  const overflow = players.length - shown.length
  // only show empty slots when nothing is hidden (small games)
  const empty = overflow > 0 ? 0 : Math.max(0, Math.min(max - players.length, cap - shown.length))
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-2">
        {shown.map((p, i) => (
          <div
            key={p.id || i}
            title={p.name}
            style={{ zIndex: cap - i }}
            className={`${dim} relative rounded-full bg-court-600 text-white font-extrabold
                        flex items-center justify-center ring-2 ring-surface`}
          >
            {(p.name || '?').charAt(0).toUpperCase()}
          </div>
        ))}
```

Replace with:

```jsx
export function PlayerAvatarRow({ players = [], max = 4, size = 'md', cap = 6 }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-sm'
  const shown = players.slice(0, cap)
  const overflow = players.length - shown.length
  // only show empty slots when nothing is hidden (small games)
  const empty = overflow > 0 ? 0 : Math.max(0, Math.min(max - players.length, cap - shown.length))
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-2">
        {shown.map((p, i) => (
          <div key={p.id || i} title={p.name} style={{ zIndex: cap - i }} className="relative">
            <Avatar name={p.name} url={p.avatar_url} size={`${dim} ring-2 ring-surface`} />
          </div>
        ))}
```

- [ ] **Step 3: Carry `avatar_url` through `MixCard`'s `players` array**

Find (inside `MixCard`, a few lines below `PlayerAvatarRow`'s closing `}`):

```jsx
  const players = (game.participants || [])
    .filter(p => p.status === 'confirmed')
    .flatMap(p => [
      { id: p.user_id, name: p.user?.name, level: p.user?.level, isGuest: p.user?.is_guest },
      ...(p.partner_id ? [{ id: p.partner_id, name: p.partner?.name, level: p.partner?.level, isGuest: p.partner?.is_guest }] : []),
    ])
```

Replace with:

```jsx
  const players = (game.participants || [])
    .filter(p => p.status === 'confirmed')
    .flatMap(p => [
      { id: p.user_id, name: p.user?.name, level: p.user?.level, isGuest: p.user?.is_guest, avatar_url: p.user?.avatar_url },
      ...(p.partner_id ? [{ id: p.partner_id, name: p.partner?.name, level: p.partner?.level, isGuest: p.partner?.is_guest, avatar_url: p.partner?.avatar_url }] : []),
    ])
```

- [ ] **Step 4: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors.

- [ ] **Step 5: Manual verification in the browser**

Run `npm run dev`, open the Home page (Jogos tab) with an existing mix that has players signed up. Confirm the "bolinhas" row still shows colored circles with initials exactly as before (no one has a photo yet, so this just proves the refactor didn't change existing behavior).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui.jsx
git commit -m "Add Avatar component, wire it into PlayerAvatarRow/MixCard"
```

---

## Task 4: Upload UI on the Profile page

**Files:**
- Modify: `src/pages/Profile.jsx`

**Interfaces:**
- Consumes: `Avatar` from `../components/ui` (Task 3); `uploadAvatar`/`removeAvatar` from `../lib/avatarStorage` (Task 2).

- [ ] **Step 1: Add the new imports**

Find:

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Award, Trophy, Target, Flame, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { hashPhone } from '../lib/hashPhone'
import { PrimaryButton, LevelBadge, GuestBadge, DateField } from '../components/ui'
```

Replace with:

```jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Award, Trophy, Target, Flame, LogOut, Camera } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { hashPhone } from '../lib/hashPhone'
import { uploadAvatar, removeAvatar } from '../lib/avatarStorage'
import { PrimaryButton, LevelBadge, GuestBadge, DateField, Avatar } from '../components/ui'
```

- [ ] **Step 2: Add upload/remove state and handlers**

Find:

```jsx
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
```

Replace with:

```jsx
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const fileInputRef = useRef(null)
```

Directly below `loadStats` (after its closing `}`), add:

```jsx
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setPhotoError('')
    setUploadingPhoto(true)
    try {
      const avatar_url = await uploadAvatar(profile.id, file)
      const { error } = await updateProfile({ avatar_url })
      if (error) throw error
    } catch (error) {
      console.error('Error uploading photo:', error)
      setPhotoError('Não foi possível carregar a foto. Tenta novamente.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleRemovePhoto = async () => {
    setPhotoError('')
    setUploadingPhoto(true)
    try {
      await removeAvatar(profile.id)
      const { error } = await updateProfile({ avatar_url: null })
      if (error) throw error
    } catch (error) {
      console.error('Error removing photo:', error)
      setPhotoError('Não foi possível remover a foto. Tenta novamente.')
    } finally {
      setUploadingPhoto(false)
    }
  }
```

- [ ] **Step 3: Swap the guest-view hero avatar to `Avatar` (read-only — guests have no edit UI anywhere in this file)**

Find:

```jsx
          <div className="relative py-2">
            <div className="w-20 h-20 bg-volt-400 text-court-900 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl font-extrabold">
              {profile?.name?.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl text-white">
              {profile?.name} <span className="text-court-200 font-normal">(Convidado)</span>
            </h2>
```

Replace with:

```jsx
          <div className="relative py-2">
            <div className="w-20 h-20 mx-auto mb-3">
              <Avatar name={profile?.name} url={profile?.avatar_url} size="w-20 h-20 text-3xl" colorClass="bg-volt-400 text-court-900" />
            </div>
            <h2 className="text-2xl text-white">
              {profile?.name} <span className="text-court-200 font-normal">(Convidado)</span>
            </h2>
```

- [ ] **Step 4: Make the main hero avatar tappable, with upload/remove UI**

Find:

```jsx
        <div className="relative py-2">
          <div className="w-20 h-20 bg-volt-400 text-court-900 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl font-extrabold">
            {profile?.name?.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl text-white">{profile?.name}</h2>
          <div className="mt-2.5">
            <LevelBadge level={currentMembership?.level} me size="md" />
          </div>
        </div>
      </div>

      {saved && (
        <div className="bg-ok/10 text-ok px-4 py-3 rounded-ctrl text-sm font-extrabold animate-fade-up">
          ✓ Perfil atualizado
        </div>
      )}
```

Replace with:

```jsx
        <div className="relative py-2">
          <div className="relative w-20 h-20 mx-auto mb-3">
            <Avatar name={profile?.name} url={profile?.avatar_url} size="w-20 h-20 text-3xl" colorClass="bg-volt-400 text-court-900" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              aria-label="Alterar foto de perfil"
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-court-900 text-white flex items-center justify-center
                         ring-2 ring-court-900 hover:bg-court-700 transition-colors duration-fast disabled:opacity-50"
            >
              {uploadingPhoto ? (
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera size={14} />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>
          <h2 className="text-2xl text-white">{profile?.name}</h2>
          <div className="mt-2.5">
            <LevelBadge level={currentMembership?.level} me size="md" />
          </div>
          {profile?.avatar_url && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={uploadingPhoto}
              className="mt-2 text-court-200 text-xs font-extrabold hover:text-white transition-colors duration-fast disabled:opacity-50"
            >
              Remover foto
            </button>
          )}
        </div>
      </div>

      {photoError && (
        <div className="bg-danger/10 text-danger px-4 py-3 rounded-ctrl text-sm font-extrabold animate-fade-up">
          {photoError}
        </div>
      )}

      {saved && (
        <div className="bg-ok/10 text-ok px-4 py-3 rounded-ctrl text-sm font-extrabold animate-fade-up">
          ✓ Perfil atualizado
        </div>
      )}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors.

- [ ] **Step 6: Manual verification in the browser**

Requires Task 1's migration already applied. Run `npm run dev`, open Perfil:
1. Tap the avatar circle → the OS file picker opens.
2. Pick a photo → a brief spinner shows on the camera badge, then the circle shows the actual photo.
3. Refresh the page → the photo persists (confirms `avatar_url` was saved and is being read back).
4. Tap "Remover foto" → back to the colored initial circle.
5. Pick a very large photo (multi-MB, e.g. straight from a phone camera) → confirm it still uploads quickly (compression working) and check in Supabase Storage that the stored file is small (tens of KB, not MB).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Profile.jsx
git commit -m "Add profile photo upload/remove UI"
```

---

## Task 5: Show photos everywhere else an initial circle appears today

**Files:**
- Modify: `src/pages/Rankings.jsx`
- Modify: `src/pages/PlayerDetails.jsx`
- Modify: `src/pages/GameDetails.jsx`
- Modify: `src/pages/Admin.jsx`
- Modify: `src/pages/Home.jsx`

**Interfaces:**
- Consumes: `Avatar` from `../components/ui` (Task 3).

- [ ] **Step 1: `Rankings.jsx` — import `Avatar`**

Find:

```jsx
import { LevelBadge, EmptyState, MixCard } from '../components/ui'
```

Replace with:

```jsx
import { LevelBadge, EmptyState, MixCard, Avatar } from '../components/ui'
```

- [ ] **Step 2: `Rankings.jsx` — add `avatar_url` to the membership-map select and carry it into the player list**

Find:

```jsx
  const loadMembershipMap = async () => {
    const { data, error } = await supabase
      .from('memberships')
      .select('user_id, is_guest, level, profile:profiles(name)')
      .eq('organization_id', currentOrganizationId)
```

Replace with:

```jsx
  const loadMembershipMap = async () => {
    const { data, error } = await supabase
      .from('memberships')
      .select('user_id, is_guest, level, profile:profiles(name, avatar_url)')
      .eq('organization_id', currentOrganizationId)
```

Find:

```jsx
        .map(([userId, m]) => ({ id: userId, name: m.profile?.name || 'Jogador', level: m.level }))
```

Replace with:

```jsx
        .map(([userId, m]) => ({ id: userId, name: m.profile?.name || 'Jogador', level: m.level, avatar_url: m.profile?.avatar_url }))
```

- [ ] **Step 3: `Rankings.jsx` — add `avatar_url` to the mixes query**

Find:

```jsx
          .select(`
            *,
            participants (
              id, user_id, partner_id, status,
              user:profiles!participants_user_id_fkey (name),
              partner:profiles!participants_partner_id_fkey (name)
            )
          `)
```

Replace with:

```jsx
          .select(`
            *,
            participants (
              id, user_id, partner_id, status,
              user:profiles!participants_user_id_fkey (name, avatar_url),
              partner:profiles!participants_partner_id_fkey (name, avatar_url)
            )
          `)
```

- [ ] **Step 4: `Rankings.jsx` — swap the player-list avatar circle**

Find:

```jsx
                      <div className="w-9 h-9 bg-court-600 text-white rounded-full flex items-center justify-center font-extrabold text-sm shrink-0">
                        {(p.name || '?').charAt(0).toUpperCase()}
                      </div>
```

Replace with:

```jsx
                      <Avatar name={p.name} url={p.avatar_url} size="w-9 h-9 text-sm" />
```

- [ ] **Step 5: `PlayerDetails.jsx` — import `Avatar` and add `avatar_url` to the profile select**

Find:

```jsx
import { PrimaryButton, LevelBadge, EmptyState } from '../components/ui'
```

Replace with:

```jsx
import { PrimaryButton, LevelBadge, EmptyState, Avatar } from '../components/ui'
```

Find:

```jsx
        supabase.from('profiles').select('id, name').eq('id', id).single(),
```

Replace with:

```jsx
        supabase.from('profiles').select('id, name, avatar_url').eq('id', id).single(),
```

- [ ] **Step 6: `PlayerDetails.jsx` — swap the hero avatar circle**

Find:

```jsx
          <div className="w-20 h-20 bg-volt-400 text-court-900 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl font-extrabold">
            {player.name?.charAt(0).toUpperCase()}
          </div>
```

Replace with:

```jsx
          <div className="w-20 h-20 mx-auto mb-3">
            <Avatar name={player.name} url={player.avatar_url} size="w-20 h-20 text-3xl" colorClass="bg-volt-400 text-court-900" />
          </div>
```

(The head-to-head opponent avatar further down this file, fed by the `mix_head_to_head` RPC, is deliberately left untouched — see this plan's Global Constraints.)

- [ ] **Step 7: `GameDetails.jsx` — add `avatar_url` to the participants query**

Find:

```jsx
        .select(`
          *,
          user:profiles!participants_user_id_fkey (id, name, preferred_side),
          partner:profiles!participants_partner_id_fkey (id, name, preferred_side)
        `)
```

Replace with:

```jsx
        .select(`
          *,
          user:profiles!participants_user_id_fkey (id, name, preferred_side, avatar_url),
          partner:profiles!participants_partner_id_fkey (id, name, preferred_side, avatar_url)
        `)
```

- [ ] **Step 8: `GameDetails.jsx` — import `Avatar`**

Find:

```jsx
import { PrimaryButton, LevelBadge, GuestBadge, PlayerAvatarRow, EmptyState, ShareModal, RoundTimer } from '../components/ui'
```

Replace with:

```jsx
import { PrimaryButton, LevelBadge, GuestBadge, PlayerAvatarRow, EmptyState, ShareModal, RoundTimer, Avatar } from '../components/ui'
```

- [ ] **Step 9: `GameDetails.jsx` — carry `avatar_url` into the `PlayerAvatarRow` call**

Find:

```jsx
          <PlayerAvatarRow
            players={people.map(p => ({ id: p.id, name: p.name }))}
            max={capacity}
          />
```

Replace with:

```jsx
          <PlayerAvatarRow
            players={people.map(p => ({ id: p.id, name: p.name, avatar_url: p.avatar_url }))}
            max={capacity}
          />
```

- [ ] **Step 10: `GameDetails.jsx` — swap the pre-mix "Jogadores" list avatar circle**

Find:

```jsx
                  <div className="w-10 h-10 bg-court-600 text-white rounded-full flex items-center justify-center font-extrabold shrink-0">
                    {person.name?.charAt(0).toUpperCase()}
                  </div>
```

Replace with:

```jsx
                  <Avatar name={person.name} url={person.avatar_url} size="w-10 h-10 text-sm" />
```

- [ ] **Step 11: `Admin.jsx` — import `Avatar` and carry `avatar_url` into the members list**

Find:

```jsx
import { DateTimeField } from '../components/ui'
```

Replace with:

```jsx
import { DateTimeField, Avatar } from '../components/ui'
```

Find:

```jsx
    const merged = (data || [])
      .map((m) => ({
        id: m.user_id,
        name: m.profile?.name || 'Jogador',
        is_admin: m.is_admin,
        is_guest: m.is_guest,
        level: m.level,
      }))
```

Replace with:

```jsx
    const merged = (data || [])
      .map((m) => ({
        id: m.user_id,
        name: m.profile?.name || 'Jogador',
        is_admin: m.is_admin,
        is_guest: m.is_guest,
        level: m.level,
        avatar_url: m.profile?.avatar_url,
      }))
```

(No select change needed here — `profile:profiles(*)` already fetches every column, `avatar_url` included.)

- [ ] **Step 12: `Admin.jsx` — swap the member-list avatar circle**

Find:

```jsx
                    <div className="w-11 h-11 bg-court-600 text-white rounded-full flex items-center justify-center font-extrabold shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
```

Replace with:

```jsx
                    <Avatar name={member.name} url={member.avatar_url} size="w-11 h-11 text-sm" />
```

- [ ] **Step 13: `Home.jsx` — add `avatar_url` to the games query**

Find:

```jsx
        .select(`
          *,
          participants (
            id,
            user_id,
            partner_id,
            status,
            user:profiles!participants_user_id_fkey (name),
            partner:profiles!participants_partner_id_fkey (name)
          )
        `)
```

Replace with:

```jsx
        .select(`
          *,
          participants (
            id,
            user_id,
            partner_id,
            status,
            user:profiles!participants_user_id_fkey (name, avatar_url),
            partner:profiles!participants_partner_id_fkey (name, avatar_url)
          )
        `)
```

(No render change needed in this file — `Home.jsx` only passes `game` to `MixCard`, which already reads `avatar_url` off `p.user`/`p.partner` per Task 3.)

- [ ] **Step 14: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors.

- [ ] **Step 15: Manual verification in the browser**

Requires Task 1's migration applied and at least one account with a photo set (Task 4). Check, for a person who has uploaded a photo:
1. Rankings → Geral tab's expandable player list shows their photo.
2. Rankings → Mixes tab's mix cards show their photo in the bolinhas.
3. Their `/jogador/:id` page shows their photo in the hero.
4. A mix's pre-mix "Jogadores" list (`GameDetails.jsx`) shows their photo.
5. Admin → Membros shows their photo.
6. For everyone else (no photo yet), confirm all of the above still show the colored initial circle exactly as before.

- [ ] **Step 16: Commit**

```bash
git add src/pages/Rankings.jsx src/pages/PlayerDetails.jsx src/pages/GameDetails.jsx src/pages/Admin.jsx src/pages/Home.jsx
git commit -m "Show avatar photos across Rankings, player details, mixes, and Admin"
```


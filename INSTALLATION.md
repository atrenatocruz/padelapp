# 🛠️ Installation Guide - Os Padeleiros

Complete step-by-step installation guide for developers.

---

## Prerequisites

Before starting, ensure you have:

- **Node.js** 18.x or higher ([download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Git** ([download](https://git-scm.com/))
- **Code Editor** (VS Code recommended)
- **Modern Browser** (Chrome, Firefox, Safari, or Edge)

Check versions:
```bash
node --version  # Should be v18.x or higher
npm --version   # Should be v9.x or higher
```

---

## Step 1: Clone or Download

### Option A: Clone with Git
```bash
git clone <your-repo-url>
cd padeleirosrobot
```

### Option B: Download ZIP
1. Download the project ZIP
2. Extract to your desired location
3. Open terminal in that folder

---

## Step 2: Install Dependencies

```bash
npm install
```

This will install:
- React and React DOM
- Vite (build tool)
- TailwindCSS (styling)
- Supabase client
- React Router
- PWA plugin
- Lucide icons

**Time**: ~2-3 minutes depending on internet speed

**Troubleshooting**:
- If errors occur, try: `npm cache clean --force` then retry
- Use `npm install --legacy-peer-deps` if peer dependency issues

---

## Step 3: Set Up Supabase

### 3.1 Create Supabase Account
1. Go to [supabase.com](https://supabase.com)
2. Sign up (free) with GitHub or email
3. Verify your email

### 3.2 Create New Project
1. Click **New Project**
2. Fill in:
   - **Organization**: Create new or select existing
   - **Project Name**: `os-padeleiros`
   - **Database Password**: Create strong password (save it!)
   - **Region**: Select closest (EU West for Portugal)
   - **Pricing**: Free tier is sufficient
3. Click **Create new project**
4. Wait 2-3 minutes for provisioning

### 3.3 Set Up Database Schema

1. Once project is ready, click **SQL Editor** in sidebar
2. Click **New query**
3. Open `supabase/schema.sql` from project folder
4. Copy ALL content (Ctrl+A, Ctrl+C)
5. Paste into Supabase SQL Editor
6. Click **Run** (or press Ctrl+Enter)
7. Check for "Success. No rows returned" message
8. If errors appear, check console and retry

**What this does**:
- Creates all database tables
- Sets up Row Level Security
- Creates database functions
- Inserts default settings

### 3.4 Configure Authentication

#### Enable Email Auth (Recommended)
1. Go to **Authentication** > **Providers** in sidebar
2. Find **Email** provider
3. Toggle **Enable Email provider** ON
4. Settings:
   - ✅ Enable Email provider
   - ❌ Confirm email (turn OFF for ease)
   - ❌ Secure email change (turn OFF for ease)
5. Click **Save**

#### Enable Phone Auth (Optional)
1. In same **Providers** section, find **Phone**
2. Toggle **Enable Phone provider** ON
3. You'll need a Twilio account:
   - Go to [twilio.com](https://www.twilio.com)
   - Sign up and verify
   - Get a phone number
   - Copy Account SID, Auth Token, and Phone Number
4. Paste credentials in Supabase Phone settings
5. Click **Save**

**Note**: Phone auth costs money (Twilio charges). Email is free!

### 3.5 Get API Credentials

1. Go to **Settings** > **API** in sidebar
2. Find **Project URL** - copy it
3. Find **Project API keys** section
4. Copy the **anon/public** key (long string starting with `eyJ...`)

**Important**: Keep these safe! Don't commit to Git.

---

## Step 4: Configure Environment

### 4.1 Create .env File

In the project root, create a file named `.env`:

**On Windows**:
```bash
copy env.example .env
```

**On Mac/Linux**:
```bash
cp env.example .env
```

### 4.2 Add Your Credentials

Open `.env` in your code editor and replace:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

With your actual values from Step 3.5.

**Example**:
```env
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE2...
```

**Save the file**.

---

## Step 5: Start Development Server

```bash
npm run dev
```

You should see:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Open your browser** to [http://localhost:5173](http://localhost:5173)

**Success!** The app should load with the login page.

---

## Step 6: Create First Admin User

### 6.1 Sign Up in the App

1. In the app, choose **Email** tab
2. Enter your email address
3. Click **Receber código**
4. Check your email for the OTP code
5. Enter the 6-digit code
6. Fill in your name
7. Click **Guardar e continuar**

You're now logged in but not yet admin.

### 6.2 Make Yourself Admin

1. Go back to Supabase dashboard
2. Click **Table Editor** in sidebar
3. Click **profiles** table
4. Find your row (by name or email)
5. Click the row to edit
6. Find `is_admin` column, change `false` to `true`
7. Click **Save** or press Enter

### 6.3 Verify Admin Access

1. Go back to the app
2. Refresh the page (F5)
3. You should now see **Admin** icon in bottom navigation
4. Click it to access admin panel

**Congratulations! You're now an admin!** 🎉

---

## Step 7: Test the App

### Test Checklist

Go through these tests:

1. **Authentication**
   - [ ] Sign out
   - [ ] Sign in again with same email
   - [ ] Code arrives quickly

2. **Profile**
   - [ ] Edit profile
   - [ ] Change level
   - [ ] Add phone number

3. **Admin - Create Game**
   - [ ] Go to Admin tab
   - [ ] Click "Criar novo jogo"
   - [ ] Fill in details
   - [ ] Submit

4. **Join Game**
   - [ ] Go back to home
   - [ ] See the game you created
   - [ ] Click "Quero jogar"
   - [ ] Join alone

5. **Create Second User** (in incognito window)
   - [ ] Open app in incognito/private mode
   - [ ] Sign up with different email
   - [ ] Join the same game

6. **Game Closure** (repeat until 4 players)
   - [ ] Create 2 more test users
   - [ ] Have all 4 join the game
   - [ ] Game should auto-close

7. **Submit Results**
   - [ ] Open the closed game
   - [ ] Click "Registar resultado"
   - [ ] Enter scores
   - [ ] Submit

8. **Check Rankings**
   - [ ] Go to Rankings tab
   - [ ] See stats updated

**All working? Perfect!** ✅

---

## Step 8: Customize (Optional)

### Change Group Name

1. Admin panel > Definições tab
2. Change "Os Padeleiros" to your group name
3. Click Guardar

### Add Logo

1. Create/find your group logo
2. Follow instructions in `public/ICONS_README.md`
3. Replace icon files in `public/` folder
4. Restart dev server

### Customize Colors

Edit `tailwind.config.js`:

```javascript
colors: {
  apple: {
    blue: '#007AFF',    // Change to your primary color
    gray: '#F5F5F7',
    darkgray: '#1D1D1F',
  }
}
```

---

## Troubleshooting

### "Supabase not configured" Error

**Problem**: Environment variables not loaded

**Solution**:
1. Check `.env` file exists in root
2. Check variables start with `VITE_`
3. Restart dev server after changing `.env`
4. Hard refresh browser (Ctrl+F5)

### "Failed to fetch" Error

**Problem**: Can't connect to Supabase

**Solution**:
1. Check Supabase project is active (green status)
2. Verify URL in `.env` is correct
3. Check internet connection
4. Check Supabase status page

### OTP Code Not Arriving

**Problem**: Email not received

**Solution**:
1. Check spam folder
2. Wait 1-2 minutes
3. Try different email provider (Gmail works well)
4. Check Supabase logs: Logs > API Logs

### "relation does not exist" Error

**Problem**: Database tables not created

**Solution**:
1. Go back to Step 3.3
2. Re-run the entire `schema.sql`
3. Check SQL Editor for error messages
4. Make sure to run ALL of the SQL, not just part

### Port Already in Use

**Problem**: Another app using port 5173

**Solution**:
```bash
# Kill the process or use different port
npm run dev -- --port 3000
```

### Node Version Issues

**Problem**: "engine node incompatible"

**Solution**:
1. Update Node.js to v18 or higher
2. Use nvm to manage versions:
```bash
nvm install 18
nvm use 18
```

---

## Development Tips

### Hot Reload

Vite automatically reloads when you save files. No restart needed!

### Console Logs

Open browser DevTools (F12) to see:
- React errors
- Network requests
- Console logs

### Database Changes

After changing `schema.sql`:
1. Go to Supabase SQL Editor
2. Run updated SQL
3. May need to drop tables first if structure changed

### Code Editor Setup (VS Code)

Recommended extensions:
- **ES7+ React snippets**: Quick component creation
- **Tailwind CSS IntelliSense**: Autocomplete for classes
- **Prettier**: Code formatting
- **ESLint**: Code linting

---

## Next Steps

Now that your app is running:

1. ✅ **Invite friends**: Share the URL
2. ✅ **Create games**: Test with real data
3. ✅ **Deploy**: Follow [DEPLOYMENT.md](DEPLOYMENT.md)
4. ✅ **Customize**: Make it yours!

---

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Clean install (if issues)
rm -rf node_modules package-lock.json
npm install
```

---

## Getting Help

1. Check [QUICKSTART.md](QUICKSTART.md) for quick answers
2. Check [README.md](README.md) for detailed info
3. Search existing GitHub issues
4. Ask in your group chat
5. Create new GitHub issue with:
   - Error message
   - Steps to reproduce
   - Screenshots

---

**Enjoy your new padel app!** 🎾

For deployment to production, see [DEPLOYMENT.md](DEPLOYMENT.md)



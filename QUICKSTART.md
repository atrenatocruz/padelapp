# ⚡ Quick Start - Os Padeleiros

Get the app running in **5 minutes**!

## 🚀 Super Fast Setup

### Step 1: Install Dependencies (1 min)

```bash
npm install
```

### Step 2: Set up Supabase (2 min)

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. In SQL Editor, paste content from `supabase/schema.sql` and run it
4. Go to Settings > API, copy:
   - Project URL
   - Anon key

### Step 3: Configure Environment (30 sec)

Create `.env` file:

```bash
VITE_SUPABASE_URL=your-project-url-here
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 4: Run the App (30 sec)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Step 5: Create Admin User (1 min)

1. Sign up with email in the app
2. Go to Supabase > Table Editor > profiles
3. Set `is_admin = true` for your user
4. Refresh the app

**Done! You're ready to create games! 🎾**

---

## 📱 Deploy to Production (5 min)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy!

See [DEPLOYMENT.md](DEPLOYMENT.md) for details.

---

## 🆘 Issues?

- Check [README.md](README.md) for detailed setup
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment help
- Check [GUIA_ADMIN_PT.md](GUIA_ADMIN_PT.md) for admin guide

---

**Happy coding! 🚀**



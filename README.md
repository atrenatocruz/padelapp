# Os Padeleiros - Padel Game Management App

A modern, minimalist web/mobile app for managing padel games for friend groups, inspired by Apple's design philosophy.

## 🎯 Features

- **User Authentication**: Simple OTP-based login with email or phone
- **Game Management**: View, join, and manage padel games
- **Partner Matching**: Join alone or with a partner
- **Auto-closure**: Games automatically close when 4 players confirm
- **Results & Rankings**: Submit results and view player rankings
- **Admin Panel**: Complete management interface for admins
- **PWA Support**: Install as a mobile app
- **Portuguese UI**: All text in Portuguese (pt-PT)
- **Apple-like Design**: Clean, minimalist, intuitive interface

## 🚀 Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Supabase (Auth + Database + Real-time)
- **Database**: PostgreSQL (via Supabase)
- **Deployment**: Vercel (Frontend) + Supabase (Backend)
- **PWA**: Vite PWA Plugin

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Vercel account (optional, for deployment)

## 🛠️ Installation & Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd padeleirosrobot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the `supabase/schema.sql` file
3. Enable **Email Auth** and/or **Phone Auth** in Authentication settings
4. Get your project URL and anon key from **Settings > API**

### 4. Configure environment variables

Create a `.env` file in the root directory (copy from `env.example`):

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 5. Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 6. Create the first admin user

1. Sign up through the app
2. Go to Supabase Dashboard > Table Editor > profiles
3. Find your user and set `is_admin` to `true`

## 🌐 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

Your app will be available at `https://your-project.vercel.app`

### Alternative: Deploy to Render/Netlify

Both platforms support Vite apps. Just:
1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables

## 📱 PWA Installation

Once deployed, users can install the app on their phones:

- **iOS**: Safari > Share > Add to Home Screen
- **Android**: Chrome > Menu > Install App

## 🔧 Supabase Configuration

### Enable Phone Authentication (Optional)

To use SMS OTP:

1. Go to Supabase Dashboard > Authentication > Providers
2. Enable **Phone** provider
3. Configure Twilio or another SMS provider
4. Add Twilio credentials in Supabase settings

**Note**: Phone auth requires paid Twilio account. For free alternative, use email authentication.

### Enable Email Authentication

Email OTP is free and works out of the box:

1. Go to Supabase Dashboard > Authentication > Providers
2. Enable **Email** provider
3. Customize email templates if desired

## 📊 Database Schema

The app uses the following tables:

- `profiles` - User profiles and settings
- `games` - Game/match information
- `participants` - Game participants
- `results` - Game results
- `player_stats` - Player statistics and rankings
- `settings` - Group settings

All tables include Row Level Security (RLS) policies for data protection.

## 🎨 Customization

### Change Theme Colors

Edit `tailwind.config.js`:

```js
colors: {
  apple: {
    blue: '#007AFF',    // Primary color
    gray: '#F5F5F7',    // Background
    darkgray: '#1D1D1F', // Text
  }
}
```

### Modify Logo

Replace the placeholder logo in:
- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/apple-touch-icon.png`

## 📖 User Guide (Portuguese)

A complete Portuguese user guide is available at `/instrucoes` in the app, covering:
- How to sign up and log in
- How to join games
- How to submit results
- Admin instructions

## 🔐 Security Notes

- All sensitive data is protected by Supabase Row Level Security
- Authentication uses secure OTP codes
- Admin actions are restricted to users with `is_admin` flag
- No passwords stored (OTP-only authentication)

## 🚧 Future Integrations (Placeholders)

The following integrations are prepared but not active:

- **WhatsApp Cloud API**: For game notifications (paid)
- **Twilio SMS**: For SMS notifications (paid)
- **Telegram Bot**: Free alternative for notifications

Environment variables are ready in `env.example`.

## 📞 Support

For issues or questions:
1. Check the Instructions page (`/instrucoes`)
2. Contact the group administrators
3. Open an issue on GitHub

## 📄 License

MIT License - feel free to use and modify for your friend groups!

## 👥 Credits

Built for "Os Padeleiros" padel group.

---

**Note**: This app is designed for small friend groups (10-50 members). For larger communities, consider implementing additional features like multiple courts, payment integration, and advanced scheduling.



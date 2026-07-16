# WhatsApp group bot

Always-on Node process that posts padel mix rosters into a WhatsApp group and lets players reply `In`/`Out` to book/release a spot. Talks to the same Supabase project as the main app, using the service-role key (bypasses RLS — keep it secret, never commit it, never put it in a `VITE_`-prefixed var).

Uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial library that logs in as a real WhatsApp Web device — this is the only way to participate in a group thread (Meta's official Cloud API is 1:1-only and cannot post to or read from groups). Use a spare/secondary phone number for the linked account, not a personal one.

See the root [README setup guide] (or ask the assistant that built this) for the full step-by-step: run the DB migration, deploy to Fly.io, scan the pairing QR, and configure the target group JID.

## Local development

```bash
cd whatsapp-bot
npm install
cp .env.example .env   # fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
npm start
```

On first run it prints a QR code in the terminal — scan it with the bot's WhatsApp (Linked devices). The session is saved to `./baileys-auth/` (gitignored) so you don't need to rescan on every restart.

Once connected, it logs every group the account is in, with its JID — copy the target group's JID into `settings.whatsapp_group_jid` in Supabase.

## Deploying to Fly.io

```bash
fly launch --no-deploy          # creates the app, uses fly.toml
fly volumes create wa_session --size 1
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
fly logs                        # scan the QR shown here (one-time)
```

The Fly volume at `/data` is required — without it, Baileys' session is wiped on every redeploy and you'd have to rescan the QR each time.

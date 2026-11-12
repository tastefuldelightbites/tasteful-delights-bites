# Tasteful Delights Bites — Preorder Website

Next.js site hosted on Vercel, with a Supabase (Postgres) database.

## Settings Vercel needs
- `POSTGRES_URL` — added automatically when Supabase is connected in Vercel → Storage
- `ADMIN_PASSWORD` — the password for `/admin` (you choose it)
- `RESEND_API_KEY` — from resend.com (emails are sent from orders@tastefuldelightsbites.com; the domain is verified in Resend with DNS records on `send` and `resend._domainkey`)

Phone alerts use the free ntfy app: subscribe to the alert name shown in Admin → Settings & Payment.

## First-time setup
1. Log in at `/admin` and tap **Set up my database** (one time only).
2. **Settings & Payment**: enter Cash App, Zelle and Apple Pay, then Save.
3. **Drops**: tap **+ Create a New Drop**, check the dates, then Save.

## Weekly routine
- **Drops** → create the next Drop (opens Wednesday, closes Monday 11:59pm, pickup Saturday).
- **Orders** → mark orders Paid / Picked up / Canceled. **Bake List** totals what to make. **Download Spreadsheet** for records.
- **Menu & Photos** → add, edit, hide, reorder or remove items and upload photos.
- **Custom Requests** → large/custom order requests from the website.

# PepeDrip Site

One-page Next.js + Tailwind site for PepeDrip. Deploy on Vercel.

## Deploy on Vercel (one click)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → Select your repo
3. **Root Directory**: Set to `web` (important!)
4. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_TOKEN_MINT`
   - `NEXT_PUBLIC_TOKEN_SUPPLY`
   - `NEXT_PUBLIC_PUMP_FUN_URL`
   - `NEXT_PUBLIC_X_URL` (optional)
   - `NEXT_PUBLIC_GITHUB_URL` (optional)
5. Deploy

## Local dev

```bash
cd web
npm install
cp .env.example .env.local
# Edit .env.local
npm run dev
```

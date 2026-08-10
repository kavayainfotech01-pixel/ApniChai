# Aapni Chai — Backend (Node.js + Express + MongoDB)

This is a complete backend for the Aapni Chai website: menu/rewards/events/offers
management, live reviews, and the loyalty card system — all backed by MongoDB,
with real-time updates pushed to every visitor via Socket.IO, and secured with
JWT admin auth, rate limiting, input validation, and standard HTTP security headers.

The frontend (`public/index.html`) is served by this same server, so deploying
this one project gives you the whole site — no separate hosting or CORS setup needed.

---

## 1. Create a free MongoDB database (MongoDB Atlas)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a **free (M0) cluster** — any provider/region is fine; pick one close to your users.
3. **Database Access** → "Add New Database User" → create a username + a strong
   password (save it, you'll need it below).
4. **Network Access** → "Add IP Address" → for the simplest setup choose
   "Allow access from anywhere" (`0.0.0.0/0`) — fine for a small app; you can
   restrict this later to your hosting provider's IPs if you want to tighten it.
5. **Database** → "Connect" → "Drivers" → copy the connection string. It looks like:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Add `/aapnichai` before the `?` so it points at a specific database name:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/aapnichai?retryWrites=true&w=majority
   ```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `MONGODB_URI` — the connection string from step 1
- `JWT_SECRET` — generate a strong random one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your own login for the admin panel (use a
  strong, unique password). These are only read once, to create your first
  admin account — you can remove them from `.env` after your first successful login.
- `FRONTEND_ORIGIN` — the URL your site will be live at (e.g.
  `https://aapnichai.onrender.com`). For local testing, `http://localhost:4000`.
- `COOKIE_SECURE` — leave `false` for local testing. **Set to `true` once you're
  live on HTTPS** (any real hosting platform gives you HTTPS automatically).

**Never commit `.env` to git or share it with anyone** — it contains your database
password and session-signing secret. `.gitignore` already excludes it.

## 3. Install and run

```bash
npm install
npm start
```

You should see:
```
✅ MongoDB connected
✅ Admin account created for you@example.com. You can log in now.
🚀 Aapni Chai server running on port 4000
```

Open `http://localhost:4000` — the site should load, and Admin Login (bottom of
the footer) should work with the email/password you set in `.env`.

For local development with auto-restart on file changes:
```bash
npm run dev
```

## 4. Deploying it live

This is a normal Node.js server (not a static site), so it needs a host that
runs Node — not Netlify/GitHub Pages (those only serve static files). Good
free/cheap options:

- **Render.com** (easiest): New → Web Service → connect your repo → Build
  command `npm install`, Start command `npm start` → add all your `.env`
  values under "Environment" → Deploy. Render gives you HTTPS automatically.
- **Railway.app**: similar flow, also automatic HTTPS.
- **Fly.io**: more control, still simple for a single Node service.

After deploying, set `FRONTEND_ORIGIN` to your real live URL and `COOKIE_SECURE=true`,
then redeploy — this is required for the admin login cookie to work correctly over HTTPS.

## 5. What's protected, and how

| Concern | How it's handled |
|---|---|
| Admin passwords | Hashed with bcrypt (12 rounds) — never stored in plain text |
| Admin sessions | JWT in an `httpOnly`, `Secure`, `SameSite=Strict` cookie — JavaScript (and therefore XSS) cannot read or steal it |
| Brute-force login | Rate-limited (10 attempts/15 min per IP) + account lockout after repeated failures |
| Review/card spam | Rate-limited per IP; all fields validated and length-capped |
| NoSQL injection | `express-mongo-sanitize` strips `$`/`.` from all incoming data |
| XSS | All user text is validated/escaped server-side; the frontend also escapes everything it renders |
| Clickjacking | Real `X-Frame-Options`/`frame-ancestors` HTTP headers via Helmet (this works — unlike a `<meta>` tag, since it's a real header now) |
| Data over the wire | Enforce HTTPS in production (`COOKIE_SECURE=true` + your host's automatic HTTPS) |
| Card privacy | Customers can only fetch **one** card by its exact code (rate-limited); there is no endpoint that lists all customers publicly |
| Secrets | Everything sensitive lives in `.env`, never in the code, never committed to git |

### Honest limitations
- This gives you **real, working security for a small-business app**. It is not
  a substitute for a professional security audit if you plan to scale this to
  a large, high-traffic, multi-location business.
- The client-side "disable right-click / F12" deterrents from the previous
  version are cosmetic only (any technical user can bypass them) — they don't
  affect the real security described above, which lives entirely on the server.
- Card codes are 6 random characters (~2 billion combinations) plus rate
  limiting — practically unguessable, but not literally impossible over a very
  long time from many IPs. Good enough for a cafe loyalty program.

## 6. Project structure

```
aapni-chai-backend/
  server.js                 → app entry point, security middleware, route mounting
  src/
    config/db.js             → MongoDB connection
    models/                  → Mongoose schemas (Admin, Content, Review, Card)
    middleware/
      auth.js                 → JWT cookie auth
      rateLimiters.js          → login / review / card-lookup / general limits
    routes/
      auth.js    → POST /api/auth/login, /logout, GET /me
      content.js → GET/PUT /api/content
      reviews.js → GET/POST /api/reviews, DELETE /api/reviews/:id
      cards.js   → full loyalty card CRUD + public lookup
    utils/
      seedAdmin.js  → creates your first admin account from .env
  public/
    index.html   → the website itself (talks to the API above)
```

## 7. Changing your admin password later

There's no "change password" screen yet. Easiest options:
- Delete your admin user in MongoDB Atlas (Database → Browse Collections →
  `admins`), set a new `ADMIN_PASSWORD` in `.env`, restart the server — it will
  recreate the account.
- Or run `npm run seed:admin` after clearing the `admins` collection.

If you'd like a proper in-app "change password" screen, ask and it can be added.

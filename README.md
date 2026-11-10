# AquaDrop — Water Refilling Station Management System

A complete single-station water refilling management system built with **React + TypeScript + Vite + Tailwind CSS**, **Supabase** (Postgres, Auth, Row Level Security, Realtime, Edge Functions), **Leaflet / OpenStreetMap / OSRM**, and a card-style checkout screen. Stripe Edge Functions are included for a future real-payment integration; the current card form is simulated for the demo.

It ships with three role-based interfaces:

| Interface | Who uses it | Main capabilities |
| --- | --- | --- |
| **Admin** | Station owner / staff | Dashboard, orders, customers, drivers, pricing, distance rules, delivery schedules, route planner, reports, station settings |
| **Driver** | Delivery riders | Separate mobile-first dashboard, available-order self-pick, optimized multi-stop route + GPS sharing, status updates (Pending → Out for Delivery → Delivered), delivery history |
| **Customer** | Households / businesses | Order 19L water, pin the delivery point on a map, automatic road distance + minimum-order check, delivery window picker, online card payment or Cash on Delivery, cancel while pending + unpaid, order history and live status |

> The app works with **placeholder credentials** so it can be built and reviewed before a Supabase/Stripe project exists. Data screens show a setup notice until real keys are added.

---

## 1. Tech stack

- **React 19**, **TypeScript**, **Vite 8**
- **Tailwind CSS 4** (via `@tailwindcss/vite`, no config file)
- **Lucide React** icons, **React Router** v7
- **Supabase JS** (`@supabase/supabase-js`)
- **Card-style checkout form** (simulated settlement; Stripe Edge Functions retained for future real payments)
- **Leaflet + React Leaflet**, OpenStreetMap tiles, **OSRM** road routing, Nominatim reverse geocoding
- **React Hook Form**, **date-fns**

No component library (no ShadCN, MUI, Bootstrap, etc.) is used.

---

## 2. Project structure

```text
FinalWater/
├─ src/
│  ├─ components/        # Shared UI, admin/driver components
│  ├─ contexts/          # Auth + toast providers
│  ├─ hooks/             # Public config, realtime, driver GPS
│  ├─ layouts/           # Admin / customer / driver shells
│  ├─ pages/             # public, auth, admin, customer, driver
│  ├─ services/          # Supabase data access, payments, maps
│  ├─ types/             # Shared TypeScript types
│  └─ utils/             # Money, dates, calculations, constants
├─ scripts/
│  └─ seed-admin.mjs     # Optional admin repair script (SQL already seeds it)
├─ supabase/
│  ├─ water_refilling_system.sql   # Full schema, RLS, triggers, RPCs, admin seed
│  └─ functions/
│     ├─ create-driver/            # Optional admin-only driver provisioning
│     ├─ create-checkout/          # Stripe Checkout (retained for future use)
│     ├─ stripe-webhook/           # Signature-verified webhook (future use)
│     └─ _shared/cors.ts
├─ .env.example
└─ README.md
```

---

## 3. Prerequisites

- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account in **test mode**
- (Optional) [Supabase CLI](https://supabase.com/docs/guides/cli) for deploying Edge Functions
- (Optional) [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhook testing

---

## 4. Quick start

```bash
npm install
copy .env.example .env      # Windows PowerShell / CMD
# fill in .env (see below)
npm run dev
```

Build and lint:

```bash
npm run build
npm run lint
```

> On Windows PowerShell, if `npm` is blocked by the script execution policy, use `npm.cmd` instead of `npm` (for example `npm.cmd run dev`).

---

## 5. Supabase setup

### 5.1 Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Wait for the database to finish provisioning.
3. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon / public key**

### 5.2 Run the database script

1. Open **SQL Editor** in the Supabase dashboard.
2. Paste the **entire** contents of [`supabase/water_refilling_system.sql`](supabase/water_refilling_system.sql).
3. Click **Run**.

> Re-run the whole file after upgrading an existing project. It is idempotent (`create or replace`, `drop policy if exists`, etc.) and adds the customer cancellation/payment RPCs, driver self-pick, and admin-only driver creation.

The script creates:

- Enums, tables, indexes, constraints
- Order statuses: `pending` → `out_for_delivery` → `delivered`, plus `cancelled`
- Server-side order validation and pricing triggers
- Automatic profile creation on signup
- Row Level Security policies for every table
- Realtime publication entries
- The administrator account (`admin@gmail.com` / `admin123`)
- `admin_create_driver()` (admin-only driver provisioning) and `accept_order()` (race-safe driver self-pick)
- Real configuration seed data:
  - Station: AquaDrop, Dona Maria, Iligan City (`8.208918, 124.245123`)
  - Prices: water **₱30**, new container **₱150**, delivery fee **₱30**
  - Distance minimums: `0–3 km → 5`, `3–5 km → 7`, `5–8 km → 10`, `8–10 km → 12`, `10+ km → 15`
  - Delivery windows Mon–Sat, 08:00–10:00, 10:00–12:00, 13:00–15:00, 15:00–17:00 (10 orders each)

**No fake customers, drivers, or orders are inserted.**

### 5.3 Administrator account

The database script creates the administrator directly — no service-role key and
no extra script are required:

- Email: `admin@gmail.com`
- Password: `admin123`

Sign in at `/login` and you are redirected to `/admin`. The bootstrap block is
idempotent: re-running the SQL resets the password, confirms the email,
recreates the auth identity, and restores the `admin` role.

> **Email confirmation:** the SQL confirms the admin email automatically. For
> customer signups, disable **Confirm email** in **Authentication → Providers →
> Email** if you want a smooth classroom/demo flow.

<details>
<summary>Optional: npm seed script</summary>

`npm run seed:admin` remains available as a secondary path for existing
projects. It requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and performs
the same repair.

</details>

### 5.4 Auth settings

- **Authentication → URL Configuration**
  - **Site URL:** `http://localhost:5173` for local development
  - **Redirect URLs:** add your production URL later
- Customers can self-register at `/signup`.
- Driver accounts are **only** created by an administrator on `/admin/drivers`.
  The `admin_create_driver()` RPC re-checks `is_admin()` server-side, and the
  signup trigger always forces `role = 'customer'`.
- Drivers sign in on the same `/login` page with the email and password the
  administrator gave them, then land on the separate `/driver` dashboard.

---

## 6. Environment variables

Copy `.env.example` to `.env` and fill in:

```dotenv
# Supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Optional: only needed if you later switch the checkout back to real Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
```

The **service-role key** is optional. It is only used by the secondary
`npm run seed:admin` script. Put it in `.env.local`, never in `.env` and never
in `src/`:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The main setup (admin bootstrap, customer signup, and admin-only driver
creation through `admin_create_driver()`) needs **only** `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`.

Only `VITE_*` variables are exposed to the browser. **Never** put the Supabase service-role key or the Stripe secret key in a `VITE_*` variable or anywhere in `src/`.

Restart the dev server after changing `.env`.

---

## 7. Edge Functions

Three functions live in `supabase/functions/`:

| Function | Purpose | Auth |
| --- | --- | --- |
| `create-driver` | Optional alternative that creates an Auth user + driver profile using the service role | Caller must be an active admin |
| `create-checkout` | Creates a Stripe Checkout session (not called by the current UI) | Caller must own the order |
| `stripe-webhook` | Verifies Stripe signature and marks orders paid (not called by the current UI) | Stripe signature only (`--no-verify-jwt`) |

> The app creates drivers through the `admin_create_driver()` SQL RPC, so
> deploying `create-driver` is **optional**.

### 7.1 Install and link the Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 7.2 Set secrets

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for deployed functions. Add the Stripe secrets:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
supabase secrets set SITE_URL=http://localhost:5173
```

`SITE_URL` is used as the Stripe return URL. In production, set it to your deployed site origin (for example `https://your-app.vercel.app`).

### 7.3 Deploy

```bash
supabase functions deploy create-driver
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
```

> `stripe-webhook` **must** be deployed with `--no-verify-jwt`, because Stripe calls it directly and does not send a Supabase JWT.

---

## 8. Stripe setup (optional — future real payments)

> The current customer checkout uses a simulated card form and does **not**
> call Stripe. The section below is only needed if you later replace
> `complete_demo_card_payment()` with a real PaymentIntent flow.

1. Open the Stripe Dashboard and make sure **Test mode** is enabled.
2. Copy the **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY` Edge Function secret.
3. Copy the **Publishable key** (`pk_test_...`) → `VITE_STRIPE_PUBLISHABLE_KEY` in `.env`.
4. Create a webhook endpoint:
   - **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook`
   - Events:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
   - Copy the signing secret (`whsec_...`) → `STRIPE_WEBHOOK_SECRET` secret.
5. Redeploy the webhook function after changing secrets.

### Local webhook testing with the Stripe CLI

```bash
stripe login
stripe listen --forward-to https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook
```

Use the `whsec_...` printed by `stripe listen` as `STRIPE_WEBHOOK_SECRET` while testing locally.

### Test card

- Card: `4242 4242 4242 4242`
- Expiry: any future date
- CVC: any 3 digits

The server never trusts the browser for amounts. The order total is snapshotted in Postgres, re-checked against Stripe's `amount_total` and `currency`, and the webhook is idempotent.

---

## 9. Roles and flows

### Customer

1. Sign up at `/signup`.
2. Open **Order water**.
3. Pin the delivery point on the map (or use “Use my location”).
4. The app calls OSRM for the **road distance** from the station, then shows the minimum quantity for that distance band.
5. Choose exchange vs. new container, quantity, date, delivery window, and payment method.
6. Place the order. Postgres re-validates and re-prices everything:
   - quantity ≥ distance minimum
   - distance ≤ station maximum
   - schedule weekday, window still open, capacity available
   - water/container/delivery prices from the database
7. Pay with the online card form or choose Cash on Delivery.
8. Track status and the delivery timeline on the order page.
9. While the order is still **pending and unpaid**, cancel it from the order
   page. The delivery slot is released immediately.

### Admin

1. Sign in at `/login` → redirected to `/admin`.
2. Monitor incoming orders. Drivers claim pending deliveries themselves, so
   the admin never assigns a driver or edits an order status.
3. Create driver accounts on `/admin/drivers` via the admin-only
   `admin_create_driver()` RPC. The admin stays signed in; share the email and
   temporary password with the driver.
4. Open **Route Planner** (`/admin/routes`) to see each driver's active stops in
   the recommended visit order, with total distance/time and numbered map pins.
5. Manage pricing, distance rules, schedules, station details, and reports.
6. Cash on Delivery is settled automatically when the driver marks the order
   **Delivered**, assuming the cash was collected.

The dashboard keeps only **Total orders**, **Total sales**, **Recent orders**,
the **Order status overview**, and the **Daily sales** chart. Sales are counted
at payment time, so an online payment appears immediately and a COD order
appears as soon as it is delivered.

### Driver

1. Sign in on the shared `/login` page with the credentials created by the
   admin. Drivers land on their own `/driver` dashboard and cannot open the
   admin or customer areas.
2. The dashboard shows **Pending orders** — every pending, unassigned order.
   Tap a pending order card to accept it and start the delivery; the order is
   claimed atomically, so a second driver cannot take it.
3. Accepting moves the order straight to **Out for Delivery** and updates the
   admin dashboard and customer order page in realtime. The delivery detail
   page shows the road route from the station (or the driver's GPS position).
4. Allow location access to share the latest position with the station. Active
   stops are drawn as one optimized route with numbered `MapPin` markers.
5. When the water is handed over, tap **Mark as delivered**. The order becomes
   **Delivered**, a COD order is marked **Paid** automatically, and the admin
   dashboard and sales update in realtime.
6. Delivered/cancelled jobs appear in **History**.

Drivers may only deliver water. They cannot create or edit orders, change
prices, addresses, customer details, or reassign orders. Self-pick is open to
active drivers for any pending, unassigned order, and requires COD or an
already-paid online order. The database trigger allows only
`pending (unassigned) → out_for_delivery` and `out_for_delivery → delivered`
for drivers.

---

## 10. Business rules

| Rule | Default |
| --- | --- |
| Water price | ₱30 per 19L container |
| New container | ₱150 each (added only for “new container” orders) |
| Delivery fee | ₱30 flat |
| Maximum road distance | 15 km |
| Minimum quantity by distance | 0–3 km → 5; 3–5 km → 7; 5–8 km → 10; 8–10 km → 12; 10+ km → 15 |
| Delivery days | Monday–Saturday |
| Windows | 08:00–10:00, 10:00–12:00, 13:00–15:00, 15:00–17:00 |
| Capacity per window/date | 10 orders |

All of these are editable by the admin in the app. Existing orders keep their price snapshots.

---

## 11. Security model

- **RLS on every table.** Customers can only read their own profile/orders/payments/history. Drivers see their own assigned orders, their own location, and all pending unassigned deliveries. Admins see everything.
- **Signup role escalation is impossible.** The `handle_new_user` trigger forces `role = 'customer'`; profile updates are guarded by a trigger that blocks role/email/active changes for non-admins.
- **Prices are server-side.** Order insert triggers overwrite prices, subtotals, fees, total, minimum quantity, delivery window, and status.
- **Distance is sanity-checked.** The database rejects a reported road distance that is significantly shorter than the straight-line distance between the station and the pin, preventing minimum-order bypass.
- **Schedule capacity is race-safe.** Insert validation takes a per-window/date advisory lock before counting bookings.
- **Driver provisioning** goes through the security-definer `admin_create_driver()` RPC. It re-checks `is_admin()`, validates the email/password, creates the confirmed Auth user and email identity, and inserts an active driver profile. No service-role key is needed on the client.
- **Driver self-pick is race-safe.** `accept_order()` checks `is_driver()`, locks the order row with `FOR UPDATE`, verifies the order is pending, unassigned, and COD or already paid, then claims it. A second driver receives “This delivery is no longer available.”
- **COD settles on delivery.** The order-update trigger sets `payment_status = 'paid'` when a COD order becomes `delivered`, and a follow-up trigger records `paid_at` on the payment row so sales reports recognise the revenue immediately.
- **Customer writes are constrained.** Customers have no order UPDATE policy. Cancelling and paying go through two security-definer RPCs that verify ownership and order status. The payment RPC is simulated for the demo, stores no card data, and must be replaced before accepting real money.
- **Stripe webhook** verifies the raw-body signature, checks currency and exact amount, handles only paid sessions, and is idempotent.
- No secret keys are ever shipped to the browser.

---

## 12. Manual test checklist

After setup, verify:

- [ ] `npm run build` and `npm run lint` pass.
- [ ] A new customer can sign up and lands on `/customer`.
- [ ] Admin can sign in with `admin@gmail.com` / `admin123` and sees an empty dashboard (no fake data).
- [ ] Admin can create a driver; the driver can sign in on `/login` and lands on `/driver`.
- [ ] Driver sees **Available deliveries**, accepts a pending order with **Accept & start**, and it moves to **Out for Delivery**.
- [ ] Admin dashboard updates the accepted order in realtime, then updates to **Delivered** after the driver finishes.
- [ ] A second driver cannot accept the same order.
- [ ] **Route Planner** shows the driver's stops as numbered map pins with total distance/time.
- [ ] Customer order details/receipt and the admin order details show a draggable road route from the station.
- [ ] Customer can pin a location, sees a road distance and the correct minimum quantity.
- [ ] Ordering below the minimum is blocked in the UI **and** by the database.
- [ ] A full delivery window is rejected with a clear error.
- [ ] COD order is claimed by a driver, completed, and marked **Paid** automatically on delivery.
- [ ] Customer sees status changes and the timeline update in real time.
- [ ] Admin dashboard has no manual status, assignment, or payment controls.
- [ ] Online card payment succeeds, the order becomes `paid`, and daily sales update immediately.
- [ ] A failed card payment shows an inline error and the checkout form stays usable.
- [ ] A pending unpaid order can be cancelled by the customer; a paid order cannot.
- [ ] Cancelling a pending order releases its delivery slot for other customers.
- [ ] Deactivated driver can no longer sign in.
- [ ] Driver cannot access `/admin` or `/customer`; customers cannot access `/admin` or `/driver`.

---

## 13. Troubleshooting

| Problem | Fix |
| --- | --- |
| “Supabase is not configured” banner | Fill in `.env` and restart `npm run dev` |
| Admin still lands on customer dashboard | Re-run the full SQL file (admin bootstrap), then sign out/in |
| `admin_create_driver` is missing | Re-run the SQL file; the function and its grant are near the end of section 5 |
| “This delivery is no longer available” | Another driver accepted the order first; refresh the dashboard |
| COD order still shows unpaid after delivery | Re-run the SQL file so the auto-payment trigger is installed |
| `seed:admin` says configuration is missing | Optional script only: add `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` |
| “No profile was found” after signup | Email confirmation may be enabled; confirm the email or disable confirmation |
| Payment form returns “Order not found” | Sign in as the customer who owns the order; re-run the SQL file if the RPC is missing |
| Map tiles or routes fail | OSM/OSRM public services may be rate-limited; retry or self-host for production |
| `permission denied` on a table | Confirm the full SQL file ran without errors; RLS policies and grants are part of it |
| Realtime not updating | Check that Realtime is enabled in Supabase and the SQL publication statements ran |

View function logs:

```bash
supabase functions logs create-checkout
supabase functions logs stripe-webhook
```

---

## 14. Notes for production

- Replace the public OSRM demo server and Nominatim with a self-hosted or commercial provider, and respect their usage policies.
- Set `SITE_URL` to the production origin and add it to Supabase Auth redirect URLs.
- Replace the simulated `complete_demo_card_payment()` RPC with a real Stripe PaymentIntent confirmation before taking money, and remove the seeded demo password.
- Use a restricted Stripe key and a production webhook endpoint if you enable real payments.
- Consider database backups and monitoring.
- The app has no per-km delivery fee; add one only if the station changes its policy.

---

## 15. Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run seed:admin` | Optional: create/repair `admin@gmail.com` / `admin123` using the service-role key (the SQL already does this) |

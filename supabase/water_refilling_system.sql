-- =============================================================================
--  AQUADROP — WATER REFILLING STATION MANAGEMENT SYSTEM
--  Complete Supabase / PostgreSQL schema
--
--  HOW TO USE
--  1. Create a Supabase project.
--  2. Open the SQL Editor and paste this entire file, then Run.
--  3. Sign in with the administrator account created by this file:
--     Email: admin@gmail.com / Password: admin123
--  4. (Optional) Deploy the Edge Functions and configure their secrets.
--
--  ROLES: admin | driver | customer
--  Only customers can register publicly. Drivers are created by an admin
--  through the admin_create_driver() RPC (or the optional create-driver Edge
--  Function).
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- Supabase installs extensions in the `extensions` schema. Include it so the
-- btree_gist exclusion constraint and crypt()/gen_salt() resolve during this
-- run, while keeping `public` first so unqualified objects stay in public.
set search_path = public, extensions;

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

do $$
begin
  create type public.user_role as enum ('admin', 'driver', 'customer');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.order_status as enum (
    'pending', 'out_for_delivery', 'delivered', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.container_type as enum ('exchange', 'new');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_method as enum ('stripe', 'cod');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_provider as enum ('stripe', 'cod');
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, linked to auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  role public.user_role not null default 'customer',
  is_active boolean not null default true,
  address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- station_settings: single station (id is always 1)
-- ---------------------------------------------------------------------------
create table if not exists public.station_settings (
  id smallint primary key default 1 check (id = 1),
  station_name text not null default 'Water Refilling Station',
  address text not null default 'Dona Maria, Iligan City, Lanao del Norte, Philippines',
  latitude double precision not null default 8.208918,
  longitude double precision not null default 124.245123,
  contact_number text not null default '',
  operating_hours text not null default 'Mon-Sat: 7:00 AM - 6:00 PM',
  max_delivery_distance_km numeric(6, 2) not null default 15
    check (max_delivery_distance_km > 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pricing_settings: configurable prices (single row)
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_settings (
  id smallint primary key default 1 check (id = 1),
  water_price numeric(10, 2) not null default 30 check (water_price >= 0),
  container_price numeric(10, 2) not null default 150 check (container_price >= 0),
  delivery_fee numeric(10, 2) not null default 30 check (delivery_fee >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- distance_pricing_rules: distance bands and minimum container quantities
-- ---------------------------------------------------------------------------
create table if not exists public.distance_pricing_rules (
  id bigint generated always as identity primary key,
  min_km numeric(6, 2) not null check (min_km >= 0),
  max_km numeric(6, 2) check (max_km is null or max_km > min_km),
  min_quantity integer not null check (min_quantity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists distance_rules_min_km_idx
  on public.distance_pricing_rules (min_km);

-- Active rules must never overlap. NULL max_km means "open ended".
do $$
begin
  alter table public.distance_pricing_rules
    add constraint distance_pricing_rules_no_overlap
    exclude using gist (
      numrange(min_km, coalesce(max_km, 'infinity'::numeric), '[)') with &&
    ) where (is_active);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- delivery_schedules: weekly delivery windows with a capacity per window
-- day_of_week: 0 = Sunday ... 6 = Saturday
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_schedules (
  id bigint generated always as identity primary key,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  max_orders integer not null default 10 check (max_orders > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_of_week, start_time, end_time)
);

-- ---------------------------------------------------------------------------
-- orders
-- Prices are snapshotted at creation time; editing prices never changes
-- existing orders. Names/phones are snapshotted so drivers never need access
-- to the profiles table.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique
    default ('WRS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  driver_id uuid references public.profiles (id) on delete set null,
  order_status public.order_status not null default 'pending',
  delivery_date date not null,
  delivery_time text not null,
  delivery_schedule_id bigint references public.delivery_schedules (id) on delete set null,
  delivery_address text not null,
  delivery_latitude double precision not null
    check (delivery_latitude between -90 and 90),
  delivery_longitude double precision not null
    check (delivery_longitude between -180 and 180),
  delivery_instructions text,
  water_quantity integer not null check (water_quantity > 0),
  container_type public.container_type not null,
  water_price_snapshot numeric(10, 2) not null,
  container_price_snapshot numeric(10, 2) not null,
  water_subtotal numeric(12, 2) not null,
  container_subtotal numeric(12, 2) not null default 0,
  delivery_fee numeric(10, 2) not null default 0,
  delivery_distance_km numeric(6, 2) not null check (delivery_distance_km >= 0),
  minimum_required_quantity integer not null check (minimum_required_quantity > 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  customer_name text not null,
  customer_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_driver_idx on public.orders (driver_id);
create index if not exists orders_status_idx on public.orders (order_status);
create index if not exists orders_delivery_date_idx on public.orders (delivery_date);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_schedule_date_idx
  on public.orders (delivery_schedule_id, delivery_date);

-- Fast lookup for the driver "available deliveries" list.
create index if not exists orders_available_driver_idx
  on public.orders (delivery_date)
  where order_status = 'pending' and driver_id is null;

-- ---------------------------------------------------------------------------
-- payments: one payment record per order
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  provider public.payment_provider not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'PHP',
  status public.payment_status not null default 'pending',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_event_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_idx on public.payments (order_id);
create index if not exists payments_status_idx on public.payments (status);

-- ---------------------------------------------------------------------------
-- delivery_history: audit trail shown as a timeline
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  driver_id uuid references public.profiles (id) on delete set null,
  status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists delivery_history_order_idx
  on public.delivery_history (order_id, created_at);

-- ---------------------------------------------------------------------------
-- driver_locations: latest known driver position (no GPS history)
-- ---------------------------------------------------------------------------
create table if not exists public.driver_locations (
  driver_id uuid primary key references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 3. HELPER FUNCTIONS
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.is_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'driver' and is_active
  );
$$;

create or replace function public.is_active_customer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'customer' and is_active
  );
$$;

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  ) = 'service_role';
$$;

-- Great-circle distance in kilometres. Used to sanity-check the road distance
-- reported by the browser so a customer cannot under-report distance to dodge
-- the minimum-order rule.
create or replace function public.haversine_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371.0088 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

-- =============================================================================
-- 4. TRIGGERS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Automatically create a CUSTOMER profile for every new auth user.
-- The role is always forced to 'customer'; signup metadata is never trusted.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Profile protection: users may edit their own details, but never their
-- role, active status or email. Direct SQL (auth.uid() is null) and the
-- service role are allowed, which is what the admin bootstrap / Edge
-- Functions use.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'You cannot change your account role.';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'You cannot change your account status.';
  end if;

  if new.email is distinct from old.email then
    raise exception 'Email addresses cannot be changed here.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_fields_trigger on public.profiles;
create trigger protect_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Order INSERT validation and server-side pricing.
-- The frontend never decides price, totals, minimum quantity or schedule.
-- ---------------------------------------------------------------------------
create or replace function public.handle_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price record;
  v_station record;
  v_schedule record;
  v_min_quantity integer;
  v_booked integer;
  v_customer_name text;
  v_customer_phone text;
  v_straight_km double precision;
  v_local_date date;
  v_local_time time;
begin
  -- Only a customer may create an order for themselves (service role/direct
  -- SQL is used only for administrative tooling).
  if auth.uid() is not null and new.customer_id <> auth.uid() then
    raise exception 'You can only create orders for your own account.';
  end if;

  select full_name, phone
    into v_customer_name, v_customer_phone
    from public.profiles
   where id = new.customer_id;

  if not found then
    raise exception 'Customer profile not found.';
  end if;

  -- Delivery windows are station-local. Supabase databases run in UTC, so
  -- compare against Philippine time instead of current_date/current_time.
  v_local_date := (now() at time zone 'Asia/Manila')::date;
  v_local_time := (now() at time zone 'Asia/Manila')::time;

  if new.delivery_date < v_local_date then
    raise exception 'Delivery date cannot be in the past.';
  end if;

  if new.water_quantity < 1 then
    raise exception 'Order quantity must be at least 1 container.';
  end if;

  select * into v_station from public.station_settings where id = 1;
  if not found then
    raise exception 'Station settings are not configured.';
  end if;

  if new.delivery_distance_km > v_station.max_delivery_distance_km then
    raise exception 'Your location is outside the maximum delivery distance of % km.',
      v_station.max_delivery_distance_km;
  end if;

  -- A road route can never be meaningfully shorter than the straight-line
  -- distance between the same two points. Allow a small tolerance for
  -- coordinate precision, but reject grossly under-reported distances.
  v_straight_km := public.haversine_km(
    v_station.latitude,
    v_station.longitude,
    new.delivery_latitude,
    new.delivery_longitude
  );

  if new.delivery_distance_km + 0.05 < v_straight_km * 0.90 then
    raise exception 'The reported delivery distance does not match the pinned location.';
  end if;

  select min_quantity
    into v_min_quantity
    from public.distance_pricing_rules
   where is_active
     and new.delivery_distance_km >= min_km
     and (max_km is null or new.delivery_distance_km < max_km)
   order by min_km
   limit 1;

  if v_min_quantity is null then
    raise exception 'No delivery rule covers this distance. Please contact the station.';
  end if;

  if new.water_quantity < v_min_quantity then
    raise exception 'This delivery location requires a minimum order of % containers.',
      v_min_quantity;
  end if;

  -- Validate the selected weekly schedule, its weekday and capacity.
  select * into v_schedule
    from public.delivery_schedules
   where id = new.delivery_schedule_id
     and is_active;

  if not found then
    raise exception 'The selected delivery schedule is not available.';
  end if;

  if extract(dow from new.delivery_date)::smallint <> v_schedule.day_of_week then
    raise exception 'The selected delivery schedule is not offered on that day.';
  end if;

  if new.delivery_date = v_local_date and v_schedule.end_time <= v_local_time then
    raise exception 'The selected delivery window has already ended.';
  end if;

  -- Serialise capacity checks for this window + date so two simultaneous
  -- orders cannot both take the last slot.
  perform pg_advisory_xact_lock(
    hashtext('order-slot:' || v_schedule.id::text || ':' || new.delivery_date::text)
  );

  select count(*)
    into v_booked
    from public.orders
   where delivery_schedule_id = v_schedule.id
     and delivery_date = new.delivery_date
     and order_status <> 'cancelled';

  if v_booked >= v_schedule.max_orders then
    raise exception 'The selected delivery schedule is already full. Please choose another.';
  end if;

  select * into v_price from public.pricing_settings where id = 1;
  if not found then
    raise exception 'Pricing is not configured.';
  end if;

  -- Server-controlled fields.
  new.order_status := 'pending';
  new.payment_status := 'pending';
  new.driver_id := null;
  new.delivered_at := null;
  new.cancelled_at := null;

  new.customer_name := coalesce(v_customer_name, 'Customer');
  new.customer_phone := v_customer_phone;
  new.delivery_time :=
    to_char(v_schedule.start_time, 'HH24:MI') || ' - ' ||
    to_char(v_schedule.end_time, 'HH24:MI');
  new.delivery_schedule_id := v_schedule.id;

  -- Always use current configured prices, never the browser's numbers.
  new.water_price_snapshot := v_price.water_price;
  new.container_price_snapshot := v_price.container_price;
  new.delivery_fee := v_price.delivery_fee;
  new.water_subtotal := round(v_price.water_price * new.water_quantity, 2);
  new.container_subtotal := case
    when new.container_type = 'new'
      then round(v_price.container_price * new.water_quantity, 2)
    else 0
  end;
  new.total_amount := round(
    new.water_subtotal + new.container_subtotal + new.delivery_fee,
    2
  );
  new.minimum_required_quantity := v_min_quantity;

  return new;
end;
$$;

drop trigger if exists handle_order_insert_trigger on public.orders;
create trigger handle_order_insert_trigger
  before insert on public.orders
  for each row execute function public.handle_order_insert();

-- ---------------------------------------------------------------------------
-- Order UPDATE rules:
--  - admins may update management fields
--  - drivers may only move their own order forward in the delivery flow
--  - service role (Stripe webhook) may update payment fields
--  - customers have no table UPDATE policy: they may only perform the two
--    controlled transitions below through the security-definer RPCs
--    cancel_order() and complete_demo_card_payment()
-- ---------------------------------------------------------------------------
create or replace function public.handle_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  -- Direct SQL (for example the Supabase SQL Editor) and the service role are
  -- trusted maintenance paths.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    if new.order_status = 'delivered'
       and old.order_status <> 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, now());
      -- Cash is handed over at delivery, so a delivered COD order is paid.
      if new.payment_method = 'cod' then
        new.payment_status := 'paid';
      end if;
    end if;

    if new.order_status = 'cancelled'
       and old.order_status <> 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;

    return new;
  end if;

  if public.is_service_role() then
    return new;
  end if;

  -- Customers may only cancel an unpaid pending order or mark a pending
  -- order paid through the payment RPC. There is no customer UPDATE policy,
  -- so these changes can only arrive through the security-definer RPCs,
  -- never from a direct client update.
  if new.customer_id = old.customer_id
     and public.is_active_customer() then
    if new.order_status = 'cancelled'
       and old.order_status = 'pending'
       and old.payment_status = 'pending'
       and (to_jsonb(new) - 'order_status' - 'updated_at' - 'cancelled_at')
           = (to_jsonb(old) - 'order_status' - 'updated_at' - 'cancelled_at') then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      return new;
    end if;

    if new.payment_status = 'paid'
       and old.payment_status = 'pending'
       and new.order_status = old.order_status
       and (to_jsonb(new) - 'payment_status' - 'updated_at')
           = (to_jsonb(old) - 'payment_status' - 'updated_at') then
      return new;
    end if;

    raise exception 'Customers may only cancel unpaid pending orders or complete payment.';
  end if;

  if not public.is_driver() then
    raise exception 'You are not allowed to update this order.';
  end if;

  -- Driver self-pick: claim a pending, unassigned delivery and start it.
  -- Only the driver_id and order_status columns may change in this step.
  if old.order_status = 'pending'
     and old.driver_id is null
     and new.driver_id = auth.uid()
     and new.order_status = 'out_for_delivery'
     and (to_jsonb(new) - 'driver_id' - 'order_status' - 'updated_at')
         = (to_jsonb(old) - 'driver_id' - 'order_status' - 'updated_at') then
    return new;
  end if;

  if new.driver_id is distinct from old.driver_id then
    raise exception 'Drivers cannot reassign orders.';
  end if;

  if (to_jsonb(new) - 'order_status' - 'updated_at' - 'delivered_at')
     is distinct from
     (to_jsonb(old) - 'order_status' - 'updated_at' - 'delivered_at') then
    raise exception 'Drivers may only update the delivery status.';
  end if;

  if old.order_status = 'out_for_delivery' and new.order_status = 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
    -- Cash on Delivery is collected when the water is handed over, so the
    -- delivery action also settles the payment. Online orders are already paid
    -- before a driver can accept them.
    if new.payment_method = 'cod' then
      new.payment_status := 'paid';
    end if;
    return new;
  end if;

  raise exception 'Invalid delivery status change: % to %.',
    old.order_status, new.order_status;
end;
$$;

drop trigger if exists handle_order_update_trigger on public.orders;
create trigger handle_order_update_trigger
  before update on public.orders
  for each row execute function public.handle_order_update();

-- ---------------------------------------------------------------------------
-- Each order receives exactly one payment record.
-- ---------------------------------------------------------------------------
create or replace function public.create_order_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payments (order_id, provider, amount, currency, status)
  values (
    new.id,
    case when new.payment_method = 'stripe' then 'stripe'::public.payment_provider
         else 'cod'::public.payment_provider end,
    new.total_amount,
    'PHP',
    'pending'
  )
  on conflict (order_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_order_payment_trigger on public.orders;
create trigger create_order_payment_trigger
  after insert on public.orders
  for each row execute function public.create_order_payment();

-- ---------------------------------------------------------------------------
-- Delivery timeline entries
-- ---------------------------------------------------------------------------
create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.delivery_history (order_id, driver_id, status, note)
    values (new.id, new.driver_id, new.order_status, 'Order placed');
  elsif new.order_status is distinct from old.order_status then
    insert into public.delivery_history (order_id, driver_id, status, note)
    values (new.id, new.driver_id, new.order_status, null);
  end if;
  return null;
end;
$$;

drop trigger if exists log_order_status_insert_trigger on public.orders;
create trigger log_order_status_insert_trigger
  after insert on public.orders
  for each row execute function public.log_order_status();

drop trigger if exists log_order_status_update_trigger on public.orders;
create trigger log_order_status_update_trigger
  after update of order_status on public.orders
  for each row execute function public.log_order_status();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists station_settings_set_updated_at on public.station_settings;
create trigger station_settings_set_updated_at
  before update on public.station_settings
  for each row execute function public.set_updated_at();

drop trigger if exists pricing_settings_set_updated_at on public.pricing_settings;
create trigger pricing_settings_set_updated_at
  before update on public.pricing_settings
  for each row execute function public.set_updated_at();

drop trigger if exists distance_rules_set_updated_at on public.distance_pricing_rules;
create trigger distance_rules_set_updated_at
  before update on public.distance_pricing_rules
  for each row execute function public.set_updated_at();

drop trigger if exists delivery_schedules_set_updated_at on public.delivery_schedules;
create trigger delivery_schedules_set_updated_at
  before update on public.delivery_schedules
  for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Keep the payments row in sync when an order is settled automatically.
--
-- Delivering a COD order sets orders.payment_status = 'paid'; this trigger
-- records paid_at on the payment row so sales reports can group revenue by the
-- moment it was collected.
-- ---------------------------------------------------------------------------
create or replace function public.sync_order_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
     and old.payment_status is distinct from 'paid' then
    update public.payments
       set status = 'paid',
           paid_at = coalesce(paid_at, now()),
           updated_at = now()
     where order_id = new.id
       and status <> 'paid';
  end if;

  return null;
end;
$$;

-- Fire on every update: a driver only sends `order_status` in the UPDATE, so
-- restricting this trigger to `payment_status` would miss the auto-settlement.
drop trigger if exists sync_order_payment_status_trigger on public.orders;
create trigger sync_order_payment_status_trigger
  after update on public.orders
  for each row execute function public.sync_order_payment_status();

-- =============================================================================
-- 5. RPCS
-- =============================================================================

-- Public, privacy-safe schedule availability for the next N days.
create or replace function public.get_schedule_availability(
  p_from date,
  p_to date
)
returns table (
  schedule_id bigint,
  delivery_date date,
  booked bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as schedule_id,
    d::date as delivery_date,
    count(o.id)::bigint as booked
  from public.delivery_schedules s
  cross join generate_series(
    p_from::timestamp,
    p_to::timestamp,
    interval '1 day'
  ) as d
  left join public.orders o
    on o.delivery_schedule_id = s.id
   and o.delivery_date = d::date
   and o.order_status <> 'cancelled'
  where s.is_active
    and extract(dow from d)::smallint = s.day_of_week
  group by s.id, d::date
  order by d::date, s.start_time;
$$;

-- Admin-only: mark a Cash on Delivery order as paid.
create or replace function public.mark_order_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can update payment status.';
  end if;

  update public.payments
     set status = 'paid',
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where order_id = p_order_id
     and provider = 'cod';

  update public.orders
     set payment_status = 'paid',
         updated_at = now()
   where id = p_order_id
     and payment_method = 'cod';
end;
$$;

-- Customer-only: cancel an unpaid pending order.
-- Customers have no table UPDATE policy, so this security-definer function is
-- the only path for the cancellation. It releases the delivery slot because
-- get_schedule_availability() ignores cancelled orders.
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_active_customer() then
    raise exception 'Only customers can cancel their own orders.';
  end if;

  select *
    into v_order
    from public.orders
   where id = p_order_id
     and customer_id = auth.uid()
   for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.order_status <> 'pending' then
    raise exception 'Only pending orders can be cancelled.';
  end if;

  if v_order.payment_status <> 'pending' then
    raise exception 'Paid orders cannot be cancelled. Please contact the station.';
  end if;

  update public.orders
     set order_status = 'cancelled',
         cancelled_at = now(),
         updated_at = now()
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- Customer-only: complete the card payment form.
--
-- The current payment screen is a simulated card form for the demo, so it
-- settles the payment directly instead of waiting for a Stripe webhook.
-- It stores no card data. Replace this function with a Stripe PaymentIntent
-- confirmation before taking real money in production.
create or replace function public.complete_demo_card_payment(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_active_customer() then
    raise exception 'Only customers can pay for their own orders.';
  end if;

  select *
    into v_order
    from public.orders
   where id = p_order_id
     and customer_id = auth.uid()
   for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.payment_method <> 'stripe' then
    raise exception 'This order is set to Cash on Delivery.';
  end if;

  if v_order.order_status = 'cancelled' then
    raise exception 'Cancelled orders cannot be paid.';
  end if;

  if v_order.payment_status = 'paid' then
    return v_order;
  end if;

  update public.payments
     set status = 'paid',
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where order_id = p_order_id;

  update public.orders
     set payment_status = 'paid',
         updated_at = now()
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- Driver-only: atomically claim a pending, unassigned delivery.
--
-- The row lock makes the claim race-safe: if two drivers tap "Accept" at the
-- same time, the second call sees order_status = 'out_for_delivery' and fails
-- with "This delivery is no longer available."
create or replace function public.accept_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_driver() then
    raise exception 'Only active drivers can accept deliveries.';
  end if;

  select *
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.order_status <> 'pending' or v_order.driver_id is not null then
    raise exception 'This delivery is no longer available.';
  end if;

  -- Drivers may claim any pending delivery, including future schedules and
  -- past-due orders that are still waiting for pickup.

  -- COD orders are collected on delivery. Online orders must be paid first.
  if v_order.payment_method = 'stripe' and v_order.payment_status <> 'paid' then
    raise exception 'This order is awaiting online payment and cannot be accepted yet.';
  end if;

  update public.orders
     set driver_id = auth.uid(),
         order_status = 'out_for_delivery',
         updated_at = now()
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- Admin-only: create a driver login account and its driver profile.
--
-- This is the primary driver-creation path so the app does not depend on a
-- deployed Edge Function or a service-role key. The is_admin() check is the
-- real security boundary; the admin UI is only a convenience layer.
create or replace function public.admin_create_driver(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
-- `extensions` is where Supabase installs pgcrypto (crypt/gen_salt). Listing it
-- keeps the function working whether pgcrypto lives there or in `public`.
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can create driver accounts.';
  end if;

  if v_email = '' or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  if length(coalesce(p_password, '')) < 6 then
    raise exception 'The password must be at least 6 characters.';
  end if;

  if v_full_name = '' then
    raise exception 'Enter the driver''s full name.';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'An account with this email already exists.';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', v_full_name, 'phone', v_phone),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    v_user_id::text,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, full_name, email, phone, role, is_active)
  values (v_user_id, v_full_name, v_email, v_phone, 'driver', true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        role = 'driver',
        is_active = true,
        updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.station_settings enable row level security;
alter table public.pricing_settings enable row level security;
alter table public.distance_pricing_rules enable row level security;
alter table public.delivery_schedules enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.delivery_history enable row level security;
alter table public.driver_locations enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- station_settings / pricing_settings: public read, admin write
-- ---------------------------------------------------------------------------
drop policy if exists "station_settings_select_all" on public.station_settings;
create policy "station_settings_select_all"
  on public.station_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "station_settings_write_admin" on public.station_settings;
create policy "station_settings_write_admin"
  on public.station_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "pricing_settings_select_all" on public.pricing_settings;
create policy "pricing_settings_select_all"
  on public.pricing_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "pricing_settings_write_admin" on public.pricing_settings;
create policy "pricing_settings_write_admin"
  on public.pricing_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- distance_pricing_rules: public read, admin write
-- ---------------------------------------------------------------------------
drop policy if exists "distance_rules_select_all" on public.distance_pricing_rules;
create policy "distance_rules_select_all"
  on public.distance_pricing_rules for select
  to anon, authenticated
  using (true);

drop policy if exists "distance_rules_insert_admin" on public.distance_pricing_rules;
create policy "distance_rules_insert_admin"
  on public.distance_pricing_rules for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "distance_rules_update_admin" on public.distance_pricing_rules;
create policy "distance_rules_update_admin"
  on public.distance_pricing_rules for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "distance_rules_delete_admin" on public.distance_pricing_rules;
create policy "distance_rules_delete_admin"
  on public.distance_pricing_rules for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- delivery_schedules: public read of active windows, admin manages all
-- ---------------------------------------------------------------------------
drop policy if exists "delivery_schedules_select" on public.delivery_schedules;
create policy "delivery_schedules_select"
  on public.delivery_schedules for select
  to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists "delivery_schedules_insert_admin" on public.delivery_schedules;
create policy "delivery_schedules_insert_admin"
  on public.delivery_schedules for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "delivery_schedules_update_admin" on public.delivery_schedules;
create policy "delivery_schedules_update_admin"
  on public.delivery_schedules for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "delivery_schedules_delete_admin" on public.delivery_schedules;
create policy "delivery_schedules_delete_admin"
  on public.delivery_schedules for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
drop policy if exists "orders_select_customer" on public.orders;
create policy "orders_select_customer"
  on public.orders for select
  to authenticated
  using (customer_id = auth.uid());

drop policy if exists "orders_select_driver" on public.orders;
create policy "orders_select_driver"
  on public.orders for select
  to authenticated
  using (driver_id = auth.uid());

-- Active drivers may browse every pending, unassigned delivery so they can
-- self-pick one, regardless of its scheduled date. They still cannot read any
-- other customer's order history.
drop policy if exists "orders_select_available_driver" on public.orders;
create policy "orders_select_available_driver"
  on public.orders for select
  to authenticated
  using (
    public.is_driver()
    and driver_id is null
    and order_status = 'pending'
  );

drop policy if exists "orders_select_admin" on public.orders;
create policy "orders_select_admin"
  on public.orders for select
  to authenticated
  using (public.is_admin());

drop policy if exists "orders_insert_customer" on public.orders;
create policy "orders_insert_customer"
  on public.orders for insert
  to authenticated
  with check (
    customer_id = auth.uid()
    and public.is_active_customer()
  );

drop policy if exists "orders_update_driver" on public.orders;
create policy "orders_update_driver"
  on public.orders for update
  to authenticated
  using (
    driver_id = auth.uid()
    and public.is_driver()
    and order_status = 'out_for_delivery'
  )
  with check (
    driver_id = auth.uid()
    and public.is_driver()
  );

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- payments: customers see their own, admin sees all; writes only by
-- database triggers / service role / mark_order_paid().
-- ---------------------------------------------------------------------------
drop policy if exists "payments_select_customer" on public.payments;
create policy "payments_select_customer"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.customer_id = auth.uid()
    )
  );

drop policy if exists "payments_select_admin" on public.payments;
create policy "payments_select_admin"
  on public.payments for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- delivery_history: related customer, assigned driver, or admin
-- ---------------------------------------------------------------------------
drop policy if exists "delivery_history_select_customer" on public.delivery_history;
create policy "delivery_history_select_customer"
  on public.delivery_history for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = delivery_history.order_id
        and o.customer_id = auth.uid()
    )
  );

drop policy if exists "delivery_history_select_driver" on public.delivery_history;
create policy "delivery_history_select_driver"
  on public.delivery_history for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = delivery_history.order_id
        and o.driver_id = auth.uid()
    )
  );

drop policy if exists "delivery_history_select_admin" on public.delivery_history;
create policy "delivery_history_select_admin"
  on public.delivery_history for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- driver_locations
-- ---------------------------------------------------------------------------
drop policy if exists "driver_locations_select_own" on public.driver_locations;
create policy "driver_locations_select_own"
  on public.driver_locations for select
  to authenticated
  using (driver_id = auth.uid());

drop policy if exists "driver_locations_select_admin" on public.driver_locations;
create policy "driver_locations_select_admin"
  on public.driver_locations for select
  to authenticated
  using (public.is_admin());

drop policy if exists "driver_locations_insert_own" on public.driver_locations;
create policy "driver_locations_insert_own"
  on public.driver_locations for insert
  to authenticated
  with check (driver_id = auth.uid() and public.is_driver());

drop policy if exists "driver_locations_update_own" on public.driver_locations;
create policy "driver_locations_update_own"
  on public.driver_locations for update
  to authenticated
  using (driver_id = auth.uid() and public.is_driver())
  with check (driver_id = auth.uid() and public.is_driver());

drop policy if exists "driver_locations_delete_own" on public.driver_locations;
create policy "driver_locations_delete_own"
  on public.driver_locations for delete
  to authenticated
  using (driver_id = auth.uid() and public.is_driver());

-- =============================================================================
-- 7. GRANTS
-- =============================================================================

grant usage on schema public to anon, authenticated;

grant select on public.station_settings to anon, authenticated;
grant select on public.pricing_settings to anon, authenticated;
grant select on public.distance_pricing_rules to anon, authenticated;
grant select on public.delivery_schedules to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select on public.payments to authenticated;
grant select on public.delivery_history to authenticated;
grant select, insert, update, delete on public.driver_locations to authenticated;

grant insert, update, delete on public.station_settings to authenticated;
grant insert, update, delete on public.pricing_settings to authenticated;
grant insert, update, delete on public.distance_pricing_rules to authenticated;
grant insert, update, delete on public.delivery_schedules to authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

grant execute on function public.get_schedule_availability(date, date) to anon, authenticated;
grant execute on function public.mark_order_paid(uuid) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.complete_demo_card_payment(uuid) to authenticated;

-- Driver self-pick and admin-only driver creation are not callable anonymously.
revoke all on function public.accept_order(uuid) from public, anon;
grant execute on function public.accept_order(uuid) to authenticated;

revoke all on function public.admin_create_driver(text, text, text, text) from public, anon;
grant execute on function public.admin_create_driver(text, text, text, text) to authenticated;

-- =============================================================================
-- 8. REALTIME
-- =============================================================================

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.delivery_history;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.driver_locations;
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 9. INITIAL CONFIGURATION (real station data, no demo orders)
-- =============================================================================

insert into public.station_settings (
  id, station_name, address, latitude, longitude,
  contact_number, operating_hours, max_delivery_distance_km
)
values (
  1,
  'AquaDrop Water Refilling Station',
  'Dona Maria, Iligan City, Lanao del Norte, Philippines',
  8.208918,
  124.245123,
  '',
  'Mon-Sat: 7:00 AM - 6:00 PM',
  15
)
on conflict (id) do nothing;

insert into public.pricing_settings (
  id, water_price, container_price, delivery_fee
)
values (1, 30.00, 150.00, 30.00)
on conflict (id) do nothing;

insert into public.distance_pricing_rules (min_km, max_km, min_quantity, is_active)
select * from (
  values
    (0.00, 3.00, 5, true),
    (3.00, 5.00, 7, true),
    (5.00, 8.00, 10, true),
    (8.00, 10.00, 12, true),
    (10.00, null::numeric, 15, true)
) as defaults(min_km, max_km, min_quantity, is_active)
where not exists (select 1 from public.distance_pricing_rules);

insert into public.delivery_schedules (
  day_of_week, start_time, end_time, max_orders, is_active
)
select * from (
  values
    (1, '08:00'::time, '10:00'::time, 10, true),
    (1, '10:00'::time, '12:00'::time, 10, true),
    (1, '13:00'::time, '15:00'::time, 10, true),
    (1, '15:00'::time, '17:00'::time, 10, true),
    (2, '08:00'::time, '10:00'::time, 10, true),
    (2, '10:00'::time, '12:00'::time, 10, true),
    (2, '13:00'::time, '15:00'::time, 10, true),
    (2, '15:00'::time, '17:00'::time, 10, true),
    (3, '08:00'::time, '10:00'::time, 10, true),
    (3, '10:00'::time, '12:00'::time, 10, true),
    (3, '13:00'::time, '15:00'::time, 10, true),
    (3, '15:00'::time, '17:00'::time, 10, true),
    (4, '08:00'::time, '10:00'::time, 10, true),
    (4, '10:00'::time, '12:00'::time, 10, true),
    (4, '13:00'::time, '15:00'::time, 10, true),
    (4, '15:00'::time, '17:00'::time, 10, true),
    (5, '08:00'::time, '10:00'::time, 10, true),
    (5, '10:00'::time, '12:00'::time, 10, true),
    (5, '13:00'::time, '15:00'::time, 10, true),
    (5, '15:00'::time, '17:00'::time, 10, true),
    (6, '08:00'::time, '10:00'::time, 10, true),
    (6, '10:00'::time, '12:00'::time, 10, true),
    (6, '13:00'::time, '15:00'::time, 10, true),
    (6, '15:00'::time, '17:00'::time, 10, true)
) as defaults(day_of_week, start_time, end_time, max_orders, is_active)
where not exists (select 1 from public.delivery_schedules);

-- =============================================================================
-- 10. ADMINISTRATOR BOOTSTRAP
--
--  The administrator is created by this SQL file, so no service-role key or
--  `npm run seed:admin` step is required:
--    Email:    admin@gmail.com
--    Password: admin123
--
--  The block is idempotent: re-running the SQL repairs the password, confirms
--  the email, recreates the auth identity and restores the admin role.
-- =============================================================================

do $$
declare
  v_admin_email text := 'admin@gmail.com';
  v_admin_password text := 'admin123';
  v_admin_name text := 'Administrator';
  v_admin_id uuid;
begin
  -- Resolve crypt()/gen_salt() whether pgcrypto is in `extensions` (Supabase
  -- default) or in `public`.
  set local search_path = public, auth, extensions;

  select id
    into v_admin_id
    from auth.users
   where lower(email) = v_admin_email
   limit 1;

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      v_admin_email,
      crypt(v_admin_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', v_admin_name),
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
       set encrypted_password = crypt(v_admin_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_admin_id;
  end if;

  -- Email provider identity, required by GoTrue for password sign-in.
  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    v_admin_id::text,
    v_admin_id,
    jsonb_build_object(
      'sub', v_admin_id::text,
      'email', v_admin_email,
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  insert into public.profiles (id, full_name, email, phone, role, is_active)
  values (v_admin_id, v_admin_name, v_admin_email, null, 'admin', true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role = 'admin',
        is_active = true,
        updated_at = now();
end $$;

-- =============================================================================

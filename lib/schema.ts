// The full database layout. "Set up my database" in the admin runs this.
// Safe to run more than once.
export const SCHEMA_SQL = `
create table if not exists settings (
  key text primary key,
  value jsonb not null
);

create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  mime text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'item' check (kind in ('cookie','item')),
  section text not null default '',
  name text not null,
  description text not null default '',
  image_id uuid references images(id) on delete set null,
  options jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table products add column if not exists tags text[] not null default '{}';

create table if not exists drops (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  pickup_date text not null,
  pickup_hours text not null default '10am – 4pm',
  created_at timestamptz not null default now()
);

create table if not exists drop_limits (
  drop_id uuid not null references drops(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  enabled boolean not null default false,
  qty int not null default 0,
  primary key (drop_id, product_id)
);

create sequence if not exists order_number_seq start 1001;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null unique default nextval('order_number_seq'),
  drop_id uuid references drops(id) on delete set null,
  name text not null,
  phone text not null,
  email text not null,
  fulfillment text not null check (fulfillment in ('pickup','delivery')),
  address text not null default '',
  distance_miles numeric,
  delivery_cents int not null default 0,
  subtotal_cents int not null,
  total_cents int not null,
  notes text not null default '',
  paid_at timestamptz,
  picked_up_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  option_label text not null default '',
  unit_cents int not null,
  quantity int not null,
  flavors jsonb not null default '[]'::jsonb,
  line_cents int not null
);
create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists orders_drop_idx on orders(drop_id);

create table if not exists custom_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  event_date text not null default '',
  details text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists visitor_pings (
  visitor_id text primary key,
  last_seen timestamptz not null default now()
);

create table if not exists daily_visitors (
  day text not null,
  visitor_id text not null,
  primary key (day, visitor_id)
);

-- Added for the weekly schedule, holiday Drops, emails and the email list.
alter table drops add column if not exists kind text not null default 'holiday';
alter table drops add column if not exists paused boolean not null default false;
create unique index if not exists drops_weekly_pickup on drops(pickup_date) where kind = 'weekly';
alter table drop_limits add column if not exists hidden boolean not null default false;
alter table orders add column if not exists ready_at timestamptz;
alter table orders add column if not exists payment_method text not null default '';
alter table orders add column if not exists thanked_at timestamptz;

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  token text not null unique default md5(random()::text || clock_timestamp()::text),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
alter table subscribers enable row level security;

-- Lock every table so only the website's server can read or write it.
alter table settings enable row level security;
alter table images enable row level security;
alter table products enable row level security;
alter table drops enable row level security;
alter table drop_limits enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table custom_requests enable row level security;
alter table visitor_pings enable row level security;
alter table daily_visitors enable row level security;
`;

/** The layout as separate statements, run one at a time (works best with Supabase's pooler). */
export const SCHEMA_STATEMENTS: string[] = SCHEMA_SQL
  .split(/;\s*\n/)
  .map((part) => part.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
  .filter(Boolean);

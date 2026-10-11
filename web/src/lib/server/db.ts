// The archive's database: events, attendance, host profiles, descriptions and usernames,
// kept after events close on-chain. Only the server writes, and only what it
// read from the chain or a wallet signed.
//
// DATABASE_URL  a Postgres connection string. Without it, a local PGlite folder
//               (demo only).

export type Database = {
  /** Runs one SQL statement with $1, $2… parameters and resolves to its rows. */
  query<Row = Record<string, unknown>>(text: string, params?: unknown[]): Promise<Row[]>;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS archived_events (
  address           text PRIMARY KEY,
  organizer         text NOT NULL,
  title             text NOT NULL,
  host_name         text NOT NULL,
  city              text NOT NULL,
  venue             text NOT NULL,
  cover             text NOT NULL,
  luma_slug         text NOT NULL,
  latitude          double precision,
  longitude         double precision,
  stake_mint        text NOT NULL,
  stake_amount      numeric NOT NULL,
  capacity          integer NOT NULL,
  starts_at         bigint NOT NULL,
  check_in_ends_at  bigint NOT NULL,
  guest_count       integer NOT NULL,
  attended_count    integer NOT NULL,
  is_settled        boolean NOT NULL,
  is_cancelled      boolean NOT NULL,
  archived_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS archived_events_by_organizer ON archived_events (organizer, starts_at DESC);

CREATE TABLE IF NOT EXISTS archived_guests (
  event_address  text NOT NULL REFERENCES archived_events (address) ON DELETE CASCADE,
  wallet         text NOT NULL,
  has_attended   boolean NOT NULL,
  PRIMARY KEY (event_address, wallet)
);
CREATE INDEX IF NOT EXISTS archived_guests_by_wallet ON archived_guests (wallet);

CREATE TABLE IF NOT EXISTS hosts (
  wallet          text PRIMARY KEY,
  name            text NOT NULL,
  luma_calendar   text NOT NULL,
  signed_at       timestamptz NOT NULL,
  signature       text NOT NULL,
  registered_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  wallet          text PRIMARY KEY,
  image           bytea NOT NULL,
  sha256          text NOT NULL,
  signed_at       timestamptz NOT NULL,
  signature       text NOT NULL,
  updated_at      timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS usernames (
  wallet          text PRIMARY KEY,
  username        text NOT NULL UNIQUE,
  signed_at       timestamptz NOT NULL,
  signature       text NOT NULL,
  claimed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS released_usernames (
  username        text PRIMARY KEY,
  wallet          text NOT NULL,
  released_at     timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS event_descriptions (
  event_address   text PRIMARY KEY,
  description     text NOT NULL,
  signed_at       timestamptz NOT NULL,
  signature       text NOT NULL
);

CREATE TABLE IF NOT EXISTS event_categories (
  event_address   text PRIMARY KEY,
  category        text NOT NULL,
  signed_at       timestamptz NOT NULL,
  signature       text NOT NULL
);
`;

let database: Promise<Database> | undefined;

/** The archive, connected and with its tables in place. */
export function getDatabase() {
  database ??= connect().catch((error: unknown) => {
    database = undefined; // try again on the next request
    throw error;
  });
  return database;
}

async function connect(): Promise<Database> {
  const db = process.env.DATABASE_URL ? await connectPostgres(process.env.DATABASE_URL) : await connectPglite();
  for (const statement of SCHEMA.split(";").map((part) => part.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  return db;
}

async function connectPostgres(url: string): Promise<Database> {
  const { default: postgres } = await import("postgres");
  // prepare: false works behind the transaction poolers hosted Postgres uses.
  const sql = postgres(url, { max: 5, prepare: false, onnotice: () => {} });
  return {
    query: async (text, params = []) => (await sql.unsafe(text, params as never[])) as never,
  };
}

async function connectPglite(): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  const directory = process.env.ARCHIVE_PGLITE_DIR ?? ".data/archive";
  mkdirSync(directory, { recursive: true });
  const pglite = new PGlite(directory);
  return createPgliteDatabase(pglite);
}

/** Wraps a PGlite instance, which tests create in memory. */
export function createPgliteDatabase(pglite: { query<Row>(text: string, params?: unknown[]): Promise<{ rows: Row[] }> }): Database {
  return { query: async (text, params = []) => (await pglite.query(text, params)).rows as never };
}

/** For tests: use this database instead of connecting, and create its tables. */
export async function useDatabaseForTests(db: Database) {
  for (const statement of SCHEMA.split(";").map((part) => part.trim()).filter(Boolean)) {
    await db.query(statement);
  }
  database = Promise.resolve(db);
}

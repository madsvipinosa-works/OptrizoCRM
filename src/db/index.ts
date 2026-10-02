import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.warn("⚠️ Neither DIRECT_URL nor DATABASE_URL is set in environment variables.");
}

// Global pattern for pg.Pool in Next.js development mode to prevent connection pool exhaustion during hot reloads
const globalForDb = globalThis as unknown as {
    conn: Pool | undefined;
};

const pool =
    globalForDb.conn ??
    new Pool({
        connectionString: connectionString || undefined,
        ssl: connectionString && !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1")
            ? { rejectUnauthorized: false }
            : undefined,
        max: process.env.DB_MAX_CONNECTIONS
            ? Number(process.env.DB_MAX_CONNECTIONS)
            : (process.env.NODE_ENV === "production" ? 1 : 5),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
    });

// Catch errors on idle clients to prevent unhandled exceptions when remote server closes idle connections
pool.on("error", (err) => {
    console.warn("⚠️ [DB Pool] Idle client warning (connection will auto-refresh):", err.message);
});

if (process.env.NODE_ENV !== "production") {
    globalForDb.conn = pool;
}

export const db = drizzle(pool, { schema });

import { expect, vi, type Mock } from "vitest";

type TableMock = { findFirst: Mock; findMany: Mock };

/** A query builder that can be chained in any order and resolves to `rows()` when awaited. */
function chain(rows: () => unknown): object {
    const proxy: object = new Proxy(
        {},
        {
            get(_target, prop) {
                if (prop === "then") {
                    return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
                        Promise.resolve(rows()).then(resolve, reject);
                }
                return () => proxy;
            },
        },
    );
    return proxy;
}

export type MockDb = {
    query: Record<string, TableMock>;
    select: Mock;
    insert: Mock;
    update: Mock;
    delete: Mock;
    execute: Mock;
    transaction: Mock;
    /** Rows returned by `db.select(...)...` chains. */
    setSelectRows(rows: unknown[]): void;
    /** Rows returned by `.returning()` on insert/update/delete chains. */
    setWriteRows(rows: unknown[]): void;
    resetMocks(): void;
};

/**
 * A stand-in for the drizzle `db`. Relational reads (`db.query.<table>.findFirst/findMany`) are mocks
 * created on first use. Builder calls (`select/insert/update/delete`) are chainable spies, so a test can
 * assert that a rejected call never wrote anything.
 */
export function createMockDb(): MockDb {
    const tables = new Map<string, TableMock>();
    const state = { selectRows: [] as unknown[], writeRows: [] as unknown[] };

    const query = new Proxy(
        {},
        {
            get(_target, name: string) {
                if (!tables.has(name)) {
                    tables.set(name, {
                        findFirst: vi.fn().mockResolvedValue(undefined),
                        findMany: vi.fn().mockResolvedValue([]),
                    });
                }
                return tables.get(name);
            },
        },
    ) as Record<string, TableMock>;

    const db: MockDb = {
        query,
        select: vi.fn(() => chain(() => state.selectRows)),
        insert: vi.fn(() => chain(() => state.writeRows)),
        update: vi.fn(() => chain(() => state.writeRows)),
        delete: vi.fn(() => chain(() => state.writeRows)),
        execute: vi.fn().mockResolvedValue({ rows: [] }),
        transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
        setSelectRows(rows) {
            state.selectRows = rows;
        },
        setWriteRows(rows) {
            state.writeRows = rows;
        },
        resetMocks() {
            tables.clear();
            state.selectRows = [];
            state.writeRows = [];
            for (const fn of [db.select, db.insert, db.update, db.delete, db.execute, db.transaction]) fn.mockClear();
        },
    };
    return db;
}

/** Fails the test if anything was written. Reads (`select`, `query.*`) are allowed. */
export function expectNoWrites(db: MockDb) {
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
}

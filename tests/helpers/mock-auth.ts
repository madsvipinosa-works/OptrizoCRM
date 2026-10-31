import { vi, type Mock } from "vitest";

export const ROLES = ["superadmin", "sales", "manager", "developer", "content_editor", "client"] as const;
export type Role = (typeof ROLES)[number];

type SessionLike = { user?: { role?: string } } | null;

function hasRole(session: SessionLike, allowed: string[]) {
    const role = session?.user?.role;
    return !!(role && allowed.includes(role));
}

/** Returns the same helpers the real "@/auth" module exports, with `auth` as a controllable mock. */
export function authModuleMock() {
    return {
        auth: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        handlers: {},
        hasRole,
        requireRole: (session: SessionLike, allowed: string[]) => {
            if (!hasRole(session, allowed)) throw new Error("Unauthorized");
        },
    };
}

export function sessionFor(role: Role, id = `${role}-1`) {
    return { user: { id, role, email: `${id}@example.com`, name: id }, expires: "2099-01-01T00:00:00.000Z" };
}

/** Signs `auth()` in as the given role, or signs out when `role` is null. */
export function signInAs(auth: unknown, role: Role | null, id?: string) {
    (auth as Mock).mockResolvedValue(role ? sessionFor(role, id) : null);
}

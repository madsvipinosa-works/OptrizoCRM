/**
 * Pure account status logic for authentication and session evaluation.
 * No database or ORM dependencies.
 *
 * Truth Table:
 * | Status      | isActive | deletedAt | lockedUntil | canSignIn | isSessionValid | Notes                                           |
 * | :---------- | :------- | :-------- | :---------- | :-------- | :------------- | :---------------------------------------------- |
 * | active      | true     | null      | any/null    | true      | true           | Normal active account                           |
 * | active      | false    | null      | any/null    | false     | false          | Inactive active-status anomaly                  |
 * | any         | any      | non-null  | any         | false     | false          | Soft-deleted user account                       |
 * | invited     | any      | null      | any         | false     | false          | Invited account (cannot sign in or hold session)|
 * | locked      | true     | null      | null        | false     | false          | Manual lock by Super Admin (kills sessions)     |
 * | locked      | true     | null      | Date/truthy | false     | true           | Automatic lock (blocks login, keeps session)    |
 * | deactivated | false    | null      | any         | false     | false          | Deactivated account (kills session)             |
 */

export interface AccountStatusUser {
    status?: string | null;
    isActive?: boolean | null;
    deletedAt?: Date | string | null;
    lockedUntil?: Date | string | null;
}

/**
 * Evaluates whether a user account is allowed to establish a new sign-in session.
 * True ONLY if status === 'active', isActive is true, and deletedAt is not set.
 */
export function canSignIn(user: AccountStatusUser | null | undefined): boolean {
    if (!user) return false;
    if (user.deletedAt) return false;
    if (!user.isActive) return false;
    if (user.status !== "active") return false;
    return true;
}

/**
 * Evaluates whether an existing authenticated session remains valid on subsequent requests.
 *
 * Invalidates (returns false):
 * - If deletedAt is present
 * - If isActive is false
 * - If status is 'deactivated'
 * - If status is 'invited' (invited accounts hold no valid sessions)
 * - If status is 'locked' AND lockedUntil is null (manual administrative lock terminates sessions)
 *
 * Preserves (returns true):
 * - If status is 'active' (with isActive true and no deletedAt)
 * - If status is 'locked' AND lockedUntil is non-null (automatic lockout does not disconnect active sessions)
 */
export function isSessionValid(user: AccountStatusUser | null | undefined): boolean {
    if (!user) return false;
    if (user.deletedAt) return false;
    if (user.isActive === false) return false;
    if (user.status === "deactivated") return false;
    if (user.status === "invited") return false;
    if (user.status === "locked") {
        // Manual lock (lockedUntil null) terminates session; auto-lock (lockedUntil set) preserves session
        return user.lockedUntil != null;
    }
    if (user.status === "active") {
        return user.isActive === true;
    }
    return false;
}


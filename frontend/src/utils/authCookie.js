// ============================================================
// AUTH USER COOKIE
// ============================================================
// JWT tokens stay in backend HttpOnly cookies. Only the
// non-sensitive user details needed for UI rendering are kept
// in this readable cookie.
// ============================================================

const USER_COOKIE = "olp_user";
let inMemoryAuthUser = null;

function cookieAttributes() {
    return "; Path=/; SameSite=Lax; Secure";
}

function readCookie(name) {
    if (typeof document === "undefined" || !document.cookie) {
        return null;
    }

    const prefix = `${name}=`;

    const match = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith(prefix));

    if (!match) {
        return null;
    }

    return match.slice(prefix.length);
}

export function setAuthUser(user) {
    if (!user || typeof user !== "object") {
        clearAuthUser();
        return;
    }

    // Keep the verified UI user available during SPA navigation even when
    // the browser cannot expose a Secure cookie on the current origin.
    inMemoryAuthUser = user;

    if (typeof document !== "undefined") {
        document.cookie =
            `${USER_COOKIE}=` +
            `${encodeURIComponent(JSON.stringify(user))}` +
            cookieAttributes();
    }
}

export function getAuthUser() {
    if (inMemoryAuthUser) {
        return inMemoryAuthUser;
    }

    const value = readCookie(USER_COOKIE);

    if (!value) {
        return null;
    }

    try {
        const user = JSON.parse(decodeURIComponent(value));

        if (user && typeof user === "object" && !Array.isArray(user)) {
            inMemoryAuthUser = user;
            return user;
        }

        return null;
    } catch {
        return null;
    }
}

export function clearAuthUser() {
    inMemoryAuthUser = null;

    if (typeof document === "undefined") {
        return;
    }

    document.cookie =
        `${USER_COOKIE}=; Max-Age=0${cookieAttributes()}`;
}

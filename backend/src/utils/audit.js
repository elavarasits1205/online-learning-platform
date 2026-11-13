// ============================================================
// AUDIT UTILITY
// ============================================================
//
// Purpose:
// Central place for getting the authenticated user's ID.
//
// Audit rules:
//
// Public registration:
//     created_by = NULL
//
// Authenticated create:
//     created_by = req.user.id
//
// Authenticated update:
//     updated_by = req.user.id
//
// Authenticated delete:
//     updated_by = req.user.id
//
// Approval / Rejection:
//     updated_by = req.user.id
//
// created_at:
//     PostgreSQL DEFAULT NOW()
//
// updated_at:
//     Set by the repository to NOW() on update or soft delete.
// ============================================================


// ============================================================
// GET REQUIRED AUDIT USER ID
// ============================================================

const MAX_BIGINT = 9223372036854775807n;

function normalizeAuditUserId(value) {
    const userId = String(value ?? "").trim();

    if (!/^[1-9]\d*$/.test(userId) || BigInt(userId) > MAX_BIGINT) {
        return null;
    }

    // Keep BIGINT identifiers as strings. Converting them to Number can
    // silently change IDs larger than Number.MAX_SAFE_INTEGER.
    return userId;
}

function getAuditUserId(req) {
    const userId = normalizeAuditUserId(req?.user?.id);

    if (!userId) {

        const error = new Error(
            "Authenticated user is required"
        );

        error.statusCode = 401;

        throw error;
    }

    return userId;
}


// ============================================================
// GET OPTIONAL AUDIT USER ID
// ============================================================
//
// Public requests do not have req.user.
//
// Therefore:
//     authenticated request -> user ID
//     public request         -> null
// ============================================================

function getOptionalAuditUserId(req) {
    const rawUserId = req?.user?.id;
    if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
        return null;
    }

    const userId = normalizeAuditUserId(rawUserId);
    if (!userId) {
        const error = new Error("Authenticated user ID is invalid");
        error.statusCode = 401;
        throw error;
    }

    return userId;
}


// ============================================================
// CREATE AUDIT
// ============================================================
//
// authenticated = true
//     Authenticated user is required.
//
// authenticated = false
//     Authentication is optional.
//     Public registration can therefore use NULL.
// ============================================================

function getCreateAudit(
    req,
    authenticated = true
) {

    const createdBy = authenticated
        ? getAuditUserId(req)
        : getOptionalAuditUserId(req);

    return {
        createdBy
    };
}


// ============================================================
// UPDATE AUDIT
// ============================================================
//
// UPDATE always requires an authenticated user.
// ============================================================

function getUpdateAudit(req) {

    return {
        updatedBy: getAuditUserId(req)
    };
}


// ============================================================
// DELETE AUDIT
// ============================================================
//
// Soft delete is an UPDATE.
//
// Therefore:
//     updated_by = authenticated user
// ============================================================

function getDeleteAudit(req) {

    return {
        updatedBy: getAuditUserId(req)
    };
}


// ============================================================
// APPROVAL AUDIT
// ============================================================
//
// Admin approval/rejection is an UPDATE.
// ============================================================

function getApprovalAudit(req) {

    return {
        updatedBy: getAuditUserId(req)
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    getAuditUserId,
    normalizeAuditUserId,
    getOptionalAuditUserId,
    getCreateAudit,
    getUpdateAudit,
    getDeleteAudit,
    getApprovalAudit
};

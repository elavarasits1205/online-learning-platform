
const pool = require("../config/database");

// Never expose password_hash in Admin API responses.
// Never return password_hash. Audit metadata is included for administrator review.
const USER_COLUMNS = `
    u.id::text AS id,
    u.username,
    u.email,
    u.first_name AS "firstName",
    u.last_name AS "lastName",
    u.phone_number AS "phoneNumber",
    u.is_active AS "isActive",
    u.is_locked AS "isLocked",
    u.email_verified_at AS "emailVerifiedAt",
    u.phone_verified_at AS "phoneVerifiedAt",
    u.last_login_at AS "lastLoginAt",
    u.password_changed_at AS "passwordChangedAt",
    u.failed_login_attempts AS "failedLoginAttempts",
    u.locked_until AS "lockedUntil",
    u.soft_delete AS "softDelete",
    u.approval_status AS "approvalStatus",
    u.approved_at AS "approvedAt",
    u.rejection_reason AS "rejectionReason",
    u.created_by::text AS "createdBy",
    u.created_at AS "createdAt",
    u.updated_by::text AS "updatedBy",
    u.updated_at AS "updatedAt"
`;
const ROLE_AGGREGATE = `
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', r.id::text,
                    'code', r.code,
                    'name', r.name,
                    'description', r.description,
                    'isActive', r.is_active
                )
                ORDER BY r.code
            )
            FROM olp_auth.user_role ur
            JOIN olp_auth.role r ON r.id = ur.role_id
            WHERE ur.user_id = u.id
              AND ur.soft_delete = false
              AND r.soft_delete = false
        ),
        '[]'::jsonb
    ) AS roles
`;

function buildFilters({ search = "", role = "", status = "" }) {
    const clauses = ["u.soft_delete = false"];
    const values = [];

    if (search) {
        values.push(`%${search}%`);
        const p = `$${values.length}`;

        clauses.push(`(
            u.username ILIKE ${p}
            OR u.email ILIKE ${p}
            OR u.first_name ILIKE ${p}
            OR COALESCE(u.last_name, '') ILIKE ${p}
            OR COALESCE(u.phone_number, '') ILIKE ${p}
        )`);
    }

    if (role) {
        values.push(role);

        clauses.push(`
            EXISTS (
                SELECT 1
                FROM olp_auth.user_role urf
                JOIN olp_auth.role rf ON rf.id = urf.role_id
                WHERE urf.user_id = u.id
                  AND urf.soft_delete = false
                  AND rf.soft_delete = false
                  AND rf.code = $${values.length}
            )
        `);
    }

    if (status) {
        values.push(status);
        clauses.push(`u.approval_status = $${values.length}`);
    }

    return {
        where: clauses.join(" AND "),
        values
    };
}

// GET /api/admin/users
async function findAllUsers(filters) {
    const { page, limit } = filters;
    const { where, values } = buildFilters(filters);
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
        `SELECT COUNT(*)::text AS total
         FROM olp_auth."user" u
         WHERE ${where}`,
        values
    );

    const dataResult = await pool.query(
        `SELECT ${USER_COLUMNS}, ${ROLE_AGGREGATE}
         FROM olp_auth."user" u
         WHERE ${where}
         ORDER BY u.created_at DESC, u.id DESC
         LIMIT $${values.length + 1}
         OFFSET $${values.length + 2}`,
        [...values, limit, offset]
    );

    return {
        users: dataResult.rows,
        total: Number(countResult.rows[0].total)
    };
}

// GET /api/admin/users/:id
async function findAdminUserById(id) {
    const result = await pool.query(
        `SELECT ${USER_COLUMNS}, ${ROLE_AGGREGATE}
         FROM olp_auth."user" u
         WHERE u.id = $1
           AND u.soft_delete = false`,
        [id]
    );

    return result.rows[0] || null;
}

// PUT /api/admin/users/:id
// PUT /api/admin/users/:id
async function updateAdminUser(id, user) {
    const result = await pool.query(
        `
        UPDATE olp_auth."user" u
        SET username = $2,
            email = $3,
            first_name = $4,
            last_name = $5,
            phone_number = $6,
            is_active = $7,
            is_locked = $8,
            email_verified_at = $9,
            phone_verified_at = $10,
            updated_at = NOW(),
            updated_by = $11
        WHERE u.id = $1
          AND u.soft_delete = false
        RETURNING u.id::text AS id
        `,
        [
            id,
            user.username,
            user.email,
            user.firstName,
            user.lastName,
            user.phoneNumber,
            user.isActive,
            user.isLocked,
            user.emailVerifiedAt,
            user.phoneVerifiedAt,
            user.updatedBy ?? null
        ]
    );

    if (!result.rowCount) {
        return null;
    }

    return findAdminUserById(result.rows[0].id);
}

// DELETE /api/admin/users/:id
// Soft delete; does not physically remove the database row.
async function softDeleteAdminUser(id, updatedBy) {
    const result = await pool.query(
        `UPDATE olp_auth."user"
         SET soft_delete = true,
             is_active = false,
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1
           AND soft_delete = false
         RETURNING
             id::text AS id,
             username,
             email,
             is_active AS "isActive",
             soft_delete AS "softDelete",
             updated_at AS "updatedAt"`,
        [id, updatedBy ?? null]
    );

    return result.rows[0] || null;
}

// GET /api/admin/users/pending
async function findPendingUsers() {
    const result = await pool.query(
        `SELECT ${USER_COLUMNS}, ${ROLE_AGGREGATE}
         FROM olp_auth."user" u
         WHERE u.soft_delete = false
           AND u.approval_status = 'PENDING'
           AND EXISTS (
               SELECT 1
               FROM olp_auth.user_role ur
               JOIN olp_auth.role r ON r.id = ur.role_id
               WHERE ur.user_id = u.id
                 AND ur.soft_delete = false
                 AND r.soft_delete = false
                 AND r.code = 'INSTRUCTOR'
           )
         ORDER BY u.created_at ASC, u.id ASC`
    );

    return result.rows;
}

// POST /api/admin/users/:id/approve
async function approveUser(id, updatedBy) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `UPDATE olp_auth."user" u
             SET approval_status = 'APPROVED',
                 is_active = true,
                 approved_at = NOW(),
                 approved_by = $2,
                 rejection_reason = NULL,
                 updated_at = NOW(),
                 updated_by = $2
             WHERE u.id = $1
               AND u.soft_delete = false
               AND u.approval_status = 'PENDING'
               AND EXISTS (
                   SELECT 1
                   FROM olp_auth.user_role ur
                   JOIN olp_auth.role r ON r.id = ur.role_id
                   WHERE ur.user_id = u.id
                     AND ur.soft_delete = false
                     AND r.soft_delete = false
                     AND r.code = 'INSTRUCTOR'
               )
             RETURNING
                 u.id::text AS id,
                 u.approval_status,
                 u.is_active,
                 u.approved_at,
                 u.approved_by::text AS approved_by`,
            [id, updatedBy ?? null]
        );

        const approvedUser = result.rows[0];
        if (!approvedUser) {
            await client.query("COMMIT");
            return null;
        }

        const instructorResult = await client.query(
            `UPDATE learning.instructor i
             SET is_active = TRUE,
                 referral_code = COALESCE(
                     NULLIF(BTRIM(i.referral_code), ''),
                     'INS' || (i.id + 1000)::text
                 ),
                 updated_at = NOW(),
                 updated_by = $2
             WHERE i.user_id = $1
               AND i.soft_delete = FALSE
             RETURNING i.referral_code`,
            [id, updatedBy ?? null]
        );

        if (!instructorResult.rowCount) {
            const error = new Error(
                "Instructor profile not found; approval was not completed."
            );
            error.statusCode = 409;
            throw error;
        }

        await client.query("COMMIT");
        return {
            ...approvedUser,
            referral_code: instructorResult.rows[0].referral_code
        };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}

// POST /api/admin/users/:id/reject
async function rejectUser(id, updatedBy, reason) {
    const result = await pool.query(
        `UPDATE olp_auth."user" u
         SET approval_status = 'REJECTED',
             is_active = false,
             approved_at = NULL,
             approved_by = NULL,
             rejection_reason = $3,
             updated_at = NOW(),
             updated_by = $2
         WHERE u.id = $1
           AND u.soft_delete = false
           AND u.approval_status = 'PENDING'
           AND EXISTS (
               SELECT 1
               FROM olp_auth.user_role ur
               JOIN olp_auth.role r ON r.id = ur.role_id
               WHERE ur.user_id = u.id
                 AND ur.soft_delete = false
                 AND r.soft_delete = false
                 AND r.code = 'INSTRUCTOR'
           )
         RETURNING
             u.id::text AS id,
             u.approval_status,
             u.is_active,
             u.rejection_reason`,
        [id, updatedBy ?? null, reason]
    );

    return result.rows[0] || null;
}

module.exports = {
    findAllUsers,
    findAdminUserById,
    updateAdminUser,
    softDeleteAdminUser,
    findPendingUsers,
    approveUser,
    rejectUser
};

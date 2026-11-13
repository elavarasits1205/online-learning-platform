const pool = require("../config/database");


// ============================================================
// USER LOOKUPS
// ============================================================

async function findUserByEmail(
    email,
    client = pool
) {

    const result = await client.query(
        `
        SELECT
            id,
            username,
            email,
            password_hash,
            first_name,
            last_name,
            phone_number,
            is_active,
            is_locked,
            email_verified_at,
            phone_verified_at,
            last_login_at,
            password_changed_at,
            failed_login_attempts,
            locked_until,
            last_login_ip,
            soft_delete,
            approval_status,
            approved_at,
            approved_by,
            rejection_reason,
            created_at,
            created_by,
            updated_at,
            updated_by,
            session_version
        FROM olp_auth."user"
        WHERE LOWER(email) = LOWER($1)
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [email]
    );

    return result.rows[0] || null;
}


// ============================================================
// FIND USER BY USERNAME OR EMAIL
// ============================================================

async function findUserByUsernameOrEmail(
    identifier,
    client = pool
) {

    const result = await client.query(
        `
        SELECT
            id,
            username,
            email,
            password_hash,
            first_name,
            last_name,
            phone_number,
            is_active,
            is_locked,
            email_verified_at,
            phone_verified_at,
            last_login_at,
            password_changed_at,
            failed_login_attempts,
            locked_until,
            last_login_ip,
            soft_delete,
            approval_status,
            approved_at,
            approved_by,
            rejection_reason,
            created_at,
            created_by,
            updated_at,
            updated_by,
            session_version
        FROM olp_auth."user"
        WHERE (
            LOWER(username) = LOWER($1)
            OR LOWER(email) = LOWER($1)
        )
        AND soft_delete = FALSE
        LIMIT 1
        `,
        [identifier]
    );

    return result.rows[0] || null;
}


// ============================================================
// FIND USER BY ID
// ============================================================

async function findUserById(
    userId,
    client = pool
) {

    const result = await client.query(
        `
        SELECT
            id,
            username,
            email,
            password_hash,
            first_name,
            last_name,
            phone_number,
            is_active,
            is_locked,
            email_verified_at,
            phone_verified_at,
            last_login_at,
            password_changed_at,
            failed_login_attempts,
            locked_until,
            last_login_ip,
            soft_delete,
            approval_status,
            approved_at,
            approved_by,
            rejection_reason,
            created_at,
            created_by,
            updated_at,
            updated_by,
            session_version
        FROM olp_auth."user"
        WHERE id = $1
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [userId]
    );

    return result.rows[0] || null;
}


// Update the authenticated user's editable profile fields.
async function updateCurrentUserProfile(
    userId,
    profile,
    client = pool
) {
    const result = await client.query(
        `
        UPDATE olp_auth."user"
        SET username = $2,
            first_name = $3,
            last_name = $4,
            updated_at = NOW(),
            updated_by = $5
        WHERE id = $1
          AND soft_delete = FALSE
        RETURNING id::text AS id
        `,
        [
            userId,
            profile.username,
            profile.firstName,
            profile.lastName,
            profile.updatedBy
        ]
    );

    return result.rows[0] || null;
}


// ============================================================
// REGISTRATION CHECK - EMAIL
// ============================================================

async function findUserByEmailForRegistration(
    email,
    client
) {

    const result = await client.query(
        `
        SELECT
            id
        FROM olp_auth."user"
        WHERE LOWER(email) = LOWER($1)
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [email]
    );

    return result.rows[0] || null;
}


// ============================================================
// REGISTRATION CHECK - USERNAME
// ============================================================

async function findUserByUsernameForRegistration(
    username,
    client
) {

    const result = await client.query(
        `
        SELECT
            id
        FROM olp_auth."user"
        WHERE LOWER(username) = LOWER($1)
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [username]
    );

    return result.rows[0] || null;
}


// ============================================================
// CREATE USER
// ============================================================

async function createUser(
    client,
    data
) {

    const result = await client.query(
        `
        INSERT INTO olp_auth."user" (
            username,
            email,
            password_hash,
            first_name,
            last_name,
            phone_number,
            is_active,
            approval_status,
            created_by
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
        )
        RETURNING
            id,
            username,
            email,
            first_name,
            last_name,
            phone_number,
            is_active,
            approval_status,
            created_at,
            created_by,
            updated_at,
            updated_by
        `,
        [
            data.username,
            data.email,
            data.passwordHash,
            data.firstName,
            data.lastName ?? null,
            data.phoneNumber ?? null,
            data.isActive,
            data.approvalStatus,
            data.createdBy ?? null
        ]
    );

    return result.rows[0];
}


// ============================================================
// ROLE LOOKUP
// ============================================================

async function findRoleByCode(
    code,
    client
) {

    const result = await client.query(
        `
        SELECT
            id,
            code,
            name,
            description
        FROM olp_auth.role
        WHERE code = $1
          AND is_active = TRUE
          AND soft_delete = FALSE
        LIMIT 1
        `,
        [code]
    );

    return result.rows[0] || null;
}


// ============================================================
// ASSIGN OR REACTIVATE USER ROLE
// ============================================================

async function assignRole(
    client,
    userId,
    roleId,
    createdBy = null
) {
    const result = await client.query(
        `
        INSERT INTO olp_auth.user_role (
            user_id,
            role_id,
            is_active,
            soft_delete,
            created_by
        )
        VALUES ($1, $2, TRUE, FALSE, $3)

        ON CONFLICT (user_id, role_id)
        DO UPDATE SET
            is_active = TRUE,
            soft_delete = FALSE,
            updated_at = NOW(),
            updated_by = EXCLUDED.created_by

        RETURNING *
        `,
        [userId, roleId, createdBy]
    );

    return result.rows[0];
}


// ============================================================
// USER ROLES
// ============================================================

async function getUserRoles(
    userId,
    client = pool
) {

    const result = await client.query(
        `
        SELECT
            r.id,
            r.code,
            r.name,
            r.description
        FROM olp_auth.user_role ur

        INNER JOIN olp_auth.role r
            ON r.id = ur.role_id

        WHERE ur.user_id = $1
          AND r.is_active = TRUE
          AND r.soft_delete = FALSE

        ORDER BY r.id
        `,
        [userId]
    );

    return result.rows;
}



// ============================================================
// RBAC: GET CURRENT USER PERMISSIONS
// ============================================================

// ============================================================
// RBAC: GET CURRENT USER PERMISSIONS
// ============================================================

async function getUserPermissions(userId, client = pool) {
    const result = await client.query(
        `
        SELECT DISTINCT
            p.id,
            p.code,
            p.module_code,
            p.resource_code,
            p.action_code,
            p.name,
            p.description

        FROM olp_auth.user_role ur

        INNER JOIN olp_auth."role" r
            ON r.id = ur.role_id

        INNER JOIN olp_auth.role_permission rp
            ON rp.role_id = r.id

        INNER JOIN olp_auth."permission" p
            ON p.id = rp.permission_id

        WHERE ur.user_id = $1
          AND ur.is_active = TRUE
          AND ur.soft_delete = FALSE

          AND r.is_active = TRUE
          AND r.soft_delete = FALSE

          AND rp.is_active = TRUE

          AND p.is_active = TRUE
          AND p.soft_delete = FALSE

        ORDER BY p.code
        `,
        [userId]
    );

    return result.rows;
}




// ============================================================
// LOGIN SUCCESS AUDIT
// ============================================================

async function updateLoginSuccess(
    userId,
    ipAddress,
    client = pool
) {

    await client.query(
        `
        UPDATE olp_auth."user"
        SET
            last_login_at = NOW(),
            last_login_ip = $2,
            failed_login_attempts = 0,
            is_locked = FALSE,
            locked_until = NULL,
            updated_by = $1
        WHERE id = $1
        `,
        [
            userId,
            ipAddress ?? null
        ]
    );
}


// ============================================================
// LOGIN FAILURE
// ============================================================
//
// No updated_by because password authentication failed.
// ============================================================

async function updateLoginFailure(
    userId,
    client = pool
) {

    await client.query(
        `
        UPDATE olp_auth."user"
        SET
            failed_login_attempts =
                failed_login_attempts + 1
        WHERE id = $1
        `,
        [userId]
    );
}


// ============================================================
// CREATE REFRESH TOKEN
// ============================================================

async function createRefreshToken(
    data,
    client = pool
) {

    const result = await client.query(
        `
        INSERT INTO olp_auth.refresh_token (
            user_id,
            token_hash,
            expires_at,
            issued_at,
            ip_address,
            user_agent,
            session_version,
            created_by
        )
        VALUES (
            $1,
            $2,
            $3,
            NOW(),
            $4,
            $5,
            $6,
            $7
        )
        RETURNING *
        `,
        [
            data.userId,
            data.tokenHash,
            data.expiresAt,
            data.ipAddress ?? null,
            data.userAgent ?? null,
            data.sessionVersion ?? 0,
            data.createdBy ?? null
        ]
    );

    return result.rows[0];
}


// ============================================================
// FIND REFRESH TOKEN
// ============================================================

async function findRefreshTokenByHash(
    tokenHash,
    client = pool
) {

    const result = await client.query(
        `
        SELECT
            rt.id,
            rt.user_id,
            rt.token_hash,
            rt.expires_at,
            rt.issued_at,
            rt.revoked_at,
            rt.revoked_by,
            rt.replaced_by_token_id,
            rt.last_used_at,
            rt.ip_address,
            rt.user_agent,
            rt.soft_delete,
            rt.session_version AS token_session_version,

            u.is_active,
            u.is_locked,
            u.locked_until,
            u.soft_delete AS user_soft_delete,
            u.approval_status,
            u.session_version AS current_session_version

        FROM olp_auth.refresh_token rt

        INNER JOIN olp_auth."user" u
            ON u.id = rt.user_id

        WHERE rt.token_hash = $1
          AND rt.soft_delete = FALSE

        LIMIT 1
        `,
        [tokenHash]
    );

    return result.rows[0] || null;
}


// ============================================================
// UPDATE REFRESH TOKEN LAST USED
// ============================================================

async function updateRefreshTokenLastUsed(
    tokenHash,
    client = pool
) {

    await client.query(
        `
        UPDATE olp_auth.refresh_token
        SET
            last_used_at = NOW()
        WHERE token_hash = $1
        `,
        [tokenHash]
    );
}

// ============================================================
// FIND PENDING USERS
// ============================================================

async function findPendingUsers(
    client = pool
) {

    const result =
        await client.query(
            `
            SELECT
                u.id,
                u.username,
                u.email,
                u.first_name,
                u.last_name,
                u.phone_number,
                u.approval_status,
                u.is_active,
                u.created_at,
                u.created_by,

                i.id AS instructor_id,
                i.instructor_code,
                i.specialization,
                i.qualification,
                i.experience_years,
                i.designation,
                i.bio

            FROM olp_auth."user" u

            INNER JOIN learning.instructor i
                ON i.user_id = u.id

            WHERE u.approval_status = 'PENDING'
              AND u.soft_delete = FALSE
              AND i.soft_delete = FALSE

            ORDER BY u.created_at ASC
            `
        );

    return result.rows;
}
// ============================================================
// APPROVE USER
// ============================================================

async function approveUser(
    userId,
    adminUserId
) {

    const client =
        await pool.connect();

    try {

        await client.query("BEGIN");


        // ----------------------------------------------------
        // APPROVE USER
        // ----------------------------------------------------

        const userResult =
            await client.query(
                `
                UPDATE olp_auth."user"

                SET
                    approval_status = 'APPROVED',
                    is_active = TRUE,
                    approved_at = NOW(),
                    approved_by = $2,
                    updated_by = $2

                WHERE id = $1
                  AND soft_delete = FALSE
                  AND approval_status = 'PENDING'

                RETURNING
                    id,
                    username,
                    email,
                    approval_status,
                    is_active,
                    approved_at,
                    approved_by,
                    updated_at,
                    updated_by
                `,
                [
                    userId,
                    adminUserId
                ]
            );


        if (!userResult.rows[0]) {

            const error =
                new Error(
                    "User is not pending approval"
                );

            error.statusCode = 400;

            throw error;
        }


        // ----------------------------------------------------
        // ACTIVATE INSTRUCTOR PROFILE
        // ----------------------------------------------------

        await client.query(
            `
            UPDATE learning.instructor

            SET
                is_active = TRUE,
                updated_by = $2

            WHERE user_id = $1
              AND soft_delete = FALSE
            `,
            [
                userId,
                adminUserId
            ]
        );


        await client.query("COMMIT");


        return userResult.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();
    }
}

// ============================================================
// REJECT USER
// ============================================================

async function rejectUser(
    userId,
    adminUserId,
    reason
) {

    const client =
        await pool.connect();

    try {

        await client.query("BEGIN");


        // ----------------------------------------------------
        // REJECT USER
        // ----------------------------------------------------

        const userResult =
            await client.query(
                `
                UPDATE olp_auth."user"

                SET
                    approval_status = 'REJECTED',
                    is_active = FALSE,
                    rejection_reason = $3,
                    updated_by = $2

                WHERE id = $1
                  AND soft_delete = FALSE
                  AND approval_status = 'PENDING'

                RETURNING
                    id,
                    username,
                    email,
                    approval_status,
                    is_active,
                    rejection_reason,
                    updated_at,
                    updated_by
                `,
                [
                    userId,
                    adminUserId,
                    reason || null
                ]
            );


        if (!userResult.rows[0]) {

            const error =
                new Error(
                    "User is not pending approval"
                );

            error.statusCode = 400;

            throw error;
        }


        // ----------------------------------------------------
        // DISABLE INSTRUCTOR PROFILE
        // ----------------------------------------------------

        await client.query(
            `
            UPDATE learning.instructor

            SET
                is_active = FALSE,
                updated_by = $2

            WHERE user_id = $1
              AND soft_delete = FALSE
            `,
            [
                userId,
                adminUserId
            ]
        );


        await client.query("COMMIT");


        return userResult.rows[0];

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();
    }
}
// ============================================================
// RBAC: GET CURRENT USER ROLES
// ============================================================
// ============================================================
// GET ACTIVE ROLES ASSIGNED TO USER
// ============================================================

async function getUserRoles(userId, client = pool) {
    const result = await client.query(
        `
        SELECT DISTINCT
            r.id,
            r.code,
            r.name,
            r.description
        FROM olp_auth.user_role ur
        INNER JOIN olp_auth."role" r
            ON r.id = ur.role_id
        WHERE ur.user_id = $1
          AND ur.is_active = TRUE
          AND ur.soft_delete = FALSE
          AND r.is_active = TRUE
          AND r.soft_delete = FALSE
        ORDER BY r.code
        `,
        [userId]
    );

    return result.rows;
}
// ============================================================
// RBAC: GET CURRENT USER PERMISSIONS
// ============================================================

async function getUserPermissions(userId, client = pool) {
    const result = await client.query(
        `
        SELECT DISTINCT
            p.id,
            p.code,
            p.module_code,
            p.resource_code,
            p.action_code,
            p.name,
            p.description
        FROM olp_auth.user_role ur
        INNER JOIN olp_auth."role" r
            ON r.id = ur.role_id
        INNER JOIN olp_auth.role_permission rp
            ON rp.role_id = r.id
        INNER JOIN olp_auth."permission" p
            ON p.id = rp.permission_id
        WHERE ur.user_id = $1
          AND ur.is_active = TRUE
          AND ur.soft_delete = FALSE
          AND r.is_active = TRUE
          AND r.soft_delete = FALSE
          AND rp.is_active = TRUE
          AND p.is_active = TRUE
          AND p.soft_delete = FALSE
        ORDER BY
            p.module_code,
            p.resource_code,
            p.action_code
        `,
        [userId]
    );

    return result.rows;
} 


// ============================================================
// RBAC: GET VISIBLE MENUS FOR USER
// ============================================================

// ============================================================
// GET VISIBLE MENUS FOR USER
// ============================================================

async function getUserMenus(userId, client = pool) {
    const query = `
        WITH granted_permissions AS (
            SELECT DISTINCT
                UPPER(BTRIM(p.module_code)) AS module_code,
                UPPER(BTRIM(p.resource_code)) AS resource_code,
                UPPER(p.action_code) AS action_code,
                UPPER(p.code) AS permission_code
            FROM olp_auth.user_role ur

            INNER JOIN olp_auth."role" r
                ON r.id = ur.role_id

            INNER JOIN olp_auth.role_permission rp
                ON rp.role_id = ur.role_id

            INNER JOIN olp_auth."permission" p
                ON p.id = rp.permission_id

            WHERE ur.user_id = $1
              AND ur.is_active = TRUE
              AND ur.soft_delete = FALSE
              AND r.is_active = TRUE
              AND r.soft_delete = FALSE
              AND rp.is_active = TRUE
              AND p.is_active = TRUE
              AND p.soft_delete = FALSE
        ),

        menu_access AS (
            SELECT
                m.id,
                m.parent_id,
                m.code,
                m.name,
                m.menu_type,
                m.route_path AS path,
                m.icon,
                m.sort_order,
                m.is_parent,

                UPPER(base_p.module_code) AS module_code,
                UPPER(base_p.resource_code) AS resource_code,

                COALESCE(
                    BOOL_OR(
                        gp.action_code IN (
                            'VIEW', 'READ', 'LIST', 'GET'
                        )
                    ),
                    FALSE
                ) AS can_view,

                COALESCE(
                    BOOL_OR(
                        gp.action_code IN ('ADD', 'CREATE')
                    ),
                    FALSE
                ) AS can_add,

                COALESCE(
                    BOOL_OR(
                        gp.action_code IN ('EDIT', 'UPDATE')
                    ),
                    FALSE
                ) AS can_edit,

                COALESCE(
                    BOOL_OR(gp.action_code = 'DELETE'),
                    FALSE
                ) AS can_delete,

                COALESCE(
                    BOOL_OR(gp.action_code = 'APPROVE'),
                    FALSE
                ) AS can_approve,

                COALESCE(
                    BOOL_OR(gp.action_code = 'PUBLISH'),
                    FALSE
                ) AS can_publish,

                COALESCE(
                    BOOL_OR(gp.permission_code IS NOT NULL),
                    FALSE
                ) AS has_any_permission

            FROM olp_auth.menu m

            LEFT JOIN olp_auth."permission" base_p
                ON base_p.id = m.permission_id
               AND base_p.is_active = TRUE
               AND base_p.soft_delete = FALSE

            LEFT JOIN granted_permissions gp
                ON (
                    gp.module_code = UPPER(BTRIM(base_p.module_code))
                    AND gp.resource_code = UPPER(BTRIM(base_p.resource_code))
                )
                OR UPPER(BTRIM(m.code)) = gp.module_code
                OR UPPER(BTRIM(m.code)) = gp.resource_code

            WHERE m.is_active = TRUE
              AND m.soft_delete = FALSE

            GROUP BY
                m.id,
                m.parent_id,
                m.code,
                m.name,
                m.menu_type,
                m.route_path,
                m.icon,
                m.sort_order,
                m.is_parent,
                base_p.module_code,
                base_p.resource_code
        )

        SELECT
            ma.id,
            ma.code,
            ma.name,
            ma.parent_id,
            ma.menu_type,
            ma.path,
            ma.icon,
            ma.sort_order,
            ma.is_parent,
            ma.module_code,
            ma.resource_code,
            ma.can_view,
            ma.can_add,
            ma.can_edit,
            ma.can_delete,
            ma.can_approve,
            ma.can_publish,
            ma.has_any_permission

        FROM menu_access ma

        ORDER BY
            COALESCE(ma.parent_id, ma.id),
            ma.sort_order,
            ma.id
    `;

    const result = await client.query(query, [userId]);

    return result.rows;
}



// ============================================================
// REVOKE REFRESH TOKEN
// ============================================================

async function revokeRefreshToken(
    tokenHash,
    revokedBy = null,
    replacedByTokenId = null,
    client = pool
) {

    await client.query(
        `
        UPDATE olp_auth.refresh_token
        SET
            revoked_at = COALESCE(
                revoked_at,
                NOW()
            ),

            revoked_by = COALESCE(
                revoked_by,
                $2
            ),

            replaced_by_token_id = COALESCE(
                replaced_by_token_id,
                $3
            ),

            updated_by = $2

        WHERE token_hash = $1
          AND revoked_at IS NULL
        `,
        [
            tokenHash,
            revokedBy,
            replacedByTokenId
        ]
    );
}

async function invalidateAllSessions(userId, passwordHash = null) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const userResult = passwordHash
            ? await client.query(
                `UPDATE olp_auth."user"
                 SET password_hash = $2,
                     password_changed_at = NOW(),
                     session_version = session_version + 1,
                     failed_login_attempts = 0,
                     is_locked = FALSE,
                     locked_until = NULL,
                     updated_at = NOW(),
                     updated_by = $1
                 WHERE id = $1 AND soft_delete = FALSE
                 RETURNING id`,
                [userId, passwordHash]
            )
            : await client.query(
                `UPDATE olp_auth."user"
                 SET session_version = session_version + 1,
                     updated_at = NOW(),
                     updated_by = $1
                 WHERE id = $1 AND soft_delete = FALSE
                 RETURNING id`,
                [userId]
            );

        if (!userResult.rowCount) {
            await client.query("ROLLBACK");
            return false;
        }

        await client.query(
            `UPDATE olp_auth.refresh_token
             SET revoked_at = COALESCE(revoked_at, NOW()),
                 revoked_by = $1,
                 updated_by = $1
             WHERE user_id = $1
               AND revoked_at IS NULL
               AND soft_delete = FALSE`,
            [userId]
        );
        await client.query("COMMIT");
        return true;
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    findUserByEmail,
    findUserByUsernameOrEmail,
    findUserById,
    updateCurrentUserProfile,
    findUserByEmailForRegistration,
    findUserByUsernameForRegistration,
    createUser,
    findRoleByCode,
    assignRole,
    findPendingUsers,
    approveUser,
    rejectUser,
    getUserRoles,
    getUserPermissions,
    getUserMenus,
    updateLoginSuccess,
    updateLoginFailure,
    createRefreshToken,
    findRefreshTokenByHash,
    updateRefreshTokenLastUsed,
    revokeRefreshToken,
    invalidateAllSessions
};

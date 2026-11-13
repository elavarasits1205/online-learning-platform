
const pool = require("../config/database");

// ============================================================
// FIND INSTRUCTOR BY USER ID
// Usage: findInstructorByUserId(pool, userId)
// ============================================================

async function findInstructorByUserId(
    client = pool,
    userId
) {
    const query = `
        SELECT
            i.id,
            i.user_id,
            i.instructor_code,
            i.referral_code,
            i.specialization,
            i.qualification,
            i.experience_years,
            i.profile_image_url,
            i.bio,
            i.designation,
            i.joined_at,
            i.is_active,
            i.created_at,
            i.created_by,
            i.updated_at,
            i.updated_by
        FROM learning.instructor i
        WHERE i.user_id = $1
          AND i.soft_delete = FALSE
        LIMIT 1
    `;

    const result = await client.query(query, [userId]);
    return result.rows[0] || null;
}

// ============================================================
// FIND ACTIVE INSTRUCTOR BY REFERRAL CODE
// Usage: findActiveInstructorByReferralCode(client, code)
// ============================================================

async function findActiveInstructorByReferralCode(
    client = pool,
    referralCode
) {
    const normalizedCode = String(referralCode || "").trim().toUpperCase();
    if (!normalizedCode) return null;

    const query = `
        SELECT
            i.id,
            i.user_id,
            i.referral_code
        FROM learning.instructor i
        JOIN olp_auth."user" u ON u.id = i.user_id
        WHERE UPPER(BTRIM(i.referral_code)) = $1
          AND i.is_active = TRUE
          AND i.soft_delete = FALSE
          AND u.is_active = TRUE
          AND u.soft_delete = FALSE
          AND UPPER(u.approval_status) = 'APPROVED'
        LIMIT 1
    `;

    const result = await client.query(query, [normalizedCode]);
    return result.rows[0] || null;
}

// ============================================================
// CREATE INSTRUCTOR
// Usage: createInstructor(client, data)
// ============================================================

async function createInstructor(client, data) {
    const query = `
        INSERT INTO learning.instructor (
            user_id,
            instructor_code,
            specialization,
            qualification,
            experience_years,
            designation,
            bio,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
            id,
            user_id,
            instructor_code,
            referral_code,
            specialization,
            qualification,
            experience_years,
            designation,
            bio,
            joined_at,
            is_active,
            created_at,
            created_by,
            updated_at,
            updated_by
    `;

    const values = [
        data.userId,
        data.instructorCode,
        data.specialization ?? null,
        data.qualification ?? null,
        data.experienceYears ?? null,
        data.designation ?? null,
        data.bio ?? null,
        data.createdBy ?? null
    ];

    const result = await client.query(query, values);
    return result.rows[0];
}

// ============================================================
// UPDATE INSTRUCTOR
// Usage: updateInstructor(client, instructorId, data)
// ============================================================

async function updateInstructor(client, instructorId, data) {
    if (!data.updatedBy) {
        const error = new Error("updatedBy is required");
        error.statusCode = 400;
        throw error;
    }

    const query = `
        UPDATE learning.instructor
        SET
            specialization = COALESCE($2, specialization),
            qualification = COALESCE($3, qualification),
            experience_years = COALESCE($4, experience_years),
            profile_image_url = COALESCE($5, profile_image_url),
            bio = COALESCE($6, bio),
            designation = COALESCE($7, designation),
            updated_at = NOW(),
            updated_by = $8
        WHERE id = $1
          AND soft_delete = FALSE
        RETURNING
            id,
            user_id,
            instructor_code,
            referral_code,
            specialization,
            qualification,
            experience_years,
            profile_image_url,
            bio,
            designation,
            joined_at,
            is_active,
            created_at,
            created_by,
            updated_at,
            updated_by
    `;

    const values = [
        instructorId,
        data.specialization ?? null,
        data.qualification ?? null,
        data.experienceYears ?? null,
        data.profileImageUrl ?? null,
        data.bio ?? null,
        data.designation ?? null,
        data.updatedBy
    ];

    const result = await client.query(query, values);
    return result.rows[0] || null;
}

// ============================================================
// SOFT DELETE INSTRUCTOR
// Usage: softDeleteInstructor(client, instructorId, deletedBy)
// ============================================================

async function softDeleteInstructor(client, instructorId, deletedBy) {
    if (!deletedBy) {
        const error = new Error("deletedBy is required");
        error.statusCode = 400;
        throw error;
    }

    const query = `
        UPDATE learning.instructor
        SET
            soft_delete = TRUE,
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1
          AND soft_delete = FALSE
        RETURNING
            id,
            user_id,
            soft_delete,
            created_at,
            created_by,
            updated_at,
            updated_by
    `;

    const result = await client.query(
        query,
        [instructorId, deletedBy]
    );

    return result.rows[0] || null;
}

module.exports = {
    findInstructorByUserId,
    findActiveInstructorByReferralCode,
    createInstructor,
    updateInstructor,
    softDeleteInstructor
};

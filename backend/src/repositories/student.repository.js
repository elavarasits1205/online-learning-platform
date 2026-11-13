const pool = require("../config/database");


// ============================================================
// FIND STUDENT BY USER ID
// ============================================================

async function findStudentByUserId(
    client = pool,
    userId
) {
    const query = `
        SELECT
            s.id,
            s.user_id,
            s.institution_id,
            s.register_number,
            s.student_code,
            s.date_of_birth,
            s.gender,
            s.profile_image_url,
            s.address_line1,
            s.address_line2,
            s.city,
            s.state,
            s.postal_code,
            s.country,
            s.bio,
            s.joined_at,
            s.is_active,

            -- Audit fields
            s.created_at,
            s.created_by,
            s.updated_at,
            s.updated_by

        FROM learning.student s

        WHERE s.user_id = $1
          AND s.soft_delete = FALSE

        LIMIT 1
    `;

    const result = await client.query(
        query,
        [userId]
    );

    return result.rows[0] || null;
}


// ============================================================
// FIND STUDENT BY REGISTER NUMBER
// ============================================================
// This function is NOT used by public registration anymore.
//
// Keep it only if your application needs register-number
// lookup later.
// ============================================================

async function findStudentByRegisterNumber(
    client = pool,
    institutionId,
    registerNumber
) {
    const query = `
        SELECT
            id,
            user_id,
            institution_id,
            register_number,
            student_code,
            date_of_birth,
            gender,

            -- Audit fields
            created_at,
            created_by,
            updated_at,
            updated_by

        FROM learning.student

        WHERE institution_id = $1
          AND register_number = $2
          AND soft_delete = FALSE

        LIMIT 1
    `;

    const result = await client.query(
        query,
        [
            institutionId,
            registerNumber
        ]
    );

    return result.rows[0] || null;
}


// ============================================================
// CREATE STUDENT
// ============================================================
// Public student registration:
//
// created_by = NULL
//
// Admin-created student:
//
// created_by = authenticated admin ID
//
// created_at is handled by PostgreSQL DEFAULT NOW().
//
// updated_at is handled by PostgreSQL trigger.
// ============================================================


async function createStudent(client, data) {
    const query = `
        INSERT INTO learning.student (
            user_id,
            institution_id,
            register_number,
            student_code,
            date_of_birth,
            gender,
            referred_by_instructor_id,
            referred_at,
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
            CASE WHEN $7::bigint IS NULL THEN NULL ELSE NOW() END,
            $8
        )
        RETURNING
            id,
            user_id,
            institution_id,
            register_number,
            student_code,
            date_of_birth,
            gender,
            referred_by_instructor_id,
            referred_at,
            joined_at,
            is_active,
            created_at,
            created_by,
            updated_at,
            updated_by
    `;

    const result = await client.query(query, [
        data.userId,
        data.institutionId,
        data.registerNumber,
        data.studentCode,
        data.dateOfBirth || null,
        data.gender || null,
        data.referredByInstructorId ?? null,
        data.createdBy ?? null,
    ]);

    return result.rows[0];
}



// ============================================================
// UPDATE STUDENT
// ============================================================
// Important audit rules:
//
// 1. created_by is NEVER changed.
// 2. created_at is NEVER changed.
// 3. updated_by = authenticated user.
// 4. updated_at is automatically changed by DB trigger.
//
// COALESCE means:
// If a field is not supplied, the old value is retained.
// ============================================================

async function updateStudent(
    client,
    studentId,
    data
) {
    if (!data.updatedBy) {
        const error = new Error(
            "updatedBy is required for student update"
        );

        error.statusCode = 401;

        throw error;
    }

    const query = `
        UPDATE learning.student

        SET
            institution_id = COALESCE(
                $2,
                institution_id
            ),

            register_number = COALESCE(
                $3,
                register_number
            ),

            date_of_birth = COALESCE(
                $4,
                date_of_birth
            ),

            gender = COALESCE(
                $5,
                gender
            ),

            updated_by = $6

        WHERE id = $1
          AND soft_delete = FALSE

        RETURNING
            id,
            user_id,
            institution_id,
            register_number,
            student_code,
            date_of_birth,
            gender,
            joined_at,
            is_active,

            -- Audit fields
            created_at,
            created_by,
            updated_at,
            updated_by
    `;

    const result = await client.query(
        query,
        [
            studentId,
            data.institutionId ?? null,
            data.registerNumber ?? null,
            data.dateOfBirth ?? null,
            data.gender ?? null,
            data.updatedBy
        ]
    );

    return result.rows[0] || null;
}


// ============================================================
// SOFT DELETE STUDENT
// ============================================================
// Soft delete is treated as an UPDATE.
//
// Therefore:
//
// created_by  -> unchanged
// created_at  -> unchanged
// updated_by  -> authenticated user
// updated_at  -> PostgreSQL trigger
// ============================================================

async function softDeleteStudent(
    client,
    studentId,
    deletedBy
) {
    if (!deletedBy) {
        const error = new Error(
            "deletedBy is required for student deletion"
        );

        error.statusCode = 401;

        throw error;
    }

    const query = `
        UPDATE learning.student

        SET
            soft_delete = TRUE,
            updated_by = $2

        WHERE id = $1
          AND soft_delete = FALSE

        RETURNING
            id,
            user_id,
            soft_delete,

            -- Audit fields
            created_at,
            created_by,
            updated_at,
            updated_by
    `;

    const result = await client.query(
        query,
        [
            studentId,
            deletedBy
        ]
    );

    return result.rows[0] || null;
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    findStudentByUserId,
    findStudentByRegisterNumber,
    createStudent,
    updateStudent,
    softDeleteStudent
};

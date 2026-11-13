
const pool = require("../config/database");

// ============================================================
// COMMON PUBLISHED COURSE FILTER
// ============================================================
// Reusable condition for fetching published courses.
//
// soft_delete = FALSE -> Course is not deleted.
// is_active = TRUE    -> Course is active.
// status = PUBLISHED -> Course is available publicly.
const COURSE_FILTER = `
    c.soft_delete = FALSE
    AND c.is_active = TRUE
    AND c.status = 'PUBLISHED'
`;


// ============================================================
// GET COURSE CATALOG
// ============================================================
// Fetch public courses with:
// 1. Course details
// 2. Category details
// 3. Lesson count
// 4. Instructor information
// 5. Pagination
// 6. Catalog statistics
//
// conditions, values, orderBy, limit and offset are supplied
// by the service layer based on search/filter requirements.
async function getCatalog({ conditions, values, orderBy, limit, offset }) {

    // Combine all search/filter conditions into one WHERE clause.
    const where = conditions.join(" AND ");

    // --------------------------------------------------------
    // COUNT TOTAL MATCHING COURSES
    // --------------------------------------------------------
    // Used by frontend pagination to calculate total pages.
    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM learning.course c
         JOIN public.course_category cc ON cc.id = c.category_id
         WHERE ${where}
           AND cc.is_active = TRUE AND cc.soft_delete = FALSE`,
        values
    );

    // Add LIMIT and OFFSET values for pagination.
    const queryValues = [...values, limit, offset];

    // --------------------------------------------------------
    // FETCH COURSE DETAILS
    // --------------------------------------------------------
    const courseResult = await pool.query(
        `SELECT
                c.id,
                c.course_code,
                c.title,
                c.short_description,
                c.description,
                c.thumbnail_url,
                c.level,
                c.language_code,
                c.price,
                c.currency_code,
                c.duration_minutes,
                c.course_type,
                c.is_featured,
                c.published_at,

                -- Course category information
                cc.id AS category_id,
                cc.name AS category_name,
                cc.code AS category_code,

                -- Count active lessons belonging to this course.
                (SELECT COUNT(*)::int
                 FROM learning.module m
                 JOIN learning.lesson l ON l.module_id = m.id
                 WHERE m.course_id = c.id
                   AND m.soft_delete = FALSE
                   AND m.is_active = TRUE
                   AND l.soft_delete = FALSE
                   AND l.is_active = TRUE
                ) AS lesson_count,

                -- Get all active instructors assigned to this course.
                -- course_instructor has is_active but does NOT have
                -- soft_delete in our current database schema.
                (SELECT json_agg(json_build_object(
                    'id', i.id,
                    'name', concat_ws(' ', u.first_name, u.last_name),
                    'specialization', i.specialization,
                    'profile_image_url', i.profile_image_url
                ) ORDER BY ci.is_primary DESC, i.id)
                 FROM learning.course_instructor ci
                 JOIN learning.instructor i ON i.id = ci.instructor_id
                 JOIN olp_auth."user" u ON u.id = i.user_id
                 WHERE ci.course_id = c.id AND ci.is_active = TRUE
                   AND i.soft_delete = FALSE AND i.is_active = TRUE AND u.soft_delete = FALSE) AS instructors
         FROM learning.course c
         JOIN public.course_category cc ON cc.id = c.category_id

         WHERE ${where}
           AND cc.is_active = TRUE
           AND cc.soft_delete = FALSE

         ORDER BY ${orderBy}
         LIMIT $${values.length + 1}
         OFFSET $${values.length + 2}`,
        queryValues
    );

    // --------------------------------------------------------
    // FETCH CATEGORIES AND CATALOG STATISTICS
    // --------------------------------------------------------
    // Promise.all executes independent queries in parallel.
    // This avoids waiting for each query one by one.
    const [categoriesResult, statsResult] = await Promise.all([

        // Fetch available course categories for the frontend.
        pool.query(
            `SELECT id, code, name, description
             FROM public.course_category
             WHERE is_active = TRUE
               AND soft_delete = FALSE
             ORDER BY display_order, name`
        ),

        // Fetch overall platform statistics.
        pool.query(
            `SELECT
                (SELECT COUNT(*)::int
                 FROM learning.course c
                 WHERE ${COURSE_FILTER}) AS published_courses,

                (SELECT COUNT(*)::int
                 FROM learning.student
                 WHERE is_active = TRUE
                   AND soft_delete = FALSE) AS active_students,

                (SELECT COUNT(*)::int
                 FROM learning.instructor
                 WHERE is_active = TRUE
                   AND soft_delete = FALSE) AS expert_instructors`
        )
    ]);

    // Return all catalog information to the service layer.
    return {
        courses: courseResult.rows,
        categories: categoriesResult.rows,
        stats: statsResult.rows[0],
        total: countResult.rows[0].total
    };
}


// ============================================================
// FIND PUBLISHED COURSE BY ID
// ============================================================
// Fetch one course using its ID.
//
// Used by the course details page.
// Only active, published and non-deleted courses are returned.
async function findPublishedCourseById(courseId) {

    const result = await pool.query(
        `SELECT
                c.id,
                c.course_code,
                c.title,
                c.short_description,
                c.description,
                c.thumbnail_url,
                c.level,
                c.language_code,
                c.price,
                c.currency_code,
                c.duration_minutes,
                c.course_type,
                c.status,
                c.is_featured,

                -- Category details
                cc.id AS category_id,
                cc.name AS category_name,
                cc.code AS category_code

         FROM learning.course c
         JOIN public.course_category cc
            ON cc.id = c.category_id

         WHERE c.id = $1
           AND c.soft_delete = FALSE
           AND c.is_active = TRUE
           AND c.status = 'PUBLISHED'
           AND cc.soft_delete = FALSE
           AND cc.is_active = TRUE

         LIMIT 1`,
        [courseId]
    );

    return result.rows[0] || null;
}


// ============================================================
// CHECK WHETHER STUDENT IS ENROLLED
// ============================================================
// Verify whether the logged-in user has access to a course.
//
// student table:
//   is_active and soft_delete are valid.
//
// enrollment table:
//   soft_delete and status are used.
//   is_active does NOT exist in this table.
//
// ACTIVE or COMPLETED enrollment means the student has access.
async function isStudentEnrolled(userId, courseId) {

    const result = await pool.query(
        `SELECT e.id
         FROM learning.student s
         JOIN learning.enrollment e
            ON e.student_id = s.id

         WHERE s.user_id = $1
           AND s.soft_delete = FALSE
           AND s.is_active = TRUE

           AND e.course_id = $2
           AND e.soft_delete = FALSE
           AND e.status IN ('ACTIVE', 'COMPLETED')

         LIMIT 1`,
        [userId, courseId]
    );

    // rowCount > 0 means a valid enrollment exists.
    return result.rowCount > 0;
}


// ============================================================
// GET COURSE INSTRUCTORS
// ============================================================
// Fetch instructor details assigned to a particular course.
//
// course_instructor:
//   Filter using is_active only.
//   Do not use soft_delete because that column does not exist.
//
// instructor and user:
//   Use their own soft_delete/is_active columns.
async function getCourseInstructors(courseId) {

    const result = await pool.query(
        `SELECT
                i.id,
                concat_ws(' ', u.first_name, u.last_name) AS name,
                i.specialization,
                i.qualification,
                i.experience_years,
                i.profile_image_url,
                i.bio,
                i.designation

         FROM learning.course_instructor ci
         JOIN learning.instructor i ON i.id = ci.instructor_id
         JOIN olp_auth."user" u ON u.id = i.user_id
         WHERE ci.course_id = $1 AND ci.is_active = TRUE
           AND i.soft_delete = FALSE AND i.is_active = TRUE AND u.soft_delete = FALSE
         ORDER BY ci.is_primary DESC, i.id`,
        [courseId]
    );

    return result.rows;
}


// ============================================================
// GET COURSE MODULES
// ============================================================
// Fetch all active modules belonging to a course.
//
// Each module contains its own lessons.
// json_agg groups lesson records into a JSON array.
//
// This data is used on the course details/curriculum page.
async function getCourseModules(courseId) {

    const result = await pool.query(
        `SELECT
                m.id,
                m.module_code,
                m.module_number,
                m.title,
                m.description,
                m.sort_order,
                m.duration_minutes,

                -- Collect lessons belonging to this module.
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'id', l.id,
                        'lesson_code', l.lesson_code,
                        'lesson_number', l.lesson_number,
                        'title', l.title,
                        'description', l.description,
                        'lesson_type', l.lesson_type,
                        'duration_minutes', l.duration_minutes,
                        'is_preview', l.is_preview,
                        'sort_order', l.sort_order
                    ) ORDER BY l.sort_order, l.lesson_number)

                    FROM learning.lesson l
                    WHERE l.module_id = m.id
                      AND l.soft_delete = FALSE
                      AND l.is_active = TRUE

                ), '[]'::json) AS lessons

         FROM learning.module m

         WHERE m.course_id = $1
           AND m.soft_delete = FALSE
           AND m.is_active = TRUE

         ORDER BY m.sort_order, m.module_number`,
        [courseId]
    );

    return result.rows;
}


// ============================================================
// GET COURSE LESSON COUNT
// ============================================================
// Calculate the total number of active lessons in a course.
//
// Used to display course content information.
async function getCourseLessonCount(courseId) {

    const result = await pool.query(
        `SELECT COUNT(*)::int AS lesson_count
         FROM learning.module m
         JOIN learning.lesson l
            ON l.module_id = m.id

         WHERE m.course_id = $1
           AND m.soft_delete = FALSE
           AND m.is_active = TRUE
           AND l.soft_delete = FALSE
           AND l.is_active = TRUE`,
        [courseId]
    );

    return result.rows[0].lesson_count;
}


// ============================================================
// GET INSTITUTIONS
// ============================================================
// Fetch active institutions from the database.
// This can be used in public pages or registration-related UI.
async function getInstitutions() {

    const result = await pool.query(
        `SELECT id, code, name, institution_type
         FROM public.institution

         WHERE is_active = TRUE
           AND soft_delete = FALSE

         ORDER BY name ASC`
    );

    return result.rows;
}


// ============================================================
// EXPORT REPOSITORY FUNCTIONS
// ============================================================
// Other layers import these functions using require().
// The service layer handles business logic and calls this
// repository layer to communicate with PostgreSQL.
module.exports = {
    COURSE_FILTER,
    getCatalog,
    findPublishedCourseById,
    isStudentEnrolled,
    getCourseInstructors,
    getCourseModules,
    getCourseLessonCount,
    getInstitutions
};

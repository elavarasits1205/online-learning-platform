const publicRepository = require("../repositories/public.repository");


/*
 * Parse a pagination value into a positive safe integer.
 *
 * This function throws a 400 error when the value is invalid.
 */
function parsePaginationInteger(
    value,
    fallback,
    name,
    maximum = Number.MAX_SAFE_INTEGER
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    const parsed = Number(value);

    if (
        !Number.isSafeInteger(parsed) ||
        parsed < 1 ||
        parsed > maximum
    ) {
        const cap =
            maximum < Number.MAX_SAFE_INTEGER
                ? " no greater than " + maximum
                : "";

        const error = new Error(
            name +
            " must be a positive whole number" +
            cap +
            "."
        );

        error.statusCode = 400;

        throw error;
    }

    return parsed;
}


/*
 * Convert a value into a positive integer.
 *
 * If the value is invalid,
 * return the supplied fallback value.
 */
function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);

    return Number.isInteger(parsed) && parsed > 0
        ? parsed
        : fallback;
}


/*
 * Get courses for the public course catalog.
 */
async function getCatalog(query = {}) {

    /*
     * Get page number.
     * Default is 1.
     */
    const page = parsePositiveInteger(
        query.page,
        1
    );


    /*
     * Get number of courses per page.
     *
     * Maximum limit is 50.
     */
    const limit = Math.min(
        parsePositiveInteger(
            query.limit,
            10
        ),
        50
    );


    /*
     * Calculate how many records
     * should be skipped.
     */
    const offset =
        (page - 1) * limit;


    /*
     * Get search text from request.
     */
    const search =
        String(query.search || "").trim();


    /*
     * Get selected category.
     */
    const category =
        String(query.category || "").trim();


    /*
     * Get multiple selected categories.
     */
    const requestedCategories =
        query.categories === undefined
            ? []
            : (
                Array.isArray(query.categories)
                    ? query.categories
                    : [query.categories]
            )
                .flatMap(
                    value =>
                        String(value || "")
                            .split(",")
                )
                .map(value => value.trim())
                .filter(Boolean);


    /*
     * Get course level.
     */
    const level =
        String(query.level || "")
            .trim()
            .toUpperCase();


    /*
     * Get price filter.
     */
    const price =
        String(query.price || "")
            .trim()
            .toLowerCase();


    /*
     * Get sorting option.
     *
     * Default:
     * newest courses first.
     */
    const sort =
        String(query.sort || "newest")
            .trim()
            .toLowerCase();


    /*
     * Start with the basic course filter.
     */
    const conditions = [
        publicRepository.COURSE_FILTER
    ];


    /*
     * Store values used in SQL query.
     */
    const values = [];


    /*
     * Helper function to add
     * a SQL condition safely.
     *
     * It also adds the value
     * to the values array.
     */
    const add = (sql, value) => {

        values.push(value);


        /*
         * Replace ? with the correct
         * PostgreSQL parameter.
         */
        conditions.push(
            sql.replace(
                "?",
                `$${values.length}`
            )
        );
    };


    /*
     * Search courses by:
     * - title
     * - short description
     * - description
     * - category name
     * - instructor first name
     * - instructor last name
     */
    if (search) {

        /*
         * Get the starting parameter number.
         */
        const start =
            values.length + 1;


        /*
         * Add the search value
         * for multiple fields.
         */
        values.push(
            search,
            search,
            search,
            search,
            search,
            search
        );


        /*
         * Search in course,
         * category and instructor details.
         */
        conditions.push(`
            (
                c.title ILIKE '%' || $${start} || '%'

                OR c.short_description
                    ILIKE '%' || $${start + 1} || '%'

                OR c.description
                    ILIKE '%' || $${start + 2} || '%'

                OR cc.name
                    ILIKE '%' || $${start + 3} || '%'

                OR EXISTS (
                    SELECT 1
                    FROM learning.course_instructor ci

                    JOIN learning.instructor i
                        ON i.id = ci.instructor_id
                        AND i.soft_delete = FALSE
                        AND i.is_active = TRUE

                    JOIN olp_auth."user" u
                        ON u.id = i.user_id
                        AND u.soft_delete = FALSE

                    WHERE ci.course_id = c.id
                        AND ci.is_active = TRUE

                        AND (
                            u.first_name
                                ILIKE '%' || $${start + 4} || '%'

                            OR u.last_name
                                ILIKE '%' || $${start + 5} || '%'
                        )
                )
            )
        `);
    }


    /*
     * Filter courses by multiple categories.
     */
    if (requestedCategories.length) {

        /*
         * Check whether category values
         * are numeric IDs.
         */
        const categoryIds =
            requestedCategories.filter(
                value => /^\d+$/.test(value)
            );


        /*
         * Check whether category values
         * are category codes.
         */
        const categoryCodes =
            requestedCategories.filter(
                value => !/^\d+$/.test(value)
            );


        /*
         * Store category conditions.
         */
        const categoryConditions = [];


        /*
         * Filter using category IDs.
         */
        if (categoryIds.length) {

            values.push(categoryIds);

            categoryConditions.push(
                `c.category_id = ANY($${values.length}::bigint[])`
            );
        }


        /*
         * Filter using category codes.
         */
        if (categoryCodes.length) {

            values.push(categoryCodes);

            categoryConditions.push(
                `cc.code = ANY($${values.length}::text[])`
            );
        }


        /*
         * Apply category filter.
         */
        conditions.push(
            `(${categoryConditions.join(" OR ")})`
        );

    } else if (category) {

        /*
         * If category is a number,
         * use category ID.
         */
        if (/^\d+$/.test(category)) {

            add(
                "c.category_id = ?::bigint",
                category
            );

        } else {

            /*
             * Otherwise use category code.
             */
            add(
                "cc.code = ?",
                category
            );
        }
    }


    /*
     * Allow only valid course levels.
     */
    if (
        [
            "BEGINNER",
            "INTERMEDIATE",
            "ADVANCED"
        ].includes(level)
    ) {
        add(
            "c.level = ?",
            level
        );
    }


    /*
     * Filter free courses.
     */
    if (price === "free") {
        conditions.push(
            "c.course_type = 'FREE'"
        );
    }


    /*
     * Filter paid courses.
     */
    if (price === "paid") {
        conditions.push(
            "c.course_type = 'PAID'"
        );
    }


    /*
     * Define the sorting options.
     */
    const orderBy = {

        /*
         * Show newest courses first.
         */
        newest:
            "c.published_at DESC NULLS LAST, c.created_at DESC",


        /*
         * Show oldest courses first.
         */
        oldest:
            "c.created_at ASC",


        /*
         * Show lowest price first.
         */
        price_low:
            "c.price ASC, c.created_at DESC",


        /*
         * Show highest price first.
         */
        price_high:
            "c.price DESC, c.created_at DESC",


        /*
         * Sort courses by title.
         */
        title:
            "c.title ASC"

    }[sort]

        /*
         * Use newest sorting
         * if invalid sort is provided.
         */
        || "c.published_at DESC NULLS LAST, c.created_at DESC";


    /*
     * Send all filters and pagination details
     * to the repository layer.
     */
    const result =
        await publicRepository.getCatalog({
            conditions,
            values,
            orderBy,
            limit,
            offset
        });


    /*
     * Return course data
     * and pagination information.
     */
    return {

        courses:
            result.courses,

        categories:
            result.categories,

        stats:
            result.stats,

        pagination: {

            /*
             * Current page number.
             */
            page,

            /*
             * Number of courses per page.
             */
            limit,

            /*
             * Total number of courses.
             */
            total:
                result.total,

            /*
             * Calculate total number of pages.
             */
            totalPages:
                Math.ceil(
                    result.total / limit
                )
        }
    };
}


/*
 * Get complete details
 * of a single course.
 */
async function getCourseDetails(
    courseId,
    userId
) {

    /*
     * Find the published course
     * using its ID.
     */
    const course =
        await publicRepository
            .findPublishedCourseById(
                courseId
            );


    /*
     * If course does not exist,
     * return 404 error.
     */
    if (!course) {

        const error =
            new Error("Course not found");

        error.statusCode = 404;

        throw error;
    }


    /*
     * Check whether the course is free.
     */
    const isFreeCourse =
        String(
            course.course_type || "PAID"
        ).toUpperCase() === "FREE";


    /*
     * Check whether the logged-in
     * student is enrolled.
     *
     * If user is not logged in,
     * return false.
     */
    const isEnrolled = userId
        ? await publicRepository.isStudentEnrolled(
            userId,
            courseId
        )
        : false;


    /*
     * Fetch instructors,
     * modules and lesson count together.
     *
     * Promise.all() runs these
     * database operations in parallel.
     */
    const [
        instructors,
        allModules,
        lessonCount
    ] = await Promise.all([

        publicRepository.getCourseInstructors(
            courseId
        ),

        publicRepository.getCourseModules(
            courseId
        ),

        publicRepository.getCourseLessonCount(
            courseId
        )
    ]);


    /*
     * Student can access the full course if:
     *
     * 1. Course is free
     * OR
     * 2. Student is enrolled
     */
    const canAccessFullCourse =
        isFreeCourse ||
        isEnrolled;


    /*
     * Add instructor information
     * to the course.
     */
    course.instructors =
        instructors;


    /*
     * Add total lesson count.
     */
    course.lesson_count =
        lessonCount;


    /*
     * Add total module count.
     */
    course.module_count =
        allModules.length;


    /*
     * Store whether the course is free.
     */
    course.is_free =
        isFreeCourse;


    /*
     * Store whether the student
     * is enrolled.
     */
    course.is_enrolled =
        isEnrolled;


    /*
     * Store whether the student
     * can access the full course.
     */
    course.can_access_full_course =
        canAccessFullCourse;


    /*
     * If the student can access
     * the course, show all modules.
     *
     * Otherwise, show only
     * the first 2 modules as preview.
     */
    course.modules =
        canAccessFullCourse
            ? allModules
            : allModules.slice(0, 2);


    /*
     * True means the course
     * is shown only as a preview.
     */
    course.preview_only =
        !canAccessFullCourse;


    /*
     * Count how many modules are locked.
     */
    course.locked_module_count =
        canAccessFullCourse
            ? 0
            : Math.max(
                0,
                allModules.length -
                    course.modules.length
            );


    /*
     * Return the final
     * course details.
     */
    return course;
}


/*
 * Get all available institutions.
 */
async function getInstitutions() {

    /*
     * Fetch institution data
     * from the repository.
     */
    return publicRepository.getInstitutions();
}


/*
 * Export service functions.
 *
 * IMPORTANT:
 * There must NOT be an extra
 * closing brace before module.exports.
 */
module.exports = {
    getCatalog,
    getCourseDetails,
    getInstitutions
};
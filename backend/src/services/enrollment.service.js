const crypto = require("crypto");
const repository = require("../repositories/enrollment.repository");

// Create a custom error with status code and optional error code.
function createError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;

  // Add error code if provided.
  if (code) {
    error.code = code;
  }

  return error;
}

// Convert an error into a standard API response.
function errorResponse(error) {
  return {
    statusCode: error.statusCode,
    body: {
      success: false,

      // Add error code only if it exists.
      ...(error.code ? { code: error.code } : {}),

      message: error.message,
    },
  };
}

// ENROLL IN COURSE
async function enrollInCourse(userId, body = {}) {
  // Get course ID from the request body.
  // Supports both course_id and courseId.
  const courseId = Number(body.course_id ?? body.courseId);

  // Validate the course ID.
  if (!Number.isSafeInteger(courseId) || courseId <= 0) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: "A valid course_id is required",
      },
    };
  }

  try {
    // Start a database transaction.
    // All enrollment operations are handled together.
    const result = await repository.withTransaction(async (client) => {
      // Check whether the user has an active student profile.
      const student = await repository.findActiveStudent(client, userId);

      // Student profile is required for enrollment.
      if (!student) {
        throw createError(
          "An active student profile is required to enroll",
          403,
        );
      }

      // Check whether the course exists
      // and is published.
      const course = await repository.findPublishedCourse(client, courseId);

      // Stop if the course is not available.
      if (!course) {
        throw createError("Published course not found", 404);
      }

      // Check whether the student is already enrolled.
      const existing = await repository.findExistingEnrollment(
        client,
        student.id,
        courseId,
      );

      // If already enrolled, do not create another enrollment.
      if (existing) {
        return {
          statusCode: 200,

          body: {
            success: true,

            message:
              existing.status === "COMPLETED"
                ? "You have completed this course"
                : "You are already enrolled in this course",

            data: {
              enrollment_id: existing.id,
              status: existing.status,
              already_enrolled: true,
            },
          },
        };
      }

      // Only free courses can be enrolled directly.
      // Paid courses require payment first.
      if (course.course_type !== "FREE" || Number(course.price) > 0) {
        throw createError(
          "Payment is required before enrolling in this course",
          409,
          "PAYMENT_REQUIRED",
        );
      }

      // Check course capacity if max_students is configured.
      if (course.max_students) {
        // Count current enrollments.
        const enrolledCount = await repository.countEnrollments(
          client,
          courseId,
        );

        // Stop enrollment if the course is full.
        if (enrolledCount >= course.max_students) {
          throw createError(
            "This course has reached its enrollment limit",
            409,
          );
        }
      }

      // Create a unique enrollment number.
      const enrollmentNumber = `ENR-${Date.now()}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      // Create the enrollment record in the database.
      const enrollment = await repository.createEnrollment(
        client,
        enrollmentNumber,
        student.id,
        courseId,
        userId,
      );

      // Return successful enrollment response.
      return {
        statusCode: 201,

        body: {
          success: true,
          message: "Enrollment completed successfully",

          data: {
            enrollment,
          },
        },
      };
    });

    // Return transaction result.
    return result;
  } catch (error) {
    // Handle known application errors.
    if (error.statusCode) {
      return errorResponse(error);
    }

    // Throw unexpected errors.
    throw error;
  }
}

// GET LOGGED-IN STUDENT ENROLLMENTS
async function getMyEnrollments(userId) {
  // Get all enrollments of the logged-in student.
  const enrollments = await repository.getMyEnrollments(userId);

  // Return enrollment data.
  return {
    statusCode: 200,

    body: {
      success: true,

      data: {
        enrollments,
      },
    },
  };
}

// REMOVE COURSE FROM MY LEARNING
async function removeMyEnrollment(userId, enrollmentIdParam) {
  // Convert enrollment ID into a number.
  const enrollmentId = Number(enrollmentIdParam);

  // Validate enrollment ID.
  if (!Number.isSafeInteger(enrollmentId) || enrollmentId <= 0) {
    return {
      statusCode: 400,

      body: {
        success: false,
        message: "A valid enrollment ID is required",
      },
    };
  }

  // Remove the enrollment belonging to the logged-in user.
  const enrollment = await repository.removeMyEnrollment(enrollmentId, userId);

  // Enrollment not found or user does not have permission.
  if (!enrollment) {
    return {
      statusCode: 404,

      body: {
        success: false,

        message:
          "Active enrollment not found or you do not have permission to remove it",
      },
    };
  }

  // Return successful removal response.
  return {
    statusCode: 200,

    body: {
      success: true,

      message: "Course removed from My Learning successfully",

      data: {
        enrollment_id: enrollment.enrollment_id,
      },
    },
  };
}

// Export enrollment service functions.
module.exports = {
  enrollInCourse,
  getMyEnrollments,
  removeMyEnrollment,
};

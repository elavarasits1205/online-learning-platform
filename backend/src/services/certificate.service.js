const crypto = require("crypto");
const pool = require("../config/database");
const certificateStorage = require("../utils/certificateStorage");
const { generateCertificatePdf } = require("../utils/certificatePdf");
const notificationRepository =
    require("../repositories/notification.repository");

// ============================================================
// CHECK CERTIFICATE ELIGIBILITY
// ============================================================

async function getCertificateEligibility(userId, enrollmentId) {
    const result = await pool.query(
        `
        WITH student_enrollment AS (
            SELECT
                e.id AS enrollment_id,
                e.course_id,
                e.student_id
            FROM learning.enrollment e
            JOIN learning.student s
                ON s.id = e.student_id
            WHERE e.id = $1
              AND s.user_id = $2
              AND s.is_active = TRUE
              AND COALESCE(s.soft_delete, FALSE) = FALSE
              AND COALESCE(e.soft_delete, FALSE) = FALSE
              AND e.status IN ('ACTIVE', 'COMPLETED')
        ),

        lesson_summary AS (
            SELECT
                COUNT(l.id)::int AS total_lessons,
                COUNT(l.id) FILTER (
                    WHERE EXISTS (
                        SELECT 1
                        FROM learning.lesson_progress lp
                        WHERE lp.enrollment_id = se.enrollment_id
                          AND lp.lesson_id = l.id
                          AND lp.status = 'COMPLETED'
                          AND COALESCE(lp.soft_delete, FALSE) = FALSE
                    )
                )::int AS completed_lessons
            FROM student_enrollment se
            JOIN learning.module m
                ON m.course_id = se.course_id
               AND m.is_active = TRUE
               AND COALESCE(m.soft_delete, FALSE) = FALSE
            JOIN learning.lesson l
                ON l.module_id = m.id
               AND l.is_active = TRUE
               AND COALESCE(l.soft_delete, FALSE) = FALSE
               AND l.is_mandatory = TRUE
        ),

        assessment_summary AS (
            SELECT
                COUNT(a.id)::int AS total_required_assessments,
                COUNT(a.id) FILTER (
                    WHERE EXISTS (
                        SELECT 1
                        FROM assessment.assessment_attempt aa
                        WHERE aa.assessment_id = a.id
                          AND aa.enrollment_id = se.enrollment_id
                          AND aa.status = 'EVALUATED'
                          AND aa.passed = TRUE
                          AND COALESCE(aa.soft_delete, FALSE) = FALSE
                    )
                )::int AS passed_required_assessments
            FROM student_enrollment se
            JOIN assessment.assessment a
                ON a.course_id = se.course_id
               AND a.assessment_type IN ('MODULE', 'COURSE')
               AND a.passing_required = TRUE
               AND a.is_active = TRUE
               AND COALESCE(a.soft_delete, FALSE) = FALSE
               AND a.status = 'PUBLISHED'
        )

        SELECT
            se.enrollment_id,
            se.course_id,
            ls.total_lessons,
            ls.completed_lessons,
            ass.total_required_assessments,
            ass.passed_required_assessments,
            (
                ls.total_lessons = ls.completed_lessons
                AND ass.total_required_assessments =
                    ass.passed_required_assessments
            ) AS is_eligible
        FROM student_enrollment se
        CROSS JOIN lesson_summary ls
        CROSS JOIN assessment_summary ass
        `,
        [enrollmentId, userId]
    );

    return result.rows[0] || null;
}

// ============================================================
// CREATE CERTIFICATE
// ============================================================

async function createCertificate(
    userId,
    enrollmentId,
    certificateNumber,
    verificationCode
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Fetch the enrollment and verify student ownership.
        const enrollmentResult = await client.query(
            `
            SELECT
                e.id AS enrollment_id,
                e.student_id,
                e.course_id,
                e.completed_at,
                s.user_id,
                COALESCE(
                    NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
                    u.email
                ) AS student_name,
                c.title AS course_title,
                cp.completed_at AS progress_completed_at
            FROM learning.enrollment e
            JOIN learning.student s
                ON s.id = e.student_id
            JOIN olp_auth."user" u
                ON u.id = s.user_id
            JOIN learning.course c
                ON c.id = e.course_id
            LEFT JOIN learning.course_progress cp
                ON cp.enrollment_id = e.id
               AND COALESCE(cp.soft_delete, FALSE) = FALSE
            WHERE e.id = $1
              AND s.user_id = $2
              AND s.is_active = TRUE
              AND COALESCE(s.soft_delete, FALSE) = FALSE
              AND u.is_active = TRUE
              AND COALESCE(u.soft_delete, FALSE) = FALSE
              AND COALESCE(e.soft_delete, FALSE) = FALSE
              AND c.is_active = TRUE
              AND COALESCE(c.soft_delete, FALSE) = FALSE
            FOR UPDATE OF e
            `,
            [enrollmentId, userId]
        );

        if (!enrollmentResult.rowCount) {
            const error = new Error(
                "Enrollment not found or access denied"
            );
            error.statusCode = 404;
            throw error;
        }

        const enrollment = enrollmentResult.rows[0];

        // Prevent duplicate certificates for the same enrollment.
        const existingResult = await client.query(
            `
            SELECT id
            FROM result.certificate
            WHERE enrollment_id = $1
              AND COALESCE(soft_delete, FALSE) = FALSE
            LIMIT 1
            `,
            [enrollmentId]
        );

        if (existingResult.rowCount) {
            const error = new Error(
                "Certificate already exists for this enrollment"
            );
            error.statusCode = 409;
            throw error;
        }

        // Fetch the active default certificate template.
        const templateResult = await client.query(
            `
            SELECT
                id,
                certificate_title,
                certificate_format
            FROM result.certificate_template
            WHERE is_default = TRUE
              AND is_active = TRUE
              AND COALESCE(soft_delete, FALSE) = FALSE
            ORDER BY id
            LIMIT 1
            `
        );

        if (!templateResult.rowCount) {
            const error = new Error(
                "No active default certificate template found"
            );
            error.statusCode = 500;
            throw error;
        }

        const template = templateResult.rows[0];

        const completionDate =
            enrollment.completed_at ||
            enrollment.progress_completed_at ||
            new Date();

        // Insert the certificate record.
        const insertResult = await client.query(
            `
            INSERT INTO result.certificate (
                certificate_number,
                certificate_template_id,
                student_id,
                enrollment_id,
                course_id,
                student_name_snapshot,
                course_title_snapshot,
                completion_date,
                issue_date,
                certificate_title,
                verification_code,
                status,
                created_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8::date, CURRENT_DATE, $9, $10, 'ISSUED', $11
            )
            RETURNING
                id,
                certificate_number,
                certificate_template_id,
                student_id,
                enrollment_id,
                course_id,
                student_name_snapshot,
                course_title_snapshot,
                completion_date,
                issue_date,
                certificate_title,
                certificate_url,
                verification_code,
                status,
                created_at
            `,
            [
                certificateNumber,
                template.id,
                enrollment.student_id,
                enrollment.enrollment_id,
                enrollment.course_id,
                enrollment.student_name.trim(),
                enrollment.course_title,
                completionDate,
                template.certificate_title,
                verificationCode,
                userId
            ]
        );

        await client.query(
            `UPDATE learning.enrollment
             SET status = 'COMPLETED',
                 completed_at = COALESCE(completed_at, $2::timestamptz, NOW()),
                 updated_at = NOW(),
                 updated_by = $3
             WHERE id = $1
               AND soft_delete = FALSE
               AND status IN ('ACTIVE', 'COMPLETED')`,
            [enrollment.enrollment_id, enrollment.progress_completed_at, userId]
        );

        await client.query("COMMIT");

        try {
            await notificationRepository.createForUser(
                {
                    userId,
                    notificationType: "CERTIFICATE_ISSUED",
                    title: "Certificate issued",
                    message: `Your certificate for ${enrollment.course_title} has been issued.`,
                    preferenceKey: "certificates",
                    createdBy: userId
                },
                client
            );
        } catch (notificationError) {
            console.error(
                "Failed to create the certificate notification:",
                notificationError
            );
        }

        return insertResult.rows[0];

    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23505") {
            const duplicateError = new Error(
                "A certificate already exists for this enrollment"
            );
            duplicateError.statusCode = 409;
            throw duplicateError;
        }

        throw error;

    } finally {
        client.release();
    }
}

// ============================================================
// GET CERTIFICATE DETAILS FOR PDF
// ============================================================

async function getCertificateForPdf(userId, certificateId) {
    const result = await pool.query(
        `
        SELECT
            cert.id,
            cert.student_id,
            cert.enrollment_id,
            cert.course_id,
            cert.certificate_number,
            cert.certificate_title,
            cert.student_name_snapshot,
            cert.course_title_snapshot,
            cert.completion_date,
            cert.issue_date,
            cert.verification_code,
            cert.status,
            cert.certificate_url
        FROM result.certificate cert
        JOIN learning.student s
            ON s.id = cert.student_id
        WHERE cert.id = $1
          AND s.user_id = $2
          AND s.is_active = TRUE
          AND COALESCE(s.soft_delete, FALSE) = FALSE
          AND cert.status = 'ISSUED'
          AND COALESCE(cert.soft_delete, FALSE) = FALSE
        LIMIT 1
        `,
        [certificateId, userId]
    );

    return result.rows[0] || null;
}

// ============================================================
// UPDATE CERTIFICATE PDF URL
// ============================================================

async function updateCertificateUrl(certificateId, filePath) {
    const result = await pool.query(
        `
        UPDATE result.certificate
        SET
            certificate_url = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
          AND status = 'ISSUED'
          AND COALESCE(soft_delete, FALSE) = FALSE
        RETURNING
            id,
            certificate_number,
            certificate_url,
            status
        `,
        [filePath, certificateId]
    );

    if (!result.rowCount) {
        const error = new Error("Certificate not found");
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
}

// ============================================================
// VERIFY CERTIFICATE
// ============================================================

async function verifyCertificate(verificationCode) {
    const result = await pool.query(
        `
        SELECT
            cert.certificate_number,
            cert.certificate_title,
            cert.student_name_snapshot,
            cert.course_title_snapshot,
            cert.completion_date,
            cert.issue_date,
            cert.status,
            cert.verification_code
        FROM result.certificate cert
        WHERE cert.verification_code = $1
          AND COALESCE(cert.soft_delete, FALSE) = FALSE
        LIMIT 1
        `,
        [verificationCode]
    );

    return result.rows[0] || null;
}

// ============================================================
// GET EXISTING CERTIFICATE BY ENROLLMENT
// ============================================================

async function getCertificateByEnrollment(userId, enrollmentId) {
    const result = await pool.query(
        `
        SELECT
            cert.id,
            cert.student_id,
            cert.certificate_number,
            cert.enrollment_id,
            cert.course_id,
            cert.certificate_title,
            cert.student_name_snapshot,
            cert.course_title_snapshot,
            cert.completion_date,
            cert.issue_date,
            cert.certificate_url,
            cert.verification_code,
            cert.status
        FROM result.certificate cert
        JOIN learning.student s
            ON s.id = cert.student_id
        WHERE cert.enrollment_id = $1
          AND s.user_id = $2
          AND s.is_active = TRUE
          AND COALESCE(s.soft_delete, FALSE) = FALSE
          AND cert.status = 'ISSUED'
          AND COALESCE(cert.soft_delete, FALSE) = FALSE
        LIMIT 1
        `,
        [enrollmentId, userId]
    );

    return result.rows[0] || null;
}


// ============================================================
// DOWNLOAD CERTIFICATE PDF
// ============================================================

async function downloadCertificatePdf(userId, certificateId) {
    // Fetch the certificate and verify student ownership.
    const certificate = await getCertificateForPdf(
        userId,
        certificateId
    );

    if (!certificate) {
        const error = new Error("Certificate not found or access denied");
        error.statusCode = 404;
        throw error;
    }

    if (!certificate.certificate_url) {
        const error = new Error("Certificate PDF is not uploaded yet");
        error.statusCode = 404;
        throw error;
    }

    // Download the PDF from Supabase Storage.
    const pdfBuffer = await certificateStorage.downloadCertificatePdf(
        certificate.certificate_url
    );

    return {
        certificate,
        pdfBuffer
    };
}

function normalizeEnrollmentId(enrollmentId) {
    const value = String(enrollmentId ?? "").trim();
    if (!/^[1-9]\d*$/.test(value)) {
        const error = new Error("A valid enrollment ID is required.");
        error.statusCode = 400;
        throw error;
    }
    return value;
}

function buildCertificateNumber(enrollmentId) {
    return `CERT-${new Date().getFullYear()}-${String(enrollmentId).padStart(6, "0")}`;
}

async function createOrGetCertificate(userId, enrollmentId) {
    const existing = await getCertificateByEnrollment(userId, enrollmentId);
    if (existing) return existing;

    try {
        return await createCertificate(
            userId,
            enrollmentId,
            buildCertificateNumber(enrollmentId),
            crypto.randomBytes(24).toString("hex").toUpperCase()
        );
    } catch (error) {
        // Lesson completion and assessment evaluation can finish together.
        // Reuse the certificate created by whichever request wins the race.
        if (error.statusCode !== 409 && error.code !== "23505") throw error;
        const concurrentCertificate = await getCertificateByEnrollment(
            userId,
            enrollmentId
        );
        if (concurrentCertificate) return concurrentCertificate;
        throw error;
    }
}

async function ensureCertificateForEnrollment(userId, enrollmentId) {
    const id = normalizeEnrollmentId(enrollmentId);
    let certificate = await getCertificateByEnrollment(userId, id);

    if (!certificate) {
        const eligibility = await getCertificateEligibility(userId, id);

        if (!eligibility) {
            const error = new Error("Enrollment not found or access denied.");
            error.statusCode = 404;
            throw error;
        }

        if (eligibility.is_eligible !== true && eligibility.isEligible !== true) {
            const error = new Error(
                "Complete all mandatory lessons and required assessments before a certificate can be issued."
            );
            error.statusCode = 400;
            throw error;
        }

        certificate = await createOrGetCertificate(userId, id);
    }

    if (!certificate) {
        const error = new Error("Certificate could not be created.");
        error.statusCode = 500;
        throw error;
    }

    // Retry PDF creation for an existing certificate if an earlier upload failed.
    if (!certificate.certificate_url) {
        const pdfBuffer = await generateCertificatePdf(certificate);
        const storagePath = await certificateStorage.uploadCertificatePdf(
            certificate,
            pdfBuffer
        );
        const updated = await updateCertificateUrl(certificate.id, storagePath);
        certificate = { ...certificate, ...updated };
    }

    return certificate;
}

async function generateCertificate(userId, enrollmentId) {
    return ensureCertificateForEnrollment(userId, enrollmentId);
}

async function retryCertificatePdf(userId, certificateId) {
    const certificate = await getCertificateForPdf(userId, certificateId);
    if (!certificate) {
        const error = new Error("Certificate not found or access denied.");
        error.statusCode = 404;
        throw error;
    }

    const pdfBuffer = await generateCertificatePdf(certificate);
    const storagePath = await certificateStorage.uploadCertificatePdf(
        certificate,
        pdfBuffer
    );
    const updated = await updateCertificateUrl(certificate.id, storagePath);
    return { ...certificate, ...updated };
}

async function regenerateCertificatePdf(userId, certificateId) {
    return retryCertificatePdf(userId, certificateId);
}

// ============================================================
// EXPORT REPOSITORY METHODS
// ============================================================

module.exports = {
    getCertificateEligibility,
    createCertificate,
    generateCertificate,
    ensureCertificateForEnrollment,
    getCertificateForPdf,
    updateCertificateUrl,
    verifyCertificate,
    getCertificateByEnrollment,
    downloadCertificatePdf,
    retryCertificatePdf,
    regenerateCertificatePdf
};

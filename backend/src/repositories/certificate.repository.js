const crypto = require("crypto");

async function getEnrollmentCertificateContext(client, enrollmentId) {
    const result = await client.query(
        `SELECT
            e.id AS enrollment_id,
            e.student_id,
            e.course_id,
            e.status AS enrollment_status,
            e.completed_at AS enrollment_completed_at,
            TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS student_name,
            u.email AS student_email,
            c.title AS course_title,
            COALESCE(e.completed_at, cp.completed_at, NOW()) AS completion_date
         FROM learning.enrollment e
         JOIN learning.student s
           ON s.id = e.student_id
         JOIN olp_auth."user" u
           ON u.id = s.user_id
         JOIN learning.course c
           ON c.id = e.course_id
         LEFT JOIN learning.course_progress cp
           ON cp.enrollment_id = e.id
          AND cp.soft_delete = FALSE
         WHERE e.id = $1
           AND e.soft_delete = FALSE
           AND s.is_active = TRUE
           AND s.soft_delete = FALSE
           AND c.is_active = TRUE
           AND c.soft_delete = FALSE
         LIMIT 1`,
        [enrollmentId]
    );

    return result.rows[0] || null;
}

async function getDefaultTemplate(client) {
    const result = await client.query(
        `SELECT
            id,
            template_code,
            template_name,
            certificate_title,
            body_template,
            certificate_format,
            is_default,
            is_active
         FROM result.certificate_template
         WHERE is_active = TRUE
           AND soft_delete = FALSE
         ORDER BY is_default DESC, id ASC
         LIMIT 1`
    );

    return result.rows[0] || null;
}

async function getCertificateByEnrollment(client, enrollmentId) {
    const result = await client.query(
        `SELECT
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
            revoked_at,
            revocation_reason
         FROM result.certificate
         WHERE enrollment_id = $1
           AND soft_delete = FALSE
         LIMIT 1`,
        [enrollmentId]
    );

    return result.rows[0] || null;
}

function buildCertificateNumber(enrollmentId) {
    const year = new Date().getFullYear();
    return `CERT-${year}-${String(enrollmentId).padStart(6, "0")}`;
}

async function insertCertificate(client, data) {
    const result = await client.query(
        `INSERT INTO result.certificate (
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
            created_by
         )
         VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, CURRENT_DATE, $9, $10, $11, 'ISSUED', $12
         )
         ON CONFLICT (enrollment_id) DO NOTHING
         RETURNING *`,
        [
            data.certificate_number,
            data.certificate_template_id,
            data.student_id,
            data.enrollment_id,
            data.course_id,
            data.student_name_snapshot,
            data.course_title_snapshot,
            data.completion_date,
            data.certificate_title,
            data.certificate_url,
            data.verification_code,
            data.created_by
        ]
    );

    return result.rows[0] || null;
}

async function markEnrollmentCompleted(client, enrollmentId, userId) {
    const result = await client.query(
        `UPDATE learning.enrollment
         SET status = 'COMPLETED',
             completed_at = COALESCE(completed_at, NOW()),
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1
           AND soft_delete = FALSE
           AND status IN ('ACTIVE', 'COMPLETED')
         RETURNING id, status, completed_at`,
        [enrollmentId, userId]
    );

    return result.rows[0] || null;
}

async function issueCertificateForEnrollment(client, enrollmentId, userId) {
    const existing = await getCertificateByEnrollment(client, enrollmentId);
    if (existing) return existing;

    const context = await getEnrollmentCertificateContext(client, enrollmentId);
    if (!context) return null;

    const template = await getDefaultTemplate(client);
    if (!template) return null;

    const certificate = await insertCertificate(client, {
        certificate_number: buildCertificateNumber(enrollmentId),
        certificate_template_id: template.id,
        student_id: context.student_id,
        enrollment_id: context.enrollment_id,
        course_id: context.course_id,
        student_name_snapshot: context.student_name || context.student_email || "Student",
        course_title_snapshot: context.course_title,
        completion_date: context.completion_date,
        certificate_title: template.certificate_title,
        certificate_url: null,
        verification_code: crypto.randomBytes(8).toString("hex").toUpperCase(),
        created_by: userId
    });

    if (certificate) {
        await markEnrollmentCompleted(client, enrollmentId, userId);
        return certificate;
    }

    return getCertificateByEnrollment(client, enrollmentId);
}

module.exports = {
    getEnrollmentCertificateContext,
    getDefaultTemplate,
    getCertificateByEnrollment,
    insertCertificate,
    markEnrollmentCompleted,
    issueCertificateForEnrollment
};

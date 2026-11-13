
const supabase = require("../config/supabase");

const BUCKET_NAME = "Certificates";

// ============================================================
// UPLOAD CERTIFICATE PDF TO SUPABASE STORAGE
// ============================================================

async function uploadCertificatePdf(certificate, pdfBuffer) {

    if (!certificate || !certificate.id || !certificate.student_id) {
        throw new Error("Invalid certificate details");
    }

    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
        throw new Error("Invalid or empty PDF buffer");
    }

    const filePath =
        `student-${certificate.student_id}/` +
        `${certificate.certificate_number}.pdf`;

    try {

        const { data, error } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(filePath, pdfBuffer, {
                contentType: "application/pdf",
                upsert: true,
                cacheControl: "3600"
            });

        if (error) {
            console.error("Supabase Storage Upload Error:", {
                message: error.message,
                statusCode: error.statusCode,
                error: error.error
            });

            const uploadError = new Error(
                `Supabase upload failed: ${error.message}`
            );

            uploadError.statusCode = 500;
            throw uploadError;
        }

        if (!data || !data.path) {
            throw new Error("Supabase did not return a storage path");
        }

        console.log("Certificate uploaded successfully:", data.path);

        return data.path;

    } catch (error) {

        console.error("Certificate Storage Error:", error.message);
        console.error("Underlying Cause:", error.cause || "Not available");

        if (error.statusCode) {
            throw error;
        }

        const uploadError = new Error(
            `Supabase connection or upload failed: ${error.message}`
        );

        uploadError.statusCode = 503;
        uploadError.cause = error.cause;

        throw uploadError;
    }
}



// ============================================================
// DOWNLOAD CERTIFICATE PDF FROM SUPABASE
// ============================================================

async function downloadCertificatePdf(filePath) {

    if (!filePath || typeof filePath !== "string") {
        throw new Error("Invalid certificate storage path");
    }

    const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .download(filePath);

    if (error) {
        console.error("Supabase Download Error:", error.message);

        const downloadError = new Error(
            "Failed to download certificate from storage"
        );

        downloadError.statusCode = 500;
        throw downloadError;
    }

    if (!data) {
        const error = new Error("Certificate PDF not found in storage");
        error.statusCode = 404;
        throw error;
    }

    return Buffer.from(await data.arrayBuffer());
}


module.exports = {
    uploadCertificatePdf,
     downloadCertificatePdf
};


const certificateService =
    require("../services/certificate.service");

// ============================================================
// GET CERTIFICATE ELIGIBILITY
// ============================================================
// Purpose:
// Handle the HTTP request and return certificate eligibility.
//
// Why we use this controller:
// Controllers receive request data, call services,
// and send HTTP responses to the frontend.

async function getCertificateEligibility(req, res, next) {
    try {
        // Read the logged-in user's ID from authentication middleware.
        const userId = req.user.id;

        // Read the enrollment ID from the URL parameter.
        const { enrollmentId } = req.params;

        // Call the service to check certificate eligibility.
        const result =
            await certificateService.getCertificateEligibility(
                userId,
                enrollmentId
            );

        // Send a successful response with eligibility details.
        return res.status(200).json({
            success: true,
            message: "Certificate eligibility fetched successfully",
            data: result
        });

    } catch (error) {
        // Forward errors to the existing global error handler.
        next(error);
    }
}

// ============================================================
// GENERATE CERTIFICATE
// ============================================================

async function generateCertificate(req, res, next) {
    try {
        const userId = req.user.id;
        const { enrollmentId } = req.params;

        const result =
            await certificateService.generateCertificate(
                userId,
                enrollmentId
            );

        return res.status(201).json({
            success: true,
            message: "Certificate generated successfully",
            data: result
        });

    } catch (error) {
        next(error);
    }
}


 // ============================================================
 // DOWNLOAD CERTIFICATE PDF
 // ============================================================

async function downloadCertificatePdf(req, res, next) {
    try {
        const userId = req.user.id;
        const { certificateId } = req.params;

        const result =
            await certificateService.downloadCertificatePdf(
                userId,
                certificateId
            );

        // Set PDF response headers.
        res.setHeader("Content-Type", "application/pdf");

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${result.certificate.certificate_number}.pdf"`
        );

        res.setHeader(
            "Content-Length",
            result.pdfBuffer.length
        );

        // Send generated PDF to the browser.
        return res.status(200).send(result.pdfBuffer);

    } catch (error) {
        next(error);
    }
}

async function retryCertificatePdf(req, res, next) {
    try {
        const userId = req.user.id;
        const { certificateId } = req.params;

        const result =
            await certificateService.retryCertificatePdf(
                userId,
                certificateId
            );

        return res.status(200).json({
            success: true,
            message: "Certificate PDF uploaded successfully",
            data: result
        });

    } catch (error) {
        next(error);
    }
}



 // ============================================================
 // VERIFY CERTIFICATE
 // ============================================================

async function verifyCertificate(req, res, next) {
    try {
        const { verificationCode } = req.params;

        const result =
            await certificateService.verifyCertificate(
                verificationCode
            );

        return res.status(200).json({
            success: true,
            message: result.message,
            data: result
        });

    } catch (error) {
        next(error);
    }
}


// ============================================================
// GET EXISTING CERTIFICATE BY ENROLLMENT
// ============================================================
// Purpose:
// Handle the request to fetch an existing student certificate.

async function getCertificateByEnrollment(req, res, next) {
    try {
        const userId = req.user.id;
        const { enrollmentId } = req.params;

        const result =
            await certificateService.getCertificateByEnrollment(
                userId,
                enrollmentId
            );

        return res.status(200).json({
            success: true,
            message: result
                ? "Existing certificate fetched successfully"
                : "No certificate found for this enrollment",
            data: result
        });

    } catch (error) {
        next(error);
    }
}

// ============================================================
// REGENERATE EXISTING CERTIFICATE PDF
// ============================================================

async function regenerateCertificatePdf(req, res, next) {
    try {
        const userId = req.user.id;
        const { certificateId } = req.params;

        const result =
            await certificateService.regenerateCertificatePdf(
                userId,
                certificateId
            );

        return res.status(200).json({
            success: true,
            message: "Certificate PDF regenerated successfully",
            data: result
        });

    } catch (error) {
        next(error);
    }
}


module.exports = {
    getCertificateEligibility,
     generateCertificate,
     downloadCertificatePdf,
     retryCertificatePdf,
      verifyCertificate,
      getCertificateByEnrollment,
      regenerateCertificatePdf
      
};

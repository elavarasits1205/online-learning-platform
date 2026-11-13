
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

// ============================================================
// GENERATE CERTIFICATE PDF
// ============================================================
// Purpose:
// Generate a professional landscape certificate PDF.
// Embed a QR code for public certificate verification.
// Return a Buffer for Supabase Storage upload.

async function generateCertificatePdf(certificate) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: "A4",
                layout: "landscape",
                margins: {
                    top: 45,
                    bottom: 45,
                    left: 55,
                    right: 55
                },
                info: {
                    Title: certificate.certificate_title,
                    Author: "Learnova",
                    Subject: "Course Completion Certificate"
                }
            });

            const chunks = [];

            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            const pageWidth = doc.page.width;
            const pageHeight = doc.page.height;
            const centerX = pageWidth / 2;

            // Build the public certificate verification URL.
            const frontendUrl = process.env.FRONTEND_URL;

            if (!frontendUrl) {
                throw new Error("FRONTEND_URL is not configured");
            }

            const verificationUrl = new URL(
                "/verify-certificate",
                frontendUrl
            );

            verificationUrl.searchParams.set(
                "code",
                certificate.verification_code
            );

            // Generate QR code as a PNG buffer.
            const qrBuffer = await QRCode.toBuffer(
                verificationUrl.toString(),
                {
                    type: "png",
                    width: 300,
                    margin: 2,
                    errorCorrectionLevel: "H"
                }
            );

            // Outer certificate border.
            doc.lineWidth(4)
                .strokeColor("#173B63")
                .rect(25, 25, pageWidth - 50, pageHeight - 50)
                .stroke();

            // Inner certificate border.
            doc.lineWidth(1)
                .strokeColor("#C69C45")
                .rect(34, 34, pageWidth - 68, pageHeight - 68)
                .stroke();

            // Brand name.
            doc.font("Helvetica-Bold")
                .fontSize(22)
                .fillColor("#173B63")
                .text("LEARNOVA", 55, 65, {
                    align: "center",
                    width: pageWidth - 110
                });

            // Certificate title.
            doc.font("Times-Bold")
                .fontSize(32)
                .fillColor("#173B63")
                .text(
                    certificate.certificate_title ||
                    "Certificate of Completion",
                    55,
                    115,
                    {
                        align: "center",
                        width: pageWidth - 110
                    }
                );

            // Subtitle.
            doc.font("Helvetica")
                .fontSize(14)
                .fillColor("#555555")
                .text(
                    "THIS CERTIFICATE IS PROUDLY PRESENTED TO",
                    55,
                    175,
                    {
                        align: "center",
                        width: pageWidth - 110
                    }
                );

            // Student name.
            doc.font("Times-Bold")
                .fontSize(30)
                .fillColor("#222222")
                .text(
                    certificate.student_name_snapshot,
                    55,
                    215,
                    {
                        align: "center",
                        width: pageWidth - 110
                    }
                );

            // Decorative line.
            doc.moveTo(centerX - 150, 260)
                .lineTo(centerX + 150, 260)
                .lineWidth(1.5)
                .strokeColor("#C69C45")
                .stroke();

            // Completion description.
            doc.font("Helvetica")
                .fontSize(14)
                .fillColor("#555555")
                .text(
                    "For successfully completing the course",
                    55,
                    285,
                    {
                        align: "center",
                        width: pageWidth - 110
                    }
                );

            // Course name.
            doc.font("Helvetica-Bold")
                .fontSize(21)
                .fillColor("#173B63")
                .text(
                    certificate.course_title_snapshot,
                    75,
                    320,
                    {
                        align: "center",
                        width: pageWidth - 150
                    }
                );

            // Completion date.
            const completionDate = new Date(
                certificate.completion_date
            ).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                timeZone: "UTC"
            });

            doc.font("Helvetica")
                .fontSize(12)
                .fillColor("#555555")
                .text(
                    `Completion Date: ${completionDate}`,
                    55,
                    375,
                    {
                        align: "center",
                        width: pageWidth - 110
                    }
                );

            // Certificate number.
            doc.font("Helvetica-Bold")
                .fontSize(10)
                .fillColor("#173B63")
                .text(
                    `Certificate No: ${certificate.certificate_number}`,
                    55,
                    425,
                    {
                        align: "center",
                        width: pageWidth - 110
                    }
                );

            // Verification code.
            doc.font("Helvetica")
                .fontSize(9)
                .fillColor("#555555")
                .text(
                    `Verification Code: ${certificate.verification_code}`,
                    55,
                    445,
                    {
                        align: "center",
                        width: pageWidth - 110
                    }
                );

            // Embed QR code at the bottom-right corner.
            const qrSize = 75;
            const qrX = pageWidth - 125;
            const qrY = 465;

            doc.image(qrBuffer, qrX, qrY, {
                width: qrSize,
                height: qrSize
            });

            // QR code instruction.
            doc.font("Helvetica-Bold")
                .fontSize(8)
                .fillColor("#173B63")
                .text(
                    "SCAN TO VERIFY",
                    qrX - 5,
                    qrY + qrSize + 5,
                    {
                        width: qrSize + 10,
                        align: "center"
                    }
                );

            // Footer.
            doc.font("Helvetica-Bold")
                .fontSize(11)
                .fillColor("#173B63")
                .text(
                    "LEARNOVA - ONLINE LEARNING PLATFORM",
                    55,
                    510,
                    {
                        align: "center",
                        width: pageWidth - 110
                    }
                );

            // Finish PDF generation.
            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateCertificatePdf
};

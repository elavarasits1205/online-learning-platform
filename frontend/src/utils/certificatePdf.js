import { jsPDF } from "jspdf";

function displayDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

export function downloadCertificatePdf(certificate, fallback = {}) {
  if (!certificate) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  const title = certificate.certificate_title || "Certificate of Completion";
  const studentName = certificate.student_name_snapshot || fallback.studentName || "Student";
  const courseTitle = certificate.course_title_snapshot || fallback.courseTitle || "Course";
  const certificateNumber = certificate.certificate_number || "N/A";
  const verificationCode = certificate.verification_code || "N/A";
  const completionDate = displayDate(certificate.completion_date || certificate.issue_date);

  doc.setFillColor(248, 247, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setDrawColor(91, 61, 245);
  doc.setLineWidth(1.2);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  doc.setLineWidth(0.4);
  doc.rect(14, 14, pageWidth - 28, pageHeight - 28);

  doc.setTextColor(91, 61, 245);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ONLINE LEARNING PLATFORM", centerX, 30, { align: "center" });

  doc.setTextColor(17, 23, 47);
  doc.setFontSize(34);
  doc.text(title, centerX, 55, { align: "center" });

  doc.setDrawColor(91, 61, 245);
  doc.setLineWidth(0.8);
  doc.line(centerX - 35, 62, centerX + 35, 62);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text("This certificate is proudly presented to", centerX, 78, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(45, 35, 120);
  doc.text(studentName, centerX, 96, { align: "center", maxWidth: pageWidth - 50 });

  doc.setTextColor(17, 23, 47);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text("for successfully completing", centerX, 111, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(courseTitle, centerX, 123, { align: "center", maxWidth: pageWidth - 50 });

  if (completionDate) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Completed on ${completionDate}`, centerX, 138, { align: "center" });
  }

  doc.setFontSize(10);
  doc.setTextColor(80, 86, 110);
  doc.text(`Certificate No: ${certificateNumber}`, 28, pageHeight - 30);
  doc.text(`Verification Code: ${verificationCode}`, 28, pageHeight - 24);
  doc.text("This certificate can be verified using the code above.", pageWidth - 28, pageHeight - 30, { align: "right" });

  const safeName = String(courseTitle || "course")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  doc.save(`certificate-${safeName || "course"}.pdf`);
}

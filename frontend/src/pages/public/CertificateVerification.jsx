
import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  TextField,
  Typography,
} from "@mui/material";

import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import api from "../../service/Api";

export default function CertificateVerification() {
  const [verificationCode, setVerificationCode] = useState("");
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchParams] = useSearchParams();

  // Verify certificate using the public backend API.
// Verify certificate using the public backend API.
const verifyCode = async (code) => {
  const normalizedCode = code.trim();

  if (!/^[A-Fa-f0-9]{48}$/.test(normalizedCode)) {
    setError("Please enter a valid 48-character verification code.");
    setCertificate(null);
    setSearched(false);
    return;
  }

  setLoading(true);
  setError("");
  setCertificate(null);
  setSearched(false);

  try {
    const response = await api.get(
      `/student/certificates/verify/${encodeURIComponent(normalizedCode)}`
    );

    setCertificate(response.data?.data);
    setSearched(true);
  } catch (err) {
    console.error("Certificate verification failed:", err);

    setError(
      err.response?.data?.message ||
        "Unable to verify certificate. Please try again."
    );

    setSearched(true);
  } finally {
    setLoading(false);
  }
};

// Handle manual form submission.
const handleVerify = async (event) => {
  event.preventDefault();
  await verifyCode(verificationCode);
};

// Automatically verify when a QR URL contains a code.
useEffect(() => {
  const code = searchParams.get("code");

  if (code) {
    setVerificationCode(code);
    verifyCode(code);
  }
}, [searchParams]);
  const isValid = certificate?.isValid === true;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fb", py: 7 }}>
      <Container maxWidth="sm">
        <Card
          elevation={3}
          sx={{ borderRadius: 3, overflow: "hidden" }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Box textAlign="center" mb={4}>
              <WorkspacePremiumRoundedIcon
                sx={{ fontSize: 55, color: "#d69e24" }}
              />

              <Typography variant="h4" fontWeight={700} mt={2}>
                Certificate Verification
              </Typography>

              <Typography color="text.secondary" mt={1}>
                Verify the authenticity of a Learnova certificate.
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleVerify}>
              <TextField
                fullWidth
                label="Verification Code"
                placeholder="Enter your 48-character code"
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(event.target.value)
                }
                inputProps={{ maxLength: 48 }}
                helperText={`${verificationCode.length}/48 characters`}
                required
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{ mt: 3, py: 1.4 }}
              >
                {loading ? (
                  <CircularProgress size={23} color="inherit" />
                ) : (
                  "Verify Certificate"
                )}
              </Button>
            </Box>

            {searched && certificate && (
              <Box mt={4}>
                {isValid ? (
                  <Alert
                    severity="success"
                    icon={<VerifiedRoundedIcon />}
                    sx={{ mb: 3 }}
                  >
                    Certificate verified successfully!
                  </Alert>
                ) : (
                  <Alert
                    severity="error"
                    icon={<CancelRoundedIcon />}
                    sx={{ mb: 3 }}
                  >
                    {certificate.message || "Certificate is invalid."}
                  </Alert>
                )}

                {certificate.certificate && (
                  <Box>
                    <Typography variant="h6" fontWeight={700} mb={2}>
                      Certificate Details
                    </Typography>

                    <Typography mb={1}>
                      <strong>Certificate Number:</strong>{" "}
                      {certificate.certificate.certificateNumber}
                    </Typography>

                    <Typography mb={1}>
                      <strong>Student Name:</strong>{" "}
                      {certificate.certificate.studentName}
                    </Typography>

                    <Typography mb={1}>
                      <strong>Course:</strong>{" "}
                      {certificate.certificate.courseTitle}
                    </Typography>

                    <Typography mb={1}>
                      <strong>Certificate Title:</strong>{" "}
                      {certificate.certificate.certificateTitle}
                    </Typography>

                    <Typography mb={1}>
                      <strong>Completion Date:</strong>{" "}
                      {certificate.certificate.completionDate
                        ? new Date(
                            certificate.certificate.completionDate
                          ).toLocaleDateString("en-IN")
                        : "N/A"}
                    </Typography>

                    <Typography mb={1}>
                      <strong>Issue Date:</strong>{" "}
                      {certificate.certificate.issueDate
                        ? new Date(
                            certificate.certificate.issueDate
                          ).toLocaleDateString("en-IN")
                        : "N/A"}
                    </Typography>

                    <Typography>
                      <strong>Status:</strong>{" "}
                      {certificate.certificate.status}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        <Typography
          textAlign="center"
          color="text.secondary"
          mt={3}
          variant="body2"
        >
          Learnova - Online Learning Platform
        </Typography>
      </Container>
    </Box>
  );
}


import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import LearnovaLogoMark from "../../component/LearnovaLogoMark";
import { IconButton, MenuItem, Select } from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";

import {
  registerStudent,
  getInstitutions,
} from "../../service/Authapi";

import Button from "../../component/buttons/Button";
import InputField from "../../component/fields/InputField";
import studentRegisterSchema from "../../validation/studentRegisterSchema";
import "./StudentRegisterPage.scss";

const initialFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  username: "",
  password: "",
  confirmPassword: "",
  dateOfBirth: "",
  gender: "",
  institutionId: "",
  registerNumber: "",
  referralCode: "",
};

function getResponseData(response) {
  const body = response?.data ?? response;
  return body?.data ?? body;
}

function StudentRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTimer = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");

  const [formData, setFormData] = useState(() => ({
    ...initialFormData,
    referralCode: (searchParams.get("ref") || "").trim().toUpperCase(),
  }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [institutions, setInstitutions] = useState([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [institutionError, setInstitutionError] = useState("");

  // ============================================================
  // LOAD INSTITUTIONS
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    async function loadInstitutions() {
      try {
        setInstitutionsLoading(true);
        setInstitutionError("");

        const response = await getInstitutions();
        const data = getResponseData(response);
        const list = data?.institutions;

        if (response?.success === false || !Array.isArray(list)) {
          throw new Error("Invalid institutions response.");
        }

        if (!cancelled) {
          setInstitutions(list);
        }
      } catch (err) {
        console.error("Load institutions error:", err);

        if (!cancelled) {
          setInstitutions([]);
          setInstitutionError(
            "Unable to load colleges. Please refresh and try again."
          );
        }
      } finally {
        if (!cancelled) {
          setInstitutionsLoading(false);
        }
      }
    }

    loadInstitutions();

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // CLEANUP REDIRECT TIMER
  // ============================================================

  useEffect(() => {
    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, []);

  // ============================================================
  // HANDLE FORM CHANGE
  // ============================================================

  function handleChange(event) {
    const { name, value } = event.target;
    const nextValue = name === "phoneNumber"
      ? value.replace(/\D/g, "").slice(0, 15)
      : value;

    setFormData((previous) => ({
      ...previous,
      [name]: nextValue,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));

    setError("");
    setSuccess("");
  }

  // ============================================================
  // HANDLE REGISTRATION
  // ============================================================

  async function handleSubmit(event) {
    event.preventDefault();

    setErrors({});
    setError("");
    setSuccess("");

    // Do not submit if the college list failed to load.
    if (institutionsLoading) {
      setError("Please wait until the college list finishes loading.");
      return;
    }

    if (institutionError || institutions.length === 0) {
      setError(
        institutionError ||
          "No institutions are available. Please try again later."
      );
      return;
    }

    try {
      const validatedData = await studentRegisterSchema.validate(
        formData,
        {
          abortEarly: false,
          stripUnknown: true,
        }
      );

      // Ensure the selected institution exists in the loaded list.
      const selectedInstitution = institutions.find(
        (institution) =>
          String(institution.id) === String(validatedData.institutionId)
      );

      if (!selectedInstitution) {
        setErrors({
          institutionId: "Please select a valid college.",
        });
        return;
      }

      setLoading(true);

      const payload = {
        ...validatedData,

        firstName: validatedData.firstName.trim(),
        lastName: validatedData.lastName.trim(),
        email: validatedData.email.trim(),
        phoneNumber: countryCode + validatedData.phoneNumber.trim(),
        username: validatedData.username.trim(),

        institutionId: String(selectedInstitution.id),
        registerNumber: validatedData.registerNumber.trim(),
        referralCode: (validatedData.referralCode || "").trim().toUpperCase(),

        dateOfBirth: validatedData.dateOfBirth || null,
        gender: validatedData.gender || null,
      };

      const response = await registerStudent(payload);
      const data = getResponseData(response);

      if (!data || data.success === false) {
        throw new Error(
          data?.message || "Student registration failed."
        );
      }

      setSuccess(
        data.message || "Student registered successfully."
      );

      setFormData(initialFormData);

      redirectTimer.current = setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      if (err?.name === "ValidationError") {
        const validationErrors = {};

        err.inner?.forEach((item) => {
          if (item.path && !validationErrors[item.path]) {
            validationErrors[item.path] = item.message;
          }
        });

        setErrors(validationErrors);
        return;
      }

      console.error("Student registration error:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Student registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <main className="student-register-page">
      <section className="student-register-shell">
        {/* Left-side branding panel */}
        <aside className="register-visual-panel">
          <Link to="/" className="register-brand">
            <LearnovaLogoMark className="register-brand-mark" />
            <span>Learnova</span>
          </Link>

          <div className="register-visual-content">
            <span className="register-eyebrow">
              YOUR LEARNING JOURNEY STARTS HERE
            </span>

            <h1>
              Learn something
              <br />
              new every day.
            </h1>

            <p>
              Build your skills, explore new interests, and take
              the next step toward your goals.
            </p>

            <div className="learning-illustration">
              <div className="illustration-orbit orbit-one" />
              <div className="illustration-orbit orbit-two" />

              <div className="illustration-card illustration-card-top">
                <span className="illustration-icon">✦</span>
                <span>
                  <strong>Keep learning</strong>
                  <small>One step at a time</small>
                </span>
              </div>

              <div className="illustration-book">
                <div className="book-page book-page-left">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="book-page book-page-right">
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="illustration-card illustration-card-bottom">
                <span className="illustration-progress-icon">✓</span>
                <span>
                  <strong>Your future</strong>
                  <small>Starts with a skill</small>
                </span>
              </div>

              <span className="illustration-star star-one">✦</span>
              <span className="illustration-star star-two">✧</span>
              <span className="illustration-dot dot-one" />
              <span className="illustration-dot dot-two" />
            </div>
          </div>

          <div className="register-visual-footer">
            <span>Learn at your own pace.</span>
            <span>Grow at your own speed.</span>
          </div>
        </aside>

        {/* Right-side registration form */}
        <section className="register-form-panel">
          <div className="register-form-inner">
            <div className="register-mobile-brand">
              <LearnovaLogoMark className="register-brand-mark" />
              <span>Learnova</span>
            </div>

            <header className="student-register-header">
              <span className="register-step-label">
                CREATE YOUR ACCOUNT
              </span>

              <h2>Join Learnova</h2>

              <p>
                Create your student account and start learning.
              </p>
            </header>

            {error && (
              <div
                className="register-alert register-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="register-alert register-success"
                role="status"
              >
                {success}
                <p className="register-success-hint">
                  Redirecting you to login...
                </p>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="student-register-form"
              noValidate
            >
              <h3 className="registration-section-title">
                Personal information
              </h3>

              <div className="registration-grid">
                <div className="registration-field">
                  <InputField
                    name="firstName"
                    label="First name"
                    value={formData.firstName}
                    onChange={handleChange}
                    autoComplete="given-name"
                    disabled={loading}
                    required
                    error={Boolean(errors.firstName)}
                    helperText={errors.firstName}
                  />
                </div>

                <div className="registration-field">
                  <InputField
                    name="lastName"
                    label="Last name"
                    value={formData.lastName}
                    onChange={handleChange}
                    autoComplete="family-name"
                    disabled={loading}
                    required
                    error={Boolean(errors.lastName)}
                    helperText={errors.lastName}
                  />
                </div>

                <div className="registration-field registration-full-width">
                  <InputField
                    name="email"
                    label="Email address"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                    disabled={loading}
                    required
                    error={Boolean(errors.email)}
                    helperText={errors.email}
                  />
                </div>

                <div className="registration-field registration-full-width">
                  <InputField
                    name="phoneNumber"
                    label="Phone number"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    autoComplete="tel"
                    startAdornment={
                      <Select
                        variant="standard"
                        disableUnderline
                        value={countryCode}
                        onChange={(event) => setCountryCode(event.target.value)}
                        disabled={loading}
                        aria-label="Phone country code"
                        sx={{ minWidth: 108, fontSize: 14, whiteSpace: "nowrap" }}
                      >
                        <MenuItem value="+91">+91 India</MenuItem>
                        <MenuItem value="+1">+1 US/Canada</MenuItem>
                        <MenuItem value="+44">+44 UK</MenuItem>
                        <MenuItem value="+61">+61 Australia</MenuItem>
                        <MenuItem value="+65">+65 Singapore</MenuItem>
                        <MenuItem value="+971">+971 UAE</MenuItem>
                      </Select>
                    }
                    inputProps={{ inputMode: "numeric", maxLength: 15, pattern: "[0-9]{6,15}" }}
                    InputLabelProps={{ shrink: true }}
                    disabled={loading}
                    required
                    error={Boolean(errors.phoneNumber)}
                    helperText={errors.phoneNumber}
                  />
                </div>

                <div className="registration-field">
                  <InputField
                    name="dateOfBirth"
                    label="Date of birth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    disabled={loading}
                    slotProps={{
                      inputLabel: { shrink: true },
                    }}
                    error={Boolean(errors.dateOfBirth)}
                    helperText={errors.dateOfBirth}
                  />
                </div>

                <div className="registration-field">
                  <InputField
                    name="gender"
                    label="Gender"
                    value={formData.gender}
                    onChange={handleChange}
                    select
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                      {
                        value: "PREFER_NOT_TO_SAY",
                        label: "Prefer not to say",
                      },
                    ]}
                    disabled={loading}
                    error={Boolean(errors.gender)}
                    helperText={errors.gender}
                  />
                </div>

                {/* Institution dropdown */}
                <div className="registration-field registration-full-width">
                  <InputField
                    name="institutionId"
                    label="College / Institution"
                    value={formData.institutionId}
                    onChange={handleChange}
                    select
                    options={institutions.map((institution) => ({
                      value: String(institution.id),
                      label: institution.name,
                    }))}
                    disabled={loading || institutionsLoading}
                    required
                    error={Boolean(errors.institutionId)}
                    helperText={
                      errors.institutionId ||
                      (institutionsLoading
                        ? "Loading institutions..."
                        : institutionError)
                    }
                  />
                </div>

                {/* College register number */}
                <div className="registration-field registration-full-width">
                  <InputField
                    name="registerNumber"
                    label="College Register Number"
                    value={formData.registerNumber}
                    onChange={handleChange}
                    autoComplete="off"
                    disabled={loading}
                    required
                    error={Boolean(errors.registerNumber)}
                    helperText={errors.registerNumber}
                  />
                </div>

                {/* Optional instructor referral code */}
                <div className="registration-field registration-full-width">
                  <InputField
                    name="referralCode"
                    label="Instructor referral code (optional)"
                    value={formData.referralCode}
                    onChange={handleChange}
                    autoComplete="off"
                    disabled={loading}
                    error={Boolean(errors.referralCode)}
                    helperText={
                      errors.referralCode ||
                      "Enter the code shared by your instructor to receive a referral discount."
                    }
                  />
                </div>

              </div>

              <h3 className="registration-section-title account-section-title">
                Account security
              </h3>

              <div className="registration-grid">
                <div className="registration-field registration-full-width">
                  <InputField
                    name="username"
                    label="Username"
                    value={formData.username}
                    onChange={handleChange}
                    autoComplete="username"
                    disabled={loading}
                    required
                    error={Boolean(errors.username)}
                    helperText={errors.username}
                  />
                </div>

                <div className="registration-field">
                  <InputField
                    name="password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    endAdornment={<IconButton aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} edge="end" size="small">{showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</IconButton>}
                    disabled={loading}
                    required
                    error={Boolean(errors.password)}
                    helperText={
                      errors.password || "Use at least 8 characters."
                    }
                  />
                </div>

                <div className="registration-field">
                  <InputField
                    name="confirmPassword"
                    label="Confirm password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    endAdornment={<IconButton aria-label={showConfirmPassword ? "Hide password" : "Show password"} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((visible) => !visible)} edge="end" size="small">{showConfirmPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</IconButton>}
                    disabled={loading}
                    required
                    error={Boolean(errors.confirmPassword)}
                    helperText={errors.confirmPassword}
                  />
                </div>
              </div>

              <div className="registration-submit">
                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  disabled={
                    loading ||
                    institutionsLoading ||
                    Boolean(institutionError) ||
                    institutions.length === 0
                  }
                >
                  {loading
                    ? "Creating account..."
                    : institutionsLoading
                      ? "Loading colleges..."
                      : "Create student account"}
                </Button>
              </div>

              <p className="registration-login">
                Already have an account?{" "}
                <Link to="/login">Sign in</Link>
              </p>

              <p className="register-terms-note">
                Start your learning journey with Learnova.
              </p>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}

export default StudentRegisterPage;

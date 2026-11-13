import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LearnovaLogoMark from "../../component/LearnovaLogoMark";

import { loginUser, getCurrentUser } from "../../service/Authapi";
import Button from "../../component/buttons/Button";
import InputField from "../../component/fields/InputField";
import loginSchema from "../../validation/loginSchema";
import {
  setAuthUser,
  clearAuthUser,
} from "../../utils/authCookie";

import "./LoginPage.scss";

// ------------------------------------------------------------
// Response helpers
// ------------------------------------------------------------

function getResponseData(response) {
  const body = response?.data ?? response;
  return body?.data ?? body;
}

function getRoleName(role) {
  if (typeof role === "string") {
    return role.trim().toUpperCase();
  }

  if (role && typeof role === "object") {
    const name =
      role.code ??
      role.name ??
      role.role_code ??
      role.role_name ??
      role.roleName;

    return typeof name === "string" ? name.trim().toUpperCase() : "";
  }

  return "";
}

function normalizeRoles(user) {
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : Array.isArray(user?.user?.roles)
      ? user.user.roles
      : [];

  const singleRole =
    user?.role ??
    user?.role_name ??
    user?.roleName ??
    user?.role_code ??
    user?.user?.role ??
    user?.user?.role_name;

  return [
    ...new Set(
      [...roles.map(getRoleName), ...(singleRole ? [getRoleName(singleRole)] : [])]
        .filter(Boolean)
    ),
  ];
}

function getDashboardPath(roles) {
  if (roles.includes("ADMIN")) return "/admin/dashboard";
  if (roles.includes("INSTRUCTOR")) return "/instructor/dashboard";
  if (roles.includes("STUDENT")) return "/student/dashboard";
  return null;
}

function clearAuthentication() {
  // Tokens live in HttpOnly cookies and are cleared by the backend.
  // Only the non-sensitive UI user cookie is removed here.
  clearAuthUser();
}

function getRequestedStudentDestination(location) {
  const stateFrom = location.state?.from;

  const stateDestination =
    typeof stateFrom === "string"
      ? stateFrom
      : stateFrom?.pathname
        ? `${stateFrom.pathname}${stateFrom.search || ""}${stateFrom.hash || ""}`
        : null;

  const queryDestination = new URLSearchParams(location.search).get("redirect");
  const requestedDestination = queryDestination || stateDestination;

  // Only accept same-origin app paths. Do not accept protocol-relative URLs.
  if (
    typeof requestedDestination === "string" &&
    requestedDestination.startsWith("/") &&
    !requestedDestination.startsWith("//")
  ) {
    return requestedDestination;
  }

  return null;
}

// ------------------------------------------------------------
// Login page
// ------------------------------------------------------------

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTimer = useRef(null);

  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({ ...previous, [name]: value }));
    setFieldErrors((previous) => ({ ...previous, [name]: "" }));
    setError("");
    setSuccess("");
  }

  function getErrorMessage(err) {
    const status = err?.response?.status;

    if (status === 401) return "Invalid username/email or password.";

    if (status === 403) {
      return (
        err?.response?.data?.message ||
        "Your account is not allowed to log in. It may require approval."
      );
    }

    if (status >= 500) return "Server error. Please try again later.";

    if (err?.code === "ERR_NETWORK") {
      return "Cannot connect to the backend. Check that your backend server is running.";
    }

    return (
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Login failed. Please try again."
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setSuccess("");
    setFieldErrors({});

    // 1. Validate using the existing Yup schema.
    let validatedData;

    try {
      validatedData = await loginSchema.validate(formData, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (validationError) {
      if (validationError.name === "ValidationError") {
        const errors = {};

        validationError.inner.forEach((item) => {
          if (item.path && !errors[item.path]) errors[item.path] = item.message;
        });

        if (validationError.path && !errors[validationError.path]) {
          errors[validationError.path] = validationError.message;
        }

        setFieldErrors(errors);
        return;
      }

      setError("Unable to validate the form. Please try again.");
      return;
    }

    setLoading(true);

    try {
      // 2. Authenticate.
      const loginResponse = getResponseData(
        await loginUser(validatedData.identifier, validatedData.password)
      );

      if (!loginResponse || loginResponse.success === false) {
        throw new Error(loginResponse?.message || "Login failed.");
      }

      // 3. The backend has set HttpOnly access/refresh cookies on the
      // login response, so no token is stored in browser JavaScript.

      // 4. Verify the authenticated identity from /auth/me.
      const meResponse = getResponseData(await getCurrentUser());

      if (!meResponse || meResponse.success === false) {
        throw new Error(
          meResponse?.message || "Unable to verify the authenticated user."
        );
      }

      const authenticatedUser =
        meResponse.user ?? meResponse.currentUser ?? meResponse.data?.user ?? meResponse;

      if (!authenticatedUser || typeof authenticatedUser !== "object") {
        throw new Error("/auth/me did not return valid user details.");
      }

      // 5. Use roles from the verified user response, not the login response.
      const roles = normalizeRoles(authenticatedUser);
      let destination = getDashboardPath(roles);

      if (!destination) {
        throw new Error(
          "Your authenticated account has no recognized role. Please contact the administrator."
        );
      }

      // Preserve the friend's return-to-page behavior for students only.
      if (roles.includes("STUDENT")) {
        destination = getRequestedStudentDestination(location) || destination;
      }

      const sessionUser = {
        ...authenticatedUser,
        roles,
        permissions: Array.isArray(authenticatedUser.permissions)
          ? authenticatedUser.permissions
          : [],
      };

      // Replace any cached identity with the user verified by /auth/me.
      // Keeping a previous account's role here can route this student to "/".
      setAuthUser(sessionUser);

      // 6. Redirect after successful verification.
      setSuccess(loginResponse.message || "Login successful. Redirecting...");
      redirectTimer.current = setTimeout(() => {
        navigate(destination, { replace: true });
      }, 400);
    } catch (err) {
      console.error("Login or current-user verification failed:", err);
      clearAuthentication();
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <aside className="login-visual">
          <Link to="/" className="login-brand">
            <LearnovaLogoMark className="login-brand-mark" />
            <span>Learnova</span>
          </Link>

          <div className="visual-content">
            <span className="visual-eyebrow">YOUR JOURNEY STARTS HERE</span>

            <h1>
              Learn today.
              <br />
              <span>Lead tomorrow.</span>
            </h1>

            <p className="visual-description">
              Build new skills, explore new possibilities, and take the next
              step in your learning journey.
            </p>

            <div className="learning-art" aria-hidden="true">
              <div className="art-orbit orbit-one" />
              <div className="art-orbit orbit-two" />

              <div className="art-card art-card-main">
                <div className="art-card-top">
                  <span className="art-dot" />
                  <span className="art-dot" />
                  <span className="art-dot" />
                  <span className="art-card-label">MY LEARNING</span>
                </div>

                <div className="art-book">
                  <div className="book-spine" />
                  <div className="book-page">
                    <span />
                    <span />
                    <span />
                    <span className="book-short-line" />
                  </div>
                  <div className="book-page book-page-right">
                    <span />
                    <span />
                    <span className="book-short-line" />
                  </div>
                </div>

                <div className="art-progress">
                  <div className="progress-copy">
                    <span>Course progress</span>
                    <strong>78%</strong>
                  </div>
                  <div className="progress-track">
                    <span />
                  </div>
                </div>
              </div>

              <div className="art-floating-card floating-check">
                <span className="floating-icon">✓</span>
                <div>
                  <strong>Lesson completed</strong>
                  <small>You're doing great!</small>
                </div>
              </div>

              <div className="art-floating-card floating-stats">
                <span className="stats-icon">↗</span>
                <div>
                  <strong>Keep growing</strong>
                  <small>One lesson at a time</small>
                </div>
              </div>

              <span className="art-sparkle sparkle-one">✦</span>
              <span className="art-sparkle sparkle-two">✧</span>
              <span className="art-sparkle sparkle-three">✦</span>
            </div>

            <div className="visual-benefits">
              <div>
                <span className="benefit-check">✓</span>
                <span>Learn at your own pace</span>
              </div>
              <div>
                <span className="benefit-check">✓</span>
                <span>Grow skills that matter</span>
              </div>
            </div>
          </div>

          <p className="visual-footer">
            Your future is built one lesson at a time.
          </p>
        </aside>

        <section className="login-form-panel">
          <div className="login-form-inner">
            <div className="mobile-brand">
            <LearnovaLogoMark className="login-brand-mark" />
              <span>Learnova</span>
            </div>

            <div className="form-heading">
              <span className="form-eyebrow">WELCOME BACK</span>
              <h2>Sign in to your account</h2>
              <p>Enter your details below to continue learning.</p>
            </div>

            {success && (
              <div className="login-message success-message" role="status">
                {success}
              </div>
            )}

            {error && (
              <div className="login-message error-message" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <InputField
                name="identifier"
                label="Username or Email"
                value={formData.identifier}
                onChange={handleChange}
                placeholder="Enter username or email"
                autoComplete="username"
                disabled={loading}
                required
                error={Boolean(fieldErrors.identifier)}
                helperText={fieldErrors.identifier}
              />

              <div className="password-field-wrap">
                <InputField
                  name="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                  error={Boolean(fieldErrors.password)}
                  helperText={fieldErrors.password}
                />

                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  title={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9 7-.2 1.1-1 2.3-2.1 3.3" />
                      <path d="M6.2 6.2C3.9 7.7 2.3 10 2 12c.5 2.5 4 7 10 7 1.2 0 2.3-.2 3.3-.6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="login-forgot-password-row">
                <Link to="/forgot-password">Forgot password?</Link>
              </div>

              <div className="login-submit-wrap">
                <Button type="submit" fullWidth loading={loading} disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                  {!loading && <span className="button-arrow">→</span>}
                </Button>
              </div>
            </form>

            <div className="login-divider">
              <span>NEW TO LEARNOVA?</span>
            </div>

            <div className="register-links">
              <p>Don't have an account?</p>
              <div className="register-options">
                <Link to="/register/student">
                  Register as Student <span>→</span>
                </Link>
                <Link to="/register/instructor">
                  Register as Instructor <span>→</span>
                </Link>
              </div>
            </div>

            <p className="auth-home-link">
              <Link to="/">← Back to home</Link>
            </p>

            <p className="login-legal">
              By signing in, you can continue your learning journey with Learnova.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}

export default LoginPage;



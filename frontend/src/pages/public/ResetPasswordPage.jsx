import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import {
  resetPassword,
  verifyPasswordResetOtp,
} from "../../service/Authapi";
import "./PasswordResetPage.scss";

function readResetParams(hash) {
  const params = new URLSearchParams(
    String(hash || "").replace(/^#/, "")
  );

  return {
    token: params.get("token") || "",
    email: params.get("email") || "",
  };
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const { token: initialToken, email: initialEmail } = useMemo(
    () => readResetParams(location.hash),
    [location.hash]
  );

  const [email] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [step, setStep] = useState(
    initialToken && initialEmail ? "otp" : "invalid"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Verify the OTP sent to the user's email.
  async function handleVerify(event) {
    event.preventDefault();

    setError("");

    if (!email || !initialToken) {
      setError(
        "Your reset link is invalid. Please request a new reset link."
      );
      return;
    }

    if (otp.length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const response = await verifyPasswordResetOtp({
        email,
        token: initialToken,
        otp,
      });

      const resetTicket =
        response.data?.data?.reset_ticket ||
        response.data?.reset_ticket ||
        "";

      if (!resetTicket) {
        setError(
          "The verification was successful, but no reset ticket was received."
        );
        return;
      }

      setTicket(resetTicket);
      setStep("password");

      // Remove the token from the browser URL after successful verification.
      navigate(location.pathname, { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "That code is invalid or expired. Request a new reset link."
      );
    } finally {
      setLoading(false);
    }
  }

  // Submit the new password using the reset ticket.
  async function handleReset(event) {
    event.preventDefault();

    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password.length > 72) {
      setError("Password must not exceed 72 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    if (!ticket) {
      setError(
        "Your password reset session is invalid. Please request a new reset link."
      );
      return;
    }

    setLoading(true);

    try {
      await resetPassword({
        email,
        resetTicket: ticket,
        newPassword: password,
      });

      setStep("complete");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "We could not update your password. Request a new reset link and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="password-reset-page">
      <section
        className="password-reset-card"
        aria-labelledby="reset-title"
      >
        <div className="password-reset-icon">
          <KeyRound size={25} aria-hidden="true" />
        </div>

        <p className="password-reset-eyebrow">
          SECURE PASSWORD RESET
        </p>

        {/* STEP 1: OTP VERIFICATION */}
        {step === "otp" && (
          <>
            <h1 id="reset-title">Verify your email</h1>

            <p className="password-reset-intro">
              Enter the six-digit code sent to{" "}
              <strong>{email}</strong>. The code expires in 15 minutes.
            </p>

            <form
              className="password-reset-form"
              onSubmit={handleVerify}
            >
              {error && (
                <div
                  className="password-reset-notice is-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <label htmlFor="reset-otp">
                Verification code
              </label>

              <input
                id="reset-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(event) =>
                  setOtp(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6)
                  )
                }
                required
                disabled={loading}
              />

              <button
                type="submit"
                className="password-reset-submit"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying…" : "Verify code"}
              </button>
            </form>
          </>
        )}

        {/* STEP 2: NEW PASSWORD */}
        {step === "password" && (
          <>
            <h1 id="reset-title">Create a new password</h1>

            <p className="password-reset-intro">
              Choose a password with at least 8 characters for your
              account.
            </p>

            <form
              className="password-reset-form"
              onSubmit={handleReset}
            >
              {error && (
                <div
                  className="password-reset-notice is-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <label htmlFor="new-password">
                New password
              </label>

              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                disabled={loading}
              />

              <label htmlFor="confirm-new-password">
                Confirm new password
              </label>

              <input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                required
                disabled={loading}
              />

              <button
                type="submit"
                className="password-reset-submit"
                disabled={
                  loading ||
                  !password ||
                  !confirmPassword
                }
              >
                {loading
                  ? "Updating password…"
                  : "Save new password"}
              </button>
            </form>
          </>
        )}

        {/* STEP 3: SUCCESS */}
        {step === "complete" && (
          <>
            <h1 id="reset-title">Password updated</h1>

            <div
              className="password-reset-notice is-success"
              role="status"
            >
              <ShieldCheck size={20} aria-hidden="true" />

              <span>
                Your password has been changed. You can now sign
                in with it.
              </span>
            </div>

            <Link
              className="password-reset-submit password-reset-link-button"
              to="/login"
            >
              Go to sign in
            </Link>
          </>
        )}

        {/* INVALID / EXPIRED LINK */}
        {step === "invalid" && (
          <>
            <h1 id="reset-title">Reset link needed</h1>

            <p className="password-reset-intro">
              Open the reset link from your email to continue,
              or request a new one.
            </p>

            <Link
              className="password-reset-submit password-reset-link-button"
              to="/forgot-password"
            >
              Request a reset link
            </Link>
          </>
        )}

        {/* BACK TO LOGIN */}
        {step !== "complete" && (
          <Link
            className="password-reset-back"
            to="/login"
          >
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        )}
      </section>
    </main>
  );
}
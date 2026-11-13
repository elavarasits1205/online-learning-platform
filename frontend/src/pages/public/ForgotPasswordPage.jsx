import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { requestPasswordReset } from "../../service/Authapi";
import "./PasswordResetPage.scss";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState("email");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await requestPasswordReset(email.trim());
      setDeliveryMode(response.data?.deliveryMode || "email");
      setSent(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "We could not send a reset email right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="password-reset-page">
      <section className="password-reset-card" aria-labelledby="forgot-title">
        <div className="password-reset-icon"><Mail size={25} aria-hidden="true" /></div>
        <p className="password-reset-eyebrow">ACCOUNT RECOVERY</p>
        <h1 id="forgot-title">Forgot your password?</h1>
        <p className="password-reset-intro">
          Enter the email address linked to your Learnova account. We’ll send you a secure reset link and a one-time code.
        </p>

        {sent ? (
          <div className="password-reset-notice is-success" role="status">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>
              If an account exists for that email, a password reset link and code have been sent.
              {deliveryMode === "development" && " Local development mode is active: check the backend terminal for the reset link and OTP."}
            </span>
          </div>
        ) : (
          <form className="password-reset-form" onSubmit={handleSubmit}>
            {error && <div className="password-reset-notice is-error" role="alert">{error}</div>}
            <label htmlFor="reset-email">Email address</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
              disabled={loading}
            />
            <button type="submit" className="password-reset-submit" disabled={loading}>
              {loading ? "Sending link…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link className="password-reset-back" to="/login"><ArrowLeft size={16} /> Back to sign in</Link>
      </section>
    </main>
  );
}

import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/gqApi";
import { extractErrorMessage } from "../api/client";
import { saveSession } from "../auth/session";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      saveSession(result, email);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__hero">
        <div className="login-page__brand">
          <span className="login-page__brand-badge">GQ</span>
          <div>
            <div className="login-page__brand-title">
              Gateway <em>Quest</em>
            </div>
            {/* <div className="login-page__brand-subtitle">Channel Manager Integration Platform</div> */}
          </div>
        </div>

        <div className="login-page__pitch">
          <span className="login-page__kicker">Enterprise Channel Management</span>
          <h1 className="login-page__headline">
            One gateway between your PMS and every <em>channel</em>.
          </h1>
          <p className="login-page__subheadline">
            Connect once. Distribute everywhere.
          </p>
        </div>
      </div>

      <div className="login-page__form-panel">
        <form className="login-page__form" onSubmit={handleSubmit}>
          <h2 className="login-page__form-title">Sign in to GQ</h2>
          <p className="login-page__form-subtitle">Use your QUEST workspace credentials.</p>

          <label className="login-page__label" htmlFor="login-email">
            Work email
          </label>
          <input
            id="login-email"
            type="email"
            className="login-page__input"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label className="login-page__label" htmlFor="login-password">
            Password
          </label>
          <div className="login-page__password-wrap">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              className="login-page__input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-page__toggle-visibility"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && <p className="login-page__error">{error}</p>}

          <button type="submit" className="login-page__submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

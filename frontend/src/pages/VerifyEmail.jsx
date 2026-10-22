import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { verifyEmailRequest } from '../services/authService.js';

/**
 * Página de verificação de e-mail.
 * Valida o token recebido na URL e informa o resultado ao usuário.
 *
 * @returns {JSX.Element} Tela de status da verificação de e-mail.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('loading');

  const token = new URLSearchParams(location.search).get('token') || '';

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }

      try {
        await verifyEmailRequest(token);
        if (cancelled) return;
        setStatus('success');
        setTimeout(() => navigate('/login'), 3000);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
      }
    };

    run();
    return () => { cancelled = true; };
  }, [token, navigate]);

  return (
    <div className="auth-page auth-page--compact">
      <div className="card auth-card auth-card--compact auth-card--single">
        <div className="auth-form auth-form--compact">
          <div>
            <h2>Email verification</h2>
            {status === 'loading' && <p>Verifying your email, please wait...</p>}
            {status === 'success' && <p>Your email was verified. Redirecting to sign in...</p>}
            {status === 'error' && (
              <>
                <p>Unable to verify the email. The token may be invalid or expired.</p>
                <p className="muted">You can request a new verification or try signing in.</p>
              </>
            )}
            {status === 'invalid' && <p>Verification token missing from the link.</p>}
          </div>

          <div style={{ marginTop: 16 }}>
            <Link className="auth-link" to="/login">Go to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

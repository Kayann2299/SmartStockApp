import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

/**
 * Página de autenticação do usuário.
 * Permite que o usuário faça login na aplicação.
 *
 * @returns {JSX.Element} Formulário de login.
 */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  /**
   * Realiza a autenticação do usuário e redireciona para o dashboard em caso de sucesso.
   *
   * @param {React.FormEvent} e Evento de submissão do formulário.
   * @returns {Promise<void>} Promessa resolvida após tentar autenticar o usuário.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in.');
    }
  };

  return (
    <div className="auth-page auth-page--compact">
      <div className="card auth-card auth-card--compact">
        <section className="auth-hero auth-hero--compact">
          <div>
            <div className="sidebar-brand-mark" style={{ marginBottom: '1rem' }}>S</div>
            <div className="sidebar-brand-title" style={{ marginBottom: '1rem' }}>SmartStock</div>
            <h1>Sign in to manage your products and operations.</h1>
            <p>Track product stock, sales, reservations, and supplier workflows from a single workspace.</p>
          </div>
          <div className="auth-hero-grid auth-hero-grid--compact">
            <div className="auth-hero-metric"><strong>Stock</strong><span>Real-time control</span></div>
            <div className="auth-hero-metric"><strong>AI Insights</strong><span>Insights and forecasts</span></div>
            <div className="auth-hero-metric"><strong>Smart Dashboard</strong><span>Fast and intuitive</span></div>
          </div>
        </section>

        <form className="auth-form auth-form--compact" onSubmit={handleSubmit}>
          <div>
            <h2>Welcome back</h2>
            <p>Use your account to continue.</p>
          </div>
          <div className="auth-field-grid">
            <div>
              <label className="field-label">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
            </div>
          </div>
          {error ? <p className="chip chip-danger">{error}</p> : null}
          <button type="submit">Sign in</button>
          <div className="auth-footer">
            <Link className="auth-link" to="/forgot-password">Forgot password?</Link>
            <span className="muted">No account yet? <Link className="auth-link" to="/signup">Create one</Link></span>
          </div>
        </form>
      </div>
    </div>
  );
}

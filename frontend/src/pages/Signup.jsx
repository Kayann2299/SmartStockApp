import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerRequest } from '../services/authService.js';

/**
 * Página de criação de conta.
 * Permite registrar um novo usuário na aplicação.
 *
 * @returns {JSX.Element} Formulário de cadastro.
 */
export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  /**
   * Envia o cadastro do usuário para o backend e redireciona para o login.
   *
   * @param {React.FormEvent} e Evento de submissão do formulário.
   * @returns {Promise<void>} Promessa resolvida após o cadastro.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await registerRequest(form);
      setMessage('Account created successfully.');
      navigate('/login');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Unable to register.');
    }
  };

  return (
    <div className="auth-page auth-page--compact">
      <div className="card auth-card auth-card--compact">
        <section className="auth-hero auth-hero--compact">
          <div>
            <div className="sidebar-brand-mark" style={{ marginBottom: '1rem' }}>S</div>
            <h1>Create your account and start organizing the business.</h1>
            <p>A cleaner workspace for sales, reservations, and product tracking.</p>
          </div>
        </section>

        <form className="auth-form auth-form--compact" onSubmit={handleSubmit}>
          <div>
            <h2>Create account</h2>
            <p>Register to access the system.</p>
          </div>
          <div className="auth-field-grid">
            <div>
              <label className="field-label">Name</label>
              <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="field-label">Email</label>
              <input value={form.email} onChange={(e) => update('email', e.target.value)} type="email" placeholder="you@example.com" />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input value={form.password} onChange={(e) => update('password', e.target.value)} type="password" placeholder="••••••••" />
            </div>
          </div>
          {message ? <p className="muted">{message}</p> : null}
          <button type="submit">Register</button>
          <div className="auth-footer">
            <span className="muted">Already have an account? <Link className="auth-link" to="/login">Sign in</Link></span>
          </div>
        </form>
      </div>
    </div>
  );
}

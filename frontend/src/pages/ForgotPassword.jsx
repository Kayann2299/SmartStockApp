
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordRequest } from '../services/authService.js';

/**
 * Página de recuperação de senha.
 * Permite solicitar o envio de um link de redefinição para o e-mail cadastrado.
 *
 * @returns {JSX.Element} Formulário de recuperação de senha.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');

  /**
   * Envia a solicitação de recuperação de senha para o backend.
   *
   * @param {React.FormEvent} e Evento de submissão do formulário.
   * @returns {Promise<void>} Promessa resolvida após o envio da solicitação.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await forgotPasswordRequest({ email });
      setStatus(res.data?.message || 'If the email exists, a reset link has been sent.');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Unable to process the request.');
    }
  };

  return (
    <div className="auth-page auth-page--compact">
      <div className="card auth-card auth-card--compact auth-card--single">
        <form className="auth-form auth-form--compact" onSubmit={handleSubmit}>
          <div>
            <h2>Forgot password</h2>
            <p>Enter the email linked to your account. If it exists, we will send a reset link.</p>
          </div>
          <div>
            <label className="field-label">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" />
          </div>
          {status ? <p className="muted">{status}</p> : null}
          <button type="submit">Send reset email</button>
          <div className="auth-footer">
            <Link className="auth-link" to="/login">Back to sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}


import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resetPasswordRequest } from '../services/authService.js';

/**
 * Página de redefinição de senha.
 * Recebe um token de recuperação e permite definir uma nova senha para o usuário.
 *
 * @returns {JSX.Element} Formulário de redefinição de senha.
 */
export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');

  /**
   * Envia a nova senha para o backend após validar a confirmação.
   *
   * @param {React.FormEvent} e Evento de submissão do formulário.
   * @returns {Promise<void>} Promessa resolvida após o processo de redefinição.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }

    try {
      const res = await resetPasswordRequest({ token, password });
      setStatus(res.data?.message || 'Password updated successfully.');
      navigate('/login');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Unable to reset the password.');
    }
  };

  return (
    <div className="auth-page auth-page--compact">
      <div className="card auth-card auth-card--compact auth-card--single">
        <form className="auth-form auth-form--compact" onSubmit={handleSubmit}>
          <div>
            <h2>Reset password</h2>
            <p>Create a new password for your account.</p>
          </div>
          <div className="auth-field-grid">
            <div>
              <label className="field-label">New password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
            </div>
            <div>
              <label className="field-label">Confirm password</label>
              <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="••••••••" />
            </div>
          </div>
          {status ? <p className="muted">{status}</p> : null}
          <button type="submit">Update password</button>
          <div className="auth-footer">
            <Link className="auth-link" to="/login">Back to sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useContext } from 'react';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { formatDate } from '../utils/formatters.js';

/**
 * Selo colorido com o status de uma reserva (pending, ready, contacted, completed, cancelled).
 *
 * @param {Object} props Propriedades do componente.
 * @param {string} [props.status] Status da reserva.
 * @returns {JSX.Element} Selo estilizado com o status normalizado.
 */
function StatusChip({ status }) {
  const normalized = String(status || 'pending').toLowerCase();
  const map = {
    pending: 'chip-warning',
    ready: 'chip-success',
    contacted: 'chip-primary',
    completed: 'chip-neutral',
    cancelled: 'chip-danger'
  };
  return <span className={`chip ${map[normalized] || 'chip-neutral'}`}>{normalized}</span>;
}

/**
 * Tabela de reservas de clientes, com status, itens, ações de contato e conclusão.
 *
 * @param {Object} props Propriedades do componente.
 * @param {Array<Object>} [props.reservations=[]] Lista de reservas a exibir.
 * @param {(reservation: Object, status: string) => void} [props.onChangeStatus] Callback para alterar o status de uma reserva.
 * @param {(reservation: Object) => void} [props.onViewDetails] Callback para abrir os detalhes de uma reserva.
 * @param {(reservation: Object) => void} [props.onCompleteReservation] Callback para concluir uma reserva (convertê-la em venda).
 * @param {(reservation: Object) => void} [props.onMarkReady] Callback para marcar uma reserva como pronta/contatada.
 * @returns {JSX.Element} Tabela de reservas renderizada.
 */
export default function ReservationList({ reservations = [], onChangeStatus, onViewDetails, onCompleteReservation, onMarkReady }) {
  const { settings } = useContext(SettingsContext);

  return (
    <div className="card table-card">
      <table className="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Status</th>
            <th>Items</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reservations.length === 0 ? (
            <tr>
              <td colSpan="5">
                <div className="empty-state" style={{ margin: '1rem 0' }}>No reservations to show.</div>
              </td>
            </tr>
          ) : (
            reservations.map((reservation) => {
              const normalized = String(reservation.status || 'pending').toLowerCase();
              return (
                <tr key={reservation.id}>
                  <td>
                    <strong>{reservation.customer_name || 'Customer'}</strong>
                    <div className="muted" style={{ fontSize: '.88rem' }}>
                      {reservation.customer_email || reservation.customer_phone || '—'}
                    </div>
                    {reservation.description ? (
                      <div className="muted" style={{ fontSize: '.82rem', marginTop: '.25rem' }}>{reservation.description}</div>
                    ) : null}
                  </td>
                  <td><StatusChip status={reservation.status} /></td>
                  <td>{Number(reservation.items_count || 0)}</td>
                  <td>{formatDate(reservation.created_at, settings.timezone, settings.dateFormat)}</td>
                  <td>
                    <div className="row-actions">
                      {onViewDetails ? (
                        <button type="button" className="btn-secondary" onClick={() => onViewDetails(reservation)}>Details</button>
                      ) : null}
                      {onMarkReady && normalized === 'ready' ? (
                        <button type="button" onClick={() => onMarkReady(reservation)}>Contact Client</button>
                      ) : null}
                      {onCompleteReservation && normalized === 'contacted' ? (
                        <button type="button" onClick={() => onCompleteReservation(reservation)}>Complete & transfer</button>
                      ) : null}
                      {onChangeStatus ? (
                        <select value={reservation.status} onChange={(e) => onChangeStatus(reservation.id, e.target.value)} style={{ width: 'auto' }}>
                          <option value="pending">pending</option>
                          <option value="contacted">contacted</option>
                          <option value="completed">completed</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}


import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Gráfico de linha com a tendência de vendas ao longo do tempo.
 *
 * @param {Object} props Propriedades do componente.
 * @param {Array<{date: string, total: number}>} [props.data=[]] Série temporal de vendas (data e total).
 * @returns {JSX.Element} Cartão com o gráfico de tendência de vendas.
 */
export default function SalesChart({ data = [] }) {
  return (
    <div className="card chart-wrapper">
      <h3 className="chart-title">Sales trend</h3>
      <p className="chart-subtitle">A quick view of recent performance.</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="total" stroke="currentColor" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

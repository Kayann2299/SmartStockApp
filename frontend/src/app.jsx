import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Layout from './layouts/Layout.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import SmartOverview from './pages/SmartOverview.jsx';
import Products from './pages/Products.jsx';
import Sales from './pages/Sales.jsx';
import SalesHistory from './pages/SalesHistory.jsx';
import Reports from './pages/Reports.jsx';
import Reservations from './pages/Reservations.jsx';
import Settings from './pages/Settings.jsx';
import Suppliers from './pages/Suppliers.jsx';
import SupplierOrders from './pages/SupplierOrders.jsx';
import Insights from './pages/Insights.jsx';
import Customers from './pages/Customers.jsx';

/**
 * Wrapper de rota que exige autenticação: mostra um indicador de carregamento enquanto a
 * sessão é resolvida e redireciona para `/login` se não houver usuário autenticado.
 *
 * @param {Object} props Propriedades do componente.
 * @param {import('react').ReactNode} props.children Conteúdo a ser exibido quando o usuário está autenticado.
 * @returns {JSX.Element} Conteúdo protegido, tela de carregamento, ou redirecionamento para login.
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-center">Loading...</div>;
  return user ? children : <Navigate to="/login" replace />;
};

/**
 * Componente raiz da aplicação: define o roteador e todas as rotas (públicas e protegidas).
 *
 * @returns {JSX.Element} Árvore de rotas da aplicação.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/" element={<Navigate to="/SmartOverview" replace />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/SmartOverview" element={<SmartOverview />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/sales-history" element={<SalesHistory />} />
                  <Route path="/SalesHistory" element={<Navigate to="/sales-history" replace />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports/:id" element={<Reports />} />
                  <Route path="/reservations" element={<Reservations />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/supplier-orders" element={<SupplierOrders />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/insights" element={<Insights />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/preferences" element={<Navigate to="/settings" replace />} />
                  <Route path="*" element={<Navigate to="/SmartOverview" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}


import Navbar from '../components/Navbar.jsx';
import Sidebar from '../components/Sidebar.jsx';

/**
 * Layout principal da aplicação (área autenticada): combina o menu lateral, a barra de
 * navegação superior e a área de conteúdo da página atual.
 *
 * @param {Object} props Propriedades do componente.
 * @param {import('react').ReactNode} props.children Conteúdo da página a ser renderizado na área principal.
 * @returns {JSX.Element} Estrutura de layout com sidebar, navbar e conteúdo.
 */
export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="content-shell">
        <Navbar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

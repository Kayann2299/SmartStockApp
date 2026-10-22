import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal genérico renderizado via portal, usado para exibir detalhes de um registro
 * (produto, venda, reserva, etc.) sobre o conteúdo da página.
 *
 * @param {Object} props Propriedades do componente.
 * @param {string} props.title Título exibido no cabeçalho do modal.
 * @param {string} [props.subtitle] Subtítulo opcional exibido abaixo do título.
 * @param {import('react').ReactNode} props.children Conteúdo do corpo do modal.
 * @param {() => void} props.onClose Callback chamado ao fechar o modal (clique fora, tecla Esc ou botão de fechar).
 * @returns {JSX.Element} Modal renderizado via `createPortal` fora da árvore normal do DOM.
 */
export default function DetailsModal({ title, subtitle, children, onClose }) {
  const elRef = useRef(null);
  const onCloseRef = useRef(onClose);

  if (!elRef.current) elRef.current = document.createElement('div');

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = elRef.current;
    document.body.appendChild(el);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };

    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  const modal = (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle ? <p className="inline-help">{subtitle}</p> : null}
          </div>
          <button className="close-btn" type="button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );

  return createPortal(modal, elRef.current);
}

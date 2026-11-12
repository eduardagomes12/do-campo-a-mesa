import { Link } from 'react-router-dom';
import { useNotificacoes } from '../hooks/useNotificacoes.js';

export default function Notificacoes() {
  const { notificacoes, remover } = useNotificacoes();

  if (notificacoes.length === 0) return null;

  return (
    <div
      className="position-fixed end-0 p-3"
      style={{
        top: '70px',
        width: 'min(380px, 100%)',
        zIndex: 1100
      }}
      aria-live="polite"
      aria-label="Notificações"
    >
      {notificacoes.map((notificacao) => (
        <div
          key={notificacao.id}
          className="alert alert-success shadow d-flex justify-content-between align-items-start gap-3 mb-2"
          role="status"
        >
          <div>
            <p className="mb-2">
              {notificacao.mensagem}
            </p>

            {notificacao.destino && (
              <Link
                to={notificacao.destino}
                className="alert-link"
                onClick={() => remover(notificacao.id)}
              >
                Ver detalhes
              </Link>
            )}
          </div>

          <button
            type="button"
            className="btn-close"
            aria-label="Fechar notificação"
            onClick={() => remover(notificacao.id)}
          />
        </div>
      ))}
    </div>
  );
}

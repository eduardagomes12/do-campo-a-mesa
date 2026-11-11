import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';

// Formatar o tempo que falta até ao fim do leilão
function formatarTempoRestante(terminaEm, agora) {
  const fim = new Date(terminaEm).getTime();

  if (!Number.isFinite(fim)) return 'Indisponível';

  const segundos = Math.max(0, Math.floor((fim - agora) / 1000));

  if (segundos === 0) return 'Prazo terminado';

  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segundosRestantes = segundos % 60;

  const doisDigitos = (n) => String(n).padStart(2, '0');

  return (
    `${dias > 0 ? `${dias}d ` : ''}` +
    `${doisDigitos(horas)}:` +
    `${doisDigitos(minutos)}:` +
    `${doisDigitos(segundosRestantes)}`
  );
}

export default function Leiloes() {
  const {
    dados,
    erro,
    aCarregar
  } = useApi('/auctions?estado=ativo');

  const [agora, setAgora] = useState(Date.now());

  // Atualizar a contagem decrescente a cada segundo
  useEffect(() => {
    const intervalo = setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  const leiloes = Array.isArray(dados) ? dados : [];

  return (
    <>
      <h1 className="mb-4">Leilões</h1>

      {aCarregar && (
        <p role="status">A carregar leilões...</p>
      )}

      {erro && (
        <div className="alert alert-danger" role="alert">
          Não foi possível carregar os leilões: {erro}
        </div>
      )}

      {!aCarregar && !erro && leiloes.length === 0 && (
        <div className="alert alert-info">
          Não existem leilões ativos neste momento.
        </div>
      )}

      <section className="row g-3" aria-label="Leilões disponíveis">
        {leiloes.map((leilao) => {
          const terminou =
            new Date(leilao.terminaEm).getTime() <= agora;

          const nomeProdutor =
            leilao.produtor?.produtor?.nomeExploracao ||
            leilao.produtor?.nome ||
            'Produtor';

          const valorAtual =
            leilao.licitacaoAtual?.valor ??
            leilao.precoBase;

          return (
            <div
              className="col-12 col-md-6 col-xl-4"
              key={leilao._id}
            >
              <article className="card h-100 shadow-sm">
                <div className="card-body d-flex flex-column">

                  <span
                    className={`badge align-self-start mb-3 ${
                      terminou
                        ? 'text-bg-secondary'
                        : 'text-bg-success'
                    }`}
                  >
                    {terminou ? 'Prazo terminado' : 'Em direto'}
                  </span>

                  <h2 className="h5 card-title">
                    {leilao.lote}
                  </h2>

                  <p className="texto-secundario mb-2">
                    {nomeProdutor}
                  </p>

                  {leilao.quantidade && (
                    <p className="mb-2">
                      <strong>Quantidade:</strong>{' '}
                      {leilao.quantidade}
                    </p>
                  )}

                  <p className="mb-2">
                    <strong>Licitação atual:</strong>{' '}
                    {Number(valorAtual).toFixed(2)} €
                  </p>

                  <p className="mb-3">
                    <strong>Tempo restante:</strong>{' '}
                    <span>
                      {formatarTempoRestante(
                        leilao.terminaEm,
                        agora
                      )}
                    </span>
                  </p>

                  <Link
                    to={`/leiloes/${leilao._id}`}
                    className="btn btn-success mt-auto"
                  >
                    Ver sala do leilão
                  </Link>

                </div>
              </article>
            </div>
          );
        })}
      </section>
    </>
  );
}

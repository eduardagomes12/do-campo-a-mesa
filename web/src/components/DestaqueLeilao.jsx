import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

// Formatar o tempo que falta para terminar
function formatarTempo(terminaEm, agora) {
  const fim = new Date(terminaEm).getTime();
  const segundos = Math.max(
    0,
    Math.floor((fim - agora) / 1000)
  );

  if (segundos === 0) {
    return 'Prazo terminado';
  }

  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segundosRestantes = segundos % 60;

  const doisDigitos = (numero) =>
    String(numero).padStart(2, '0');

  return (
    `${dias > 0 ? `${dias}d ` : ''}` +
    `${doisDigitos(horas)}:` +
    `${doisDigitos(minutos)}:` +
    `${doisDigitos(segundosRestantes)}`
  );
}

export default function DestaqueLeilao() {
  const [leiloes, setLeiloes] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    let ativo = true;

    async function carregarLeiloes() {
      try {
        const dados = await api('/auctions?estado=ativo');

        if (!ativo) return;

        setLeiloes(Array.isArray(dados) ? dados : []);
        setErro('');
      } catch {
        if (!ativo) return;

        setErro('Não foi possível consultar os leilões.');
      } finally {
        if (ativo) {
          setACarregar(false);
        }
      }
    }

    carregarLeiloes();

    // Atualizar os dados de 30 em 30 segundos
    const intervalo = setInterval(
      carregarLeiloes,
      30000
    );

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  // Atualizar a contagem decrescente
  useEffect(() => {
    const intervalo = setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  // Considerar em direto apenas leilões
  // que já começaram e ainda não terminaram
  const leilao = leiloes
    .filter((item) => {
      const inicio = new Date(item.iniciaEm).getTime();
      const fim = new Date(item.terminaEm).getTime();

      return (
        item.estado === 'ativo' &&
        Number.isFinite(inicio) &&
        Number.isFinite(fim) &&
        inicio <= agora &&
        fim > agora
      );
    })
    .sort((a, b) =>
      new Date(a.terminaEm) - new Date(b.terminaEm)
    )[0];

  const valorAtual = leilao
    ? leilao.licitacaoAtual?.valor ?? leilao.precoBase
    : null;

  const nomeProdutor = leilao
    ? (
        leilao.produtor?.produtor?.nomeExploracao ||
        leilao.produtor?.nome ||
        'Produtor'
      )
    : '';

  return (
    <section
      className="mb-4"
      aria-label="Destaque dos leilões"
    >
      <div className="card shadow-sm">
        <div className="card-body p-3 p-md-4">

          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className="badge text-bg-success">
              LEILÕES
            </span>

            <span className="texto-secundario small">
              Produtos locais do Alto Minho
            </span>
          </div>

          {aCarregar ? (
            <p role="status" className="mb-0">
              A consultar leilões...
            </p>
          ) : leilao ? (
            <div className="row align-items-center g-3">

              <div className="col-12 col-md-7">
                <span className="badge text-bg-danger mb-2">
                  Em direto
                </span>

                <h2 className="h4 mb-2">
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

                <p className="mb-0">
                  <strong>Licitação atual:</strong>{' '}
                  {Number(valorAtual).toFixed(2)} €
                </p>
              </div>

              <div className="col-12 col-md-5 text-md-end">
                <p className="texto-secundario small mb-1">
                  Tempo restante
                </p>

                <p
                  className="h3 fw-bold mb-3"
                  role="timer"
                  aria-live="off"
                >
                  {formatarTempo(leilao.terminaEm, agora)}
                </p>

                <Link
                  to={`/leiloes/${leilao._id}`}
                  className="btn btn-success"
                >
                  Entrar na sala
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="h5">
                Descubra os leilões dos produtores
              </h2>

              <p className="texto-secundario">
                {erro ||
                  'Não existem leilões em direto neste momento.'}
              </p>

              <Link
                to="/leiloes"
                className="btn btn-outline-success"
              >
                Ver leilões
              </Link>
            </div>
          )}

        </div>
      </div>
    </section>
  );
}

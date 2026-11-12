// Comprador: acompanhamento das encomendas reais
import {
  useCallback,
  useEffect,
  useState
} from 'react';

import { useAuth } from '../context/AuthContext.jsx';
import { useEventoSocket } from '../context/SocketContext.jsx';
import { api } from '../api/client.js';
import EstadoEncomenda from '../components/EstadoEncomenda.jsx';
import AvaliarEncomenda from '../components/AvaliarEncomenda.jsx';

const moeda = (valor) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(valor) || 0);

const dataPT = (valor) =>
  valor
    ? new Date(valor).toLocaleString('pt-PT', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    : '—';

export default function Encomendas() {
  const { token } = useAuth();

  const [encomendas, setEncomendas] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [erroAvaliacoes, setErroAvaliacoes] = useState('');
  const [versao, setVersao] = useState(0);

  // Carregar encomendas e avaliações reais.
  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setACarregar(true);
      setErro('');
      setErroAvaliacoes('');

      const [resultadoEncomendas, resultadoAvaliacoes] =
        await Promise.allSettled([
          api('/orders', { token }),
          api('/reviews/minhas', { token })
        ]);

      if (!ativo) return;

      if (resultadoEncomendas.status === 'fulfilled') {
        setEncomendas(
          Array.isArray(resultadoEncomendas.value)
            ? resultadoEncomendas.value
            : []
        );
      } else {
        setEncomendas([]);
        setErro(resultadoEncomendas.reason.message);
      }

      if (resultadoAvaliacoes.status === 'fulfilled') {
        setAvaliacoes(
          Array.isArray(resultadoAvaliacoes.value)
            ? resultadoAvaliacoes.value
            : []
        );
      } else {
        setAvaliacoes([]);
        setErroAvaliacoes(resultadoAvaliacoes.reason.message);
      }

      setACarregar(false);
    }

    if (token) {
      carregar();
    } else {
      setEncomendas([]);
      setAvaliacoes([]);
      setACarregar(false);
    }

    return () => {
      ativo = false;
    };
  }, [token, versao]);

  // Atualizar a encomenda quando o produtor muda o estado.
  const onAtualizada = useCallback((dados) => {
    setEncomendas((anteriores) =>
      anteriores.map((encomenda) =>
        String(encomenda._id) === String(dados.id)
          ? {
              ...encomenda,
              estado: dados.estado
            }
          : encomenda
      )
    );
  }, []);

  // O comprador ganhou um leilão:
  // carregar a nova encomenda sem atualizar a página.
  const onLeilaoGanho = useCallback(() => {
    setVersao((v) => v + 1);
  }, []);

  useEventoSocket('encomenda-atualizada', onAtualizada);
  useEventoSocket('leilao-ganho', onLeilaoGanho);

  // Guardar uma nova avaliação na interface imediatamente.
  const onAvaliacaoCriada = useCallback((nova) => {
    setAvaliacoes((anteriores) => [nova, ...anteriores]);
  }, []);

  return (
    <section>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <h1 className="mb-0">Encomendas</h1>

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setVersao((v) => v + 1)}
          disabled={aCarregar}
        >
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="alert alert-danger" role="alert">
          Não foi possível carregar as encomendas: {erro}
        </div>
      )}

      {erroAvaliacoes && (
        <div className="alert alert-warning" role="alert">
          Não foi possível consultar as avaliações:
          {' '}{erroAvaliacoes}
        </div>
      )}

      {aCarregar && (
        <p role="status">A carregar encomendas...</p>
      )}

      {!aCarregar && !erro && encomendas.length === 0 && (
        <div className="card p-4">
          <p className="mb-0">
            Ainda não tens encomendas.
          </p>
        </div>
      )}

      {!aCarregar && !erro && encomendas.map((encomenda) => {
        const linhas = encomenda.linhas || [];

        const total = encomenda.total ??
          linhas.reduce(
            (soma, linha) =>
              soma + linha.precoUnit * linha.quantidade,
            0
          );

        const avaliacoesEncomenda = avaliacoes.filter(
          (avaliacao) =>
            String(avaliacao.encomenda) ===
            String(encomenda._id)
        );

        return (
          <article
            key={encomenda._id}
            className="card p-3 p-md-4 mb-3"
          >
            <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">
                  Encomenda #{String(encomenda._id).slice(-8)}
                </h2>

                <p className="small text-body-secondary mb-0">
                  {dataPT(encomenda.createdAt)}
                </p>
              </div>

              <span className={
                `badge align-self-start ${
                  encomenda.origem === 'leilao'
                    ? 'text-bg-success'
                    : 'text-bg-secondary'
                }`
              }>
                {encomenda.origem === 'leilao'
                  ? 'Leilão'
                  : 'Loja'}
              </span>
            </div>

            <EstadoEncomenda estado={encomenda.estado} />

            <div className="mt-3">
              <h3 className="h6">Produtos / lotes</h3>

              <ul className="list-group list-group-flush">
                {linhas.map((linha, indice) => (
                  <li
                    key={`${linha.produto ?? 'lote'}-${indice}`}
                    className="list-group-item px-0 d-flex flex-wrap justify-content-between gap-2"
                  >
                    <div>
                      <strong>{linha.nome}</strong>

                      <div className="small text-body-secondary">
                        {linha.quantidade}{' '}
                        {linha.unidade || 'un.'}
                        {' × '}
                        {moeda(linha.precoUnit)}
                      </div>
                    </div>

                    <strong>
                      {moeda(
                        linha.quantidade * linha.precoUnit
                      )}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
              <strong>Total</strong>
              <strong className="fs-5 text-success">
                {moeda(total)}
              </strong>
            </div>

            <p className="small text-body-secondary mt-2 mb-0">
              Entrega:{' '}
              {encomenda.entrega?.tipo === 'entrega'
                ? 'Entrega na morada'
                : 'Levantamento'}
            </p>

            {/* Passo 7: avaliar apenas encomendas entregues */}
            {encomenda.estado === 'entregue' &&
              !erroAvaliacoes && (
                <AvaliarEncomenda
                  encomenda={encomenda}
                  avaliacoes={avaliacoesEncomenda}
                  onAvaliacaoCriada={onAvaliacaoCriada}
                />
              )}
          </article>
        );
      })}
    </section>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

const euro = (valor) =>
  Number(valor || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

const formatarData = (data) =>
  data
    ? new Date(data).toLocaleString('pt-PT', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    : '—';

const ESTADOS = {
  agendado: {
    texto: 'Agendado',
    classe: 'text-bg-secondary'
  },
  ativo: {
    texto: 'Em direto',
    classe: 'text-bg-success'
  },
  terminado: {
    texto: 'Terminado',
    classe: 'text-bg-dark'
  }
};

export default function MeusLeiloes() {
  const { token } = useAuth();

  const [leiloes, setLeiloes] = useState([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [aAtualizar, setAAtualizar] = useState(false);

  const carregarLeiloes = useCallback(async () => {
    if (!token) return;

    setAAtualizar(true);

    try {
      const dados = await api('/auctions/me', { token });

      setLeiloes(Array.isArray(dados) ? dados : []);
      setErro('');
    } catch (err) {
      setErro(
        err.message || 'Não foi possível carregar os leilões.'
      );
    } finally {
      setACarregar(false);
      setAAtualizar(false);
    }
  }, [token]);

  // Carregar e atualizar os dados a cada 15 segundos.
  useEffect(() => {
    carregarLeiloes();

    const intervalo = setInterval(carregarLeiloes, 15000);

    return () => clearInterval(intervalo);
  }, [carregarLeiloes]);

  const ativos = leiloes.filter(
    (leilao) => leilao.estado === 'ativo'
  ).length;

  const agendados = leiloes.filter(
    (leilao) => leilao.estado === 'agendado'
  ).length;

  const terminados = leiloes.filter(
    (leilao) => leilao.estado === 'terminado'
  ).length;

  return (
    <section className="mb-5" aria-labelledby="titulo-meus-leiloes">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2 id="titulo-meus-leiloes" className="h4 mb-1">
            Os meus leilões
          </h2>

          <p className="texto-secundario small mb-0">
            Consulta e acompanha os leilões da tua exploração.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-success btn-sm"
          onClick={carregarLeiloes}
          disabled={aAtualizar}
        >
          {aAtualizar ? 'A atualizar...' : 'Atualizar'}
        </button>
      </div>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {aCarregar ? (
        <p role="status">A carregar leilões...</p>
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <p className="texto-secundario mb-1">
                    Leilões ativos
                  </p>
                  <strong className="fs-3">{ativos}</strong>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <p className="texto-secundario mb-1">
                    Agendados
                  </p>
                  <strong className="fs-3">{agendados}</strong>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="card h-100">
                <div className="card-body">
                  <p className="texto-secundario mb-1">
                    Terminados
                  </p>
                  <strong className="fs-3">{terminados}</strong>
                </div>
              </div>
            </div>
          </div>

          {leiloes.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <p>Ainda não criaste nenhum leilão.</p>

                <Link
                  to="/produtor/leiloes/novo"
                  className="btn btn-success"
                >
                  Criar primeiro leilão
                </Link>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped align-middle">
                <thead>
                  <tr>
                    <th scope="col">Lote</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Valor atual</th>
                    <th scope="col">Licitações</th>
                    <th scope="col">Início</th>
                    <th scope="col">Fim</th>
                    <th scope="col">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {leiloes.map((leilao) => {
                    const estado =
                      ESTADOS[leilao.estado] ||
                      ESTADOS.agendado;

                    const valorAtual =
                      leilao.licitacaoAtual?.valor ??
                      leilao.precoBase;

                    return (
                      <tr key={leilao._id}>
                        <td>
                          <strong>{leilao.lote}</strong>

                          {leilao.produto?.nome && (
                            <div className="small texto-secundario">
                              {leilao.produto.nome}
                            </div>
                          )}

                          {leilao.estado === 'terminado' && (
                            <div className="small mt-1">
                              {leilao.licitacaoAtual?.comprador
                                ? `Vencedor: ${
                                    leilao.licitacaoAtual.nome ||
                                    'Comprador'
                                  }`
                                : 'Sem licitações'}
                            </div>
                          )}
                        </td>

                        <td>
                          <span
                            className={`badge ${estado.classe}`}
                          >
                            {estado.texto}
                          </span>
                        </td>

                        <td>{euro(valorAtual)}</td>

                        <td>{leilao.numLicitacoes || 0}</td>

                        <td>{formatarData(leilao.iniciaEm)}</td>

                        <td>{formatarData(leilao.terminaEm)}</td>

                        <td>
                          <Link
                            to={`/leiloes/${leilao._id}`}
                            className="btn btn-outline-success btn-sm"
                          >
                            Acompanhar
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

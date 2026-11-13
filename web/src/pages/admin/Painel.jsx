import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import { useSocket } from '../../context/SocketContext.jsx';
import ModeracaoProdutos from '../../components/ModeracaoProdutos.jsx';

const moeda = (valor) =>
  Number(valor || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function PainelAdmin() {
  const { token } = useAuth();
  const socket = useSocket();

  const [estatisticas, setEstatisticas] = useState(null);
  const [produtores, setProdutores] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [leiloes, setLeiloes] = useState([]);

  const [aCarregar, setACarregar] = useState(true);
  const [acaoEmCurso, setAcaoEmCurso] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Carregar os dados reais da API
  const carregarDados = useCallback(async () => {
    if (!token) {
      setACarregar(false);
      return;
    }

    setACarregar(true);
    setErro('');

    try {
      const [
        dadosEstatisticas,
        dadosProdutores,
        dadosAvaliacoes,
        dadosLeiloes
      ] = await Promise.all([
        api('/admin/estatisticas', { token }),
        api('/admin/produtores/pendentes', { token }),
        api('/admin/reviews/denunciadas', { token }),
        api('/auctions?estado=ativo')
      ]);

      setEstatisticas(dadosEstatisticas);

      setProdutores(
        Array.isArray(dadosProdutores) ? dadosProdutores : []
      );

      setAvaliacoes(
        Array.isArray(dadosAvaliacoes) ? dadosAvaliacoes : []
      );

      setLeiloes(
        Array.isArray(dadosLeiloes) ? dadosLeiloes : []
      );
    } catch (e) {
      setErro(e.message || 'Erro ao carregar o painel.');
    } finally {
      setACarregar(false);
    }
  }, [token]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);



  // Atualizar apenas os leilões e as estatísticas.
  // Evita recarregar produtores e avaliações a cada oferta.
  const atualizarLeiloes = useCallback(async () => {
    if (!token) return;

    try {
      const [dadosEstatisticas, dadosLeiloes] =
        await Promise.all([
          api('/admin/estatisticas', { token }),
          api('/auctions?estado=ativo')
        ]);

      setEstatisticas(dadosEstatisticas);

      setLeiloes(
        Array.isArray(dadosLeiloes) ? dadosLeiloes : []
      );
    } catch (e) {
      console.error(
        'Erro ao atualizar os leilões em tempo real:',
        e
      );
    }
  }, [token]);

  // Ouvir notificações de alterações nos leilões.
  useEffect(() => {
    if (!socket) return undefined;

    const aoAtualizar = () => {
      void atualizarLeiloes();
    };

    // Nova licitação, abertura ou encerramento.
    socket.on('leiloes-atualizados', aoAtualizar);

    // Recuperar informação após uma reconexão.
    socket.on('connect', aoAtualizar);

    return () => {
      socket.off('leiloes-atualizados', aoAtualizar);
      socket.off('connect', aoAtualizar);
    };
  }, [socket, atualizarLeiloes]);


  // Aprovar ou rejeitar um produtor
  async function validarProdutor(produtor, aprovado) {
    setErro('');
    setSucesso('');
    setAcaoEmCurso(`produtor-${produtor._id}`);

    try {
      await api(
        `/admin/produtores/${produtor._id}/validacao`,
        {
          metodo: 'PATCH',
          corpo: { aprovado },
          token
        }
      );

      await carregarDados();


      setSucesso(
        aprovado
          ? 'Produtor aprovado com sucesso.'
          : 'Produtor rejeitado com sucesso.'
      );
    } catch (e) {
      setErro(e.message || 'Erro ao validar produtor.');
    } finally {
      setAcaoEmCurso(null);
    }
  }

  // Mostrar ou ocultar uma avaliação
  async function moderarAvaliacao(avaliacao, visivel) {
    setErro('');
    setSucesso('');
    setAcaoEmCurso(`avaliacao-${avaliacao._id}`);

    try {
      await api(`/admin/reviews/${avaliacao._id}`, {
        metodo: 'PATCH',
        corpo: { visivel },
        token
      });

      await carregarDados();

      setSucesso(
        visivel
          ? 'Avaliação tornada pública.'
          : 'Avaliação ocultada com sucesso.'
      );
    } catch (e) {
      setErro(e.message || 'Erro ao moderar avaliação.');
    } finally {
      setAcaoEmCurso(null);
    }
  }

  if (!token) {
    return (
      <div className="alert alert-warning">
        É necessário iniciar sessão como administrador.
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-2">Administração</h1>

      <p className="texto-secundario mb-4">
        Gestão de produtores, avaliações e atividade da plataforma.
      </p>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="alert alert-success" role="status">
          {sucesso}
        </div>
      )}

      {aCarregar && (
        <p role="status">A carregar dados...</p>
      )}

      {!aCarregar && !erro && (
        <>
          {/* Estatísticas globais */}
          <section className="mb-5">
            <h2 className="h4 mb-3">
              Estatísticas globais
            </h2>

            <div className="row g-3">
              {[
                {
                  titulo: 'Utilizadores',
                  valor: estatisticas?.utilizadores ?? 0
                },
                {
                  titulo: 'Produtores',
                  valor: estatisticas?.produtores ?? 0
                },
                {
                  titulo: 'Encomendas de hoje',
                  valor: estatisticas?.encomendasHoje ?? 0
                },
                {
                  titulo: 'Leilões ativos',
                  valor: estatisticas?.leiloesAtivos ?? 0
                }
              ].map((indicador) => (
                <div
                  className="col-6 col-xl-3"
                  key={indicador.titulo}
                >
                  <div className="card h-100 shadow-sm">
                    <div className="card-body">
                      <p className="texto-secundario mb-2">
                        {indicador.titulo}
                      </p>

                      <p className="fs-2 fw-bold mb-0">
                        {indicador.valor}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Produtores por validar */}
          <section className="mb-5">
            <h2 className="h4 mb-3">
              Produtores pendentes
            </h2>

            {produtores.length === 0 ? (
              <div className="alert alert-info">
                Não existem produtores pendentes de validação.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Produtor</th>
                      <th scope="col">Localidade</th>
                      <th scope="col">Email</th>
                      <th scope="col">Ações</th>
                    </tr>
                  </thead>

                  <tbody>
                    {produtores.map((produtor) => (
                      <tr key={produtor._id}>
                        <td>
                          <strong>{produtor.nome}</strong>

                          <div className="small texto-secundario">
                            {produtor.produtor?.nomeExploracao}
                          </div>
                        </td>

                        <td>
                          {produtor.produtor?.localidade || '—'}
                        </td>

                        <td>{produtor.email}</td>

                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              onClick={() =>
                                validarProdutor(produtor, true)
                              }
                              disabled={acaoEmCurso !== null}
                            >
                              Aprovar
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                validarProdutor(produtor, false)
                              }
                              disabled={acaoEmCurso !== null}
                            >
                              Rejeitar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Avaliações denunciadas */}
          <section className="mb-5">
            <h2 className="h4 mb-3">
              Avaliações denunciadas
            </h2>

            {avaliacoes.length === 0 ? (
              <div className="alert alert-info">
                Não existem avaliações denunciadas.
              </div>
            ) : (
              <div className="d-grid gap-3">
                {avaliacoes.map((avaliacao) => (
                  <article
                    className="card"
                    key={avaliacao._id}
                  >
                    <div className="card-body">
                      <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
                        <div>
                          <h3 className="h6 mb-1">
                            Avaliação de{' '}
                            {avaliacao.autor?.nome ||
                              'Utilizador'}
                          </h3>

                          <p className="texto-secundario small mb-0">
                            Produtor:{' '}
                            {avaliacao.produtor?.produtor
                              ?.nomeExploracao ||
                              avaliacao.produtor?.nome ||
                              'Não identificado'}
                          </p>
                        </div>

                        <span className="badge text-bg-warning">
                          {avaliacao.denuncias} denúncia(s)
                        </span>
                      </div>

                      <p className="mb-2">
                        <strong>Classificação:</strong>{' '}
                        {avaliacao.classificacao} / 5
                      </p>

                      {avaliacao.comentario && (
                        <p>{avaliacao.comentario}</p>
                      )}

                      <p className="small mb-3">
                        <strong>Visibilidade:</strong>{' '}
                        {avaliacao.visivel
                          ? 'Pública'
                          : 'Oculta'}
                      </p>

                      <button
                        type="button"
                        className={
                          avaliacao.visivel
                            ? 'btn btn-sm btn-outline-danger'
                            : 'btn btn-sm btn-outline-success'
                        }
                        onClick={() =>
                          moderarAvaliacao(
                            avaliacao,
                            !avaliacao.visivel
                          )
                        }
                        disabled={acaoEmCurso !== null}
                      >
                        {avaliacao.visivel
                          ? 'Ocultar avaliação'
                          : 'Tornar pública'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Moderação dos produtos da plataforma */}
          <ModeracaoProdutos />

          {/* Leilões ativos */}
          <section className="mb-5">
            <h2 className="h4 mb-3">
              Leilões ativos
            </h2>

            {leiloes.length === 0 ? (
              <div className="alert alert-info">
                Não existem leilões com estado ativo.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Lote</th>
                      <th scope="col">Produtor</th>
                      <th scope="col">Licitação</th>
                      <th scope="col">Prazo</th>
                    </tr>
                  </thead>

                  <tbody>
                    {leiloes.map((leilao) => {
                      const terminou =
                        new Date(leilao.terminaEm).getTime() <=
                        Date.now();

                      return (
                        <tr key={leilao._id}>
                          <td>
                            <strong>{leilao.lote}</strong>
                          </td>

                          <td>
                            {leilao.produtor?.produtor
                              ?.nomeExploracao ||
                              leilao.produtor?.nome ||
                              'Produtor'}
                          </td>

                          <td>
                            {moeda(
                              leilao.licitacaoAtual?.valor ??
                              leilao.precoBase
                            )}
                          </td>

                          <td>
                            {terminou ? (
                              <span className="text-danger">
                                Prazo terminado
                              </span>
                            ) : (
                              new Date(
                                leilao.terminaEm
                              ).toLocaleString('pt-PT')
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

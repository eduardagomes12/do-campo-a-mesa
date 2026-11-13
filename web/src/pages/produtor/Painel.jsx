import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import EstadoEncomenda from '../../components/EstadoEncomenda.jsx';
import EditarExploracao from '../../components/EditarExploracao.jsx';
import MeusLeiloes from '../../components/MeusLeiloes.jsx';

// Formatar valores em euros
const moeda = (valor) =>
  Number(valor || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

// Limite visual utilizado para identificar stock baixo
const LIMITE_STOCK_BAIXO = 5;

// Transições permitidas para o estado das encomendas
const PROXIMO_ESTADO = {
  pendente: {
    estado: 'confirmada',
    texto: 'Confirmar encomenda'
  },
  confirmada: {
    estado: 'pronta',
    texto: 'Marcar como pronta'
  },
  pronta: {
    estado: 'entregue',
    texto: 'Marcar como entregue'
  }
};

// Calcular o total de uma encomenda
function totalEncomenda(encomenda) {
  if (Number.isFinite(encomenda.total)) {
    return encomenda.total;
  }

  return (encomenda.linhas || []).reduce(
    (soma, linha) =>
      soma +
      Number(linha.precoUnit || 0) *
      Number(linha.quantidade || 0),
    0
  );
}

export default function PainelProdutor() {
  const { utilizador, token } = useAuth();

  const produtorId = utilizador?.id || utilizador?._id;

  // Dados do painel
  const [produtos, setProdutos] = useState([]);
  const [encomendas, setEncomendas] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);

  // Estados de carregamento e erros
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState('');
  const [idEmAtualizacao, setIdEmAtualizacao] = useState(null);

  // Consultar os dados reais do produtor
  const carregarDados = useCallback(async () => {
    if (!token || !produtorId) {
      setACarregar(false);
      return;
    }

    setACarregar(true);
    setErro('');

    try {
      const [
        listaProdutos,
        listaEncomendas,
        listaAvaliacoes
      ] = await Promise.all([
        api('/products/me', { token }),
        api('/orders', { token }),
        api(
          `/reviews?produtor=${encodeURIComponent(produtorId)}`
        )
      ]);

      setProdutos(
        Array.isArray(listaProdutos)
          ? listaProdutos
          : []
      );

      setEncomendas(
        Array.isArray(listaEncomendas)
          ? listaEncomendas
          : []
      );

      setAvaliacoes(
        Array.isArray(listaAvaliacoes)
          ? listaAvaliacoes
          : []
      );
    } catch (e) {
      setErro(e.message);
    } finally {
      setACarregar(false);
    }
  }, [produtorId, token]);

  // Atualizar o estado de uma encomenda
  async function avancarEstado(encomenda) {
    const proximo = PROXIMO_ESTADO[encomenda.estado];

    if (!proximo || !token) return;

    setErro('');
    setIdEmAtualizacao(encomenda._id);

    try {
      const atualizada = await api(
        `/orders/${encomenda._id}/estado`,
        {
          metodo: 'PATCH',
          corpo: {
            estado: proximo.estado
          },
          token
        }
      );

      // Atualizar a interface após confirmação da API
      setEncomendas((atuais) =>
        atuais.map((item) =>
          item._id === encomenda._id
            ? {
                ...item,
                estado: atualizada.estado
              }
            : item
        )
      );
    } catch (e) {
      setErro(
        e.message || 'Erro ao atualizar a encomenda.'
      );
    } finally {
      setIdEmAtualizacao(null);
    }
  }

  // Carregar os dados quando o componente é apresentado
  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Encomendas que ainda não foram entregues
  const encomendasPorTratar = useMemo(
    () =>
      encomendas.filter(
        (encomenda) => encomenda.estado !== 'entregue'
      ),
    [encomendas]
  );

  // Produtos com stock baixo
  const produtosStockBaixo = useMemo(
    () =>
      produtos.filter(
        (produto) =>
          Number(produto.stock) <= LIMITE_STOCK_BAIXO
      ),
    [produtos]
  );

  // Calcular a média das avaliações
  const avaliacaoMedia = useMemo(() => {
    if (avaliacoes.length === 0) {
      return null;
    }

    const soma = avaliacoes.reduce(
      (total, avaliacao) =>
        total + Number(avaliacao.classificacao),
      0
    );

    return soma / avaliacoes.length;
  }, [avaliacoes]);

  // Calcular o total de encomendas entregues criadas no mês
  const vendasMes = useMemo(() => {
    const agora = new Date();

    return encomendas
      .filter((encomenda) => {
        const data = new Date(encomenda.createdAt);

        return (
          encomenda.estado === 'entregue' &&
          data.getMonth() === agora.getMonth() &&
          data.getFullYear() === agora.getFullYear()
        );
      })
      .reduce(
        (total, encomenda) =>
          total + totalEncomenda(encomenda),
        0
      );
  }, [encomendas]);

  // Verificar autenticação
  if (!token || !produtorId) {
    return (
      <div className="alert alert-warning">
        É necessário iniciar sessão como produtor.
      </div>
    );
  }

  return (
    <>
      {/* Cabeçalho */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="mb-1">
            Painel do produtor
          </h1>

          <p className="texto-secundario mb-0">
            Gere os teus produtos, encomendas e leilões.
          </p>
        </div>

        {/* Acessos às funcionalidades do produtor */}
        <div className="d-flex flex-wrap gap-2">
          <Link
            to="/produtor/produtos"
            className="btn btn-outline-success"
          >
            Gerir produtos
          </Link>

          <Link
            to="/produtor/leiloes/novo"
            className="btn btn-success"
          >
            Criar leilão
          </Link>
        </div>
      </div>

      {/* Editar os dados públicos da exploração */}
      <EditarExploracao />

      {/* Acompanhamento dos leilões do produtor */}
      <MeusLeiloes />

      {/* Mensagens de erro */}
      {erro && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {erro}
        </div>
      )}

      {/* Estado de carregamento */}
      {aCarregar && (
        <p role="status">
          A carregar painel...
        </p>
      )}

      {!aCarregar && (
        <>
          {/* Indicadores principais */}
          <section className="mb-5">
            <h2 className="h4 mb-3">
              Resumo da atividade
            </h2>

            <div className="row g-3">

              {/* Encomendas por tratar */}
              <div className="col-12 col-md-4">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <p className="texto-secundario mb-2">
                      Encomendas por tratar
                    </p>

                    <p className="fs-2 fw-bold mb-0">
                      {encomendasPorTratar.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Encomendas entregues do mês */}
              <div className="col-12 col-md-4">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <p className="texto-secundario mb-2">
                      Encomendas entregues do mês
                    </p>

                    <p className="fs-2 fw-bold mb-0">
                      {moeda(vendasMes)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Avaliação média */}
              <div className="col-12 col-md-4">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <p className="texto-secundario mb-2">
                      Avaliação média
                    </p>

                    <p className="fs-2 fw-bold mb-0">
                      {avaliacaoMedia === null
                        ? '—'
                        : `${avaliacaoMedia.toFixed(1)} / 5`}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Alertas de stock */}
          <section className="mb-5">
            <h2 className="h4 mb-3">
              Alertas de stock
            </h2>

            {produtosStockBaixo.length === 0 ? (
              <div className="alert alert-success">
                Não existem produtos com stock baixo.
              </div>
            ) : (
              <div className="alert alert-warning">
                <strong>
                  Atenção ao stock:
                </strong>

                <ul className="mb-0 mt-2">
                  {produtosStockBaixo.map((produto) => (
                    <li key={produto._id}>
                      {produto.nome}: {produto.stock}{' '}
                      {produto.unidade}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Catálogo do produtor */}
          <section className="mb-5">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h4 mb-0">
                Os meus produtos
              </h2>

              <span className="badge text-bg-secondary">
                {produtos.length}
              </span>
            </div>

            {produtos.length === 0 ? (
              <p className="texto-secundario">
                Ainda não tens produtos registados.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped align-middle">
                  <thead>
                    <tr>
                      <th scope="col">
                        Produto
                      </th>

                      <th scope="col">
                        Categoria
                      </th>

                      <th scope="col">
                        Preço
                      </th>

                      <th scope="col">
                        Stock
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {produtos.map((produto) => (
                      <tr key={produto._id}>

                        <td>
                          <strong>{produto.nome}</strong>

                          {produto.visivel === false && (
                            <span className="badge text-bg-warning ms-2">
                              Oculto pelo administrador
                            </span>
                          )}
                        </td>

                        <td>
                          {produto.categoria}
                        </td>

                        <td>
                          {moeda(produto.preco)}
                        </td>

                        <td>
                          <span
                            className={
                              produto.stock <= LIMITE_STOCK_BAIXO
                                ? 'text-danger fw-bold'
                                : ''
                            }
                          >
                            {produto.stock}{' '}
                            {produto.unidade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Encomendas recebidas */}
          <section className="mb-5">
            <h2 className="h4 mb-3">
              Encomendas recebidas
            </h2>

            {encomendas.length === 0 ? (
              <p className="texto-secundario">
                Ainda não existem encomendas.
              </p>
            ) : (
              <div className="d-grid gap-3">
                {encomendas.map((encomenda) => (
                  <article
                    className="card"
                    key={encomenda._id}
                  >
                    <div className="card-body">

                      {/* Identificação da encomenda */}
                      <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
                        <div>
                          <h3 className="h6">
                            Encomenda #
                            {String(encomenda._id).slice(-6)}
                          </h3>

                          <p className="texto-secundario small mb-0">
                            {new Date(
                              encomenda.createdAt
                            ).toLocaleDateString('pt-PT')}
                          </p>
                        </div>

                        <strong>
                          {moeda(totalEncomenda(encomenda))}
                        </strong>
                      </div>

                      {/* Produtos encomendados */}
                      <ul className="mb-3">
                        {(encomenda.linhas || []).map(
                          (linha, indice) => (
                            <li
                              key={
                                linha._id ||
                                `${linha.produto}-${indice}`
                              }
                            >
                              {linha.nome} —{' '}
                              {linha.quantidade} ×{' '}
                              {moeda(linha.precoUnit)}
                            </li>
                          )
                        )}
                      </ul>

                      {/* Estado atual */}
                      <EstadoEncomenda
                        estado={encomenda.estado}
                      />

                      {/* Avançar o estado da encomenda */}
                      {PROXIMO_ESTADO[encomenda.estado] && (
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm mt-3"
                          onClick={() =>
                            avancarEstado(encomenda)
                          }
                          disabled={idEmAtualizacao !== null}
                        >
                          {idEmAtualizacao === encomenda._id
                            ? 'A atualizar...'
                            : PROXIMO_ESTADO[
                                encomenda.estado
                              ].texto}
                        </button>
                      )}

                      {/* Informação de entrega */}
                      <p className="small mt-3 mb-0">
                        <strong>
                          Receção:
                        </strong>{' '}
                        {encomenda.entrega?.tipo === 'entrega'
                          ? 'Entrega'
                          : 'Levantamento'}
                      </p>

                      {encomenda.entrega?.morada && (
                        <p className="small mt-1 mb-0">
                          <strong>
                            Morada:
                          </strong>{' '}
                          {encomenda.entrega.morada}
                        </p>
                      )}

                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

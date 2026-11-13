import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { api } from '../api/client.js';

const euro = (valor) =>
  Number(valor || 0).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function ModeracaoProdutos() {
  const { token } = useAuth();

  const {
    dados,
    erro: erroConsulta,
    aCarregar,
    recarregar
  } = useApi('/admin/produtos');

  const [pesquisa, setPesquisa] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const produtos = Array.isArray(dados) ? dados : [];

  const produtosFiltrados = produtos.filter((produto) => {
    const termo = pesquisa.trim().toLocaleLowerCase('pt-PT');

    const nome = produto.nome || '';
    const produtor =
      produto.produtor?.produtor?.nomeExploracao ||
      produto.produtor?.nome ||
      '';

    return (
      nome.toLocaleLowerCase('pt-PT').includes(termo) ||
      produtor.toLocaleLowerCase('pt-PT').includes(termo)
    );
  });

  const ocultos = produtos.filter(
    (produto) => produto.visivel === false
  ).length;

  async function alterarVisibilidade(produto) {
    if (ocupado) return;

    const estaVisivel = produto.visivel !== false;
    const novaVisibilidade = !estaVisivel;

    if (
      estaVisivel &&
      !window.confirm(
        `Queres ocultar o produto "${produto.nome}"?`
      )
    ) {
      return;
    }

    setErro('');
    setSucesso('');
    setOcupado(produto._id);

    try {
      await api(
        `/admin/produtos/${produto._id}/visibilidade`,
        {
          metodo: 'PATCH',
          corpo: { visivel: novaVisibilidade },
          token
        }
      );

      await recarregar();

      setSucesso(
        novaVisibilidade
          ? `O produto "${produto.nome}" está novamente público.`
          : `O produto "${produto.nome}" foi ocultado.`
      );
    } catch (err) {
      setErro(
        err.message || 'Não foi possível moderar o produto.'
      );
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section
      className="mb-5"
      aria-labelledby="titulo-moderacao-produtos"
    >
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h2
            id="titulo-moderacao-produtos"
            className="h4 mb-1"
          >
            Moderação de produtos
          </h2>

          <p className="texto-secundario small mb-0">
            Gere a visibilidade dos produtos publicados
            pelos produtores.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-success btn-sm"
          onClick={() => recarregar()}
          disabled={ocupado !== null}
        >
          Atualizar
        </button>
      </div>

      {erroConsulta && (
        <div className="alert alert-danger" role="alert">
          {erroConsulta}
        </div>
      )}

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

      {aCarregar ? (
        <p role="status">A carregar produtos...</p>
      ) : (
        <>
          <div className="d-flex flex-wrap gap-3 mb-3">
            <span className="badge text-bg-secondary">
              Total: {produtos.length}
            </span>

            <span className="badge text-bg-warning">
              Ocultos: {ocultos}
            </span>

            <span className="badge text-bg-success">
              Públicos: {produtos.length - ocultos}
            </span>
          </div>

          <div className="mb-3">
            <label
              htmlFor="pesquisa-moderacao"
              className="form-label"
            >
              Pesquisar produto ou produtor
            </label>

            <input
              id="pesquisa-moderacao"
              type="search"
              className="form-control"
              placeholder="Nome do produto ou exploração"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
            />
          </div>

          {produtosFiltrados.length === 0 ? (
            <div className="alert alert-info">
              Não existem produtos correspondentes.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped align-middle">
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Produtor</th>
                    <th scope="col">Preço</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Visibilidade</th>
                    <th scope="col">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {produtosFiltrados.map((produto) => {
                    const visivel = produto.visivel !== false;

                    return (
                      <tr key={produto._id}>
                        <td>
                          <strong>{produto.nome}</strong>
                          <div className="small texto-secundario">
                            {produto.categoria}
                          </div>
                        </td>

                        <td>
                          {produto.produtor?.produtor
                            ?.nomeExploracao ||
                            produto.produtor?.nome ||
                            'Produtor indisponível'}
                        </td>

                        <td>{euro(produto.preco)}</td>
                        <td>{produto.stock}</td>

                        <td>
                          <span
                            className={
                              visivel
                                ? 'badge text-bg-success'
                                : 'badge text-bg-warning'
                            }
                          >
                            {visivel ? 'Público' : 'Oculto'}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className={
                              visivel
                                ? 'btn btn-sm btn-outline-danger'
                                : 'btn btn-sm btn-outline-success'
                            }
                            onClick={() =>
                              alterarVisibilidade(produto)
                            }
                            disabled={ocupado !== null}
                          >
                            {ocupado === produto._id
                              ? 'A guardar...'
                              : visivel
                                ? 'Ocultar'
                                : 'Tornar público'}
                          </button>
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

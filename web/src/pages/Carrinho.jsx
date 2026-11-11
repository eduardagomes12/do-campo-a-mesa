import { useState } from 'react';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function Carrinho() {
  const { linhas, remover, total } = useCarrinho();
  const { token } = useAuth();

  const [tipoEntrega, setTipoEntrega] = useState('levantamento');
  const [morada, setMorada] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function finalizarEncomenda(evento) {
    evento.preventDefault();

    setErro('');
    setSucesso('');

    if (linhas.length === 0) {
      setErro('O carrinho está vazio.');
      return;
    }

    if (tipoEntrega === 'entrega' && !morada.trim()) {
      setErro('Indica a morada de entrega.');
      return;
    }

    if (!token) {
      setErro('É necessário iniciar sessão para encomendar.');
      return;
    }

    // Preparar os dados esperados pelo backend
    const dados = {
      linhas: linhas.map(({ produto, quantidade }) => ({
        produto: produto._id,
        quantidade
      })),
      entrega: {
        tipo: tipoEntrega,
        ...(tipoEntrega === 'entrega'
          ? { morada: morada.trim() }
          : {})
      }
    };

    setAEnviar(true);

    try {
      // A API cria uma encomenda por produtor
      const encomendas = await api('/orders', {
        metodo: 'POST',
        corpo: dados,
        token
      });

      // Esvaziar o carrinho apenas após sucesso
      linhas.forEach(({ produto }) => {
        remover(produto._id);
      });

      const quantidade = encomendas.length;

      setSucesso(
        quantidade === 1
          ? 'Encomenda criada com sucesso!'
          : `${quantidade} encomendas criadas com sucesso!`
      );

      setMorada('');
      setTipoEntrega('levantamento');
    } catch (e) {
      setErro(e.message);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <section aria-labelledby="titulo-carrinho">
      <h1 id="titulo-carrinho" className="mb-4">
        Carrinho
      </h1>

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

      {linhas.length === 0 ? (
        <p className="texto-secundario">
          O carrinho está vazio.
        </p>
      ) : (
        <>
          {/* Produtos no carrinho */}
          <ul className="list-group mb-4">
            {linhas.map(({ produto, quantidade }) => (
              <li
                key={produto._id}
                className="list-group-item d-flex justify-content-between align-items-center gap-3"
              >
                <div>
                  <strong>{produto.nome}</strong>

                  <p className="mb-1 texto-secundario">
                    Quantidade: {quantidade} {produto.unidade}
                  </p>

                  <span>
                    {(Number(produto.preco) * quantidade)
                      .toFixed(2)} €
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => remover(produto._id)}
                  disabled={aEnviar}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>

          <p className="fw-bold fs-5 mb-4">
            Total: {total.toFixed(2)} €
          </p>

          {/* Escolha do tipo de entrega */}
          <form onSubmit={finalizarEncomenda}>
            <h2 className="h4 mb-3">
              Como pretende receber a encomenda?
            </h2>

            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="radio"
                name="tipoEntrega"
                id="levantamento"
                value="levantamento"
                checked={tipoEntrega === 'levantamento'}
                onChange={(e) =>
                  setTipoEntrega(e.target.value)
                }
                disabled={aEnviar}
              />

              <label
                className="form-check-label"
                htmlFor="levantamento"
              >
                Levantamento no produtor
              </label>
            </div>

            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="radio"
                name="tipoEntrega"
                id="entrega"
                value="entrega"
                checked={tipoEntrega === 'entrega'}
                onChange={(e) =>
                  setTipoEntrega(e.target.value)
                }
                disabled={aEnviar}
              />

              <label
                className="form-check-label"
                htmlFor="entrega"
              >
                Entrega na morada indicada
              </label>
            </div>

            {tipoEntrega === 'entrega' && (
              <div className="mb-4">
                <label
                  htmlFor="morada"
                  className="form-label"
                >
                  Morada de entrega
                </label>

                <textarea
                  id="morada"
                  className="form-control"
                  rows="3"
                  value={morada}
                  onChange={(e) =>
                    setMorada(e.target.value)
                  }
                  placeholder="Rua, número, código postal e localidade"
                  required
                  disabled={aEnviar}
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-success"
              disabled={aEnviar}
            >
              {aEnviar
                ? 'A processar encomenda...'
                : 'Finalizar encomenda'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

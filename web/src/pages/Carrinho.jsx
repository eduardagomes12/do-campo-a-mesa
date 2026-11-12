import { useState } from 'react';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function Carrinho() {
  const {
    linhas,
    alterarQuantidade,
    remover,
    total
  } = useCarrinho();

  const { token } = useAuth();

  const [tipoEntrega, setTipoEntrega] = useState('levantamento');
  const [morada, setMorada] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // ==========================================
  // FINALIZAR ENCOMENDA
  // ==========================================

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
      // Criar uma encomenda por produtor
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

  // ==========================================
  // INTERFACE DO CARRINHO
  // ==========================================

  return (
    <section aria-labelledby="titulo-carrinho">

      <h1 id="titulo-carrinho" className="mb-4">
        Carrinho
      </h1>

      {/* Mensagens de erro */}
      {erro && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {erro}
        </div>
      )}

      {/* Mensagens de sucesso */}
      {sucesso && (
        <div
          className="alert alert-success"
          role="status"
        >
          {sucesso}
        </div>
      )}

      {linhas.length === 0 ? (

        <p className="texto-secundario">
          O carrinho está vazio.
        </p>

      ) : (

        <>
          {/* ======================================
              LISTA DOS PRODUTOS
          ====================================== */}

          <ul className="list-group mb-4">

            {linhas.map(({ produto, quantidade }) => (

              <li
                key={produto._id}
                className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-3"
              >

                <div className="flex-grow-1">

                  {/* Nome do produto */}
                  <strong>
                    {produto.nome}
                  </strong>

                  {/* Preço unitário */}
                  <p className="mb-2 texto-secundario">
                    {Number(produto.preco).toFixed(2)} €
                    {' / '}
                    {produto.unidade}
                  </p>

                  {/* ==================================
                      CONTROLOS DE QUANTIDADE
                  ================================== */}

                  <div className="d-flex align-items-center gap-2 mb-2">

                    <span className="texto-secundario">
                      Quantidade:
                    </span>

                    <div
                      className="btn-group btn-group-sm"
                      role="group"
                      aria-label={`Quantidade de ${produto.nome}`}
                    >

                      {/* Diminuir quantidade */}
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        aria-label={`Diminuir quantidade de ${produto.nome}`}
                        onClick={() =>
                          alterarQuantidade(
                            produto._id,
                            quantidade - 1
                          )
                        }
                        disabled={
                          aEnviar ||
                          quantidade <= 1
                        }
                      >
                        −
                      </button>

                      {/* Quantidade atual */}
                      <span
                        className="btn btn-outline-secondary disabled"
                        aria-live="polite"
                      >
                        {quantidade}
                      </span>

                      {/* Aumentar quantidade */}
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        aria-label={`Aumentar quantidade de ${produto.nome}`}
                        onClick={() =>
                          alterarQuantidade(
                            produto._id,
                            quantidade + 1
                          )
                        }
                        disabled={aEnviar}
                      >
                        +
                      </button>

                    </div>

                    <span className="texto-secundario">
                      {produto.unidade}
                    </span>

                  </div>

                  {/* Subtotal do produto */}
                  <p className="mb-0">
                    <strong>
                      Subtotal:{' '}
                      {(
                        Number(produto.preco) *
                        quantidade
                      ).toFixed(2)} €
                    </strong>
                  </p>

                </div>

                {/* Remover produto */}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() =>
                    remover(produto._id)
                  }
                  disabled={aEnviar}
                >
                  Remover
                </button>

              </li>

            ))}

          </ul>

          {/* ======================================
              TOTAL DO CARRINHO
          ====================================== */}

          <p
            className="fw-bold fs-5 mb-4"
            aria-live="polite"
          >
            Total: {total.toFixed(2)} €
          </p>

          {/* ======================================
              FORMULÁRIO DE ENTREGA
          ====================================== */}

          <form onSubmit={finalizarEncomenda}>

            <h2 className="h4 mb-3">
              Como pretende receber a encomenda?
            </h2>

            {/* Levantamento */}
            <div className="form-check mb-2">

              <input
                className="form-check-input"
                type="radio"
                name="tipoEntrega"
                id="levantamento"
                value="levantamento"
                checked={
                  tipoEntrega === 'levantamento'
                }
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

            {/* Entrega */}
            <div className="form-check mb-3">

              <input
                className="form-check-input"
                type="radio"
                name="tipoEntrega"
                id="entrega"
                value="entrega"
                checked={
                  tipoEntrega === 'entrega'
                }
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

            {/* Morada de entrega */}
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

            {/* Finalizar encomenda */}
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

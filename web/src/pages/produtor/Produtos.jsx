import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../api/client.js';

const CATEGORIAS = [
  'Hortícolas',
  'Fruta',
  'Mel',
  'Vinho',
  'Queijo',
  'Padaria',
  'Outros'
];

const EPOCAS = [
  'Primavera',
  'Verão',
  'Outono',
  'Inverno'
];

const VAZIO = {
  nome: '',
  descricao: '',
  categoria: 'Hortícolas',
  preco: '',
  unidade: 'kg',
  stock: '0',
  biologico: false,
  epocas: []
};

const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function ProdutosProdutor() {
  const { utilizador, token } = useAuth();
  const produtorId = utilizador?.id || utilizador?._id;

  // Consultar os produtos do produtor
  const {
    dados,
    erro: erroConsulta,
    aCarregar,
    recarregar
  } = useApi(
    produtorId
      ? `/products?produtor=${encodeURIComponent(produtorId)}`
      : null
  );

  const produtos = Array.isArray(dados) ? dados : [];

  // Estado do formulário
  const [formulario, setFormulario] = useState(VAZIO);
  const [editarId, setEditarId] = useState(null);

  // Estado das operações
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // ==========================================
  // ALTERAR CAMPOS DO FORMULÁRIO
  // ==========================================

  function alterar(evento) {
    const { name, value, type, checked } = evento.target;

    setFormulario((atual) => ({
      ...atual,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  // Selecionar ou retirar uma época
  function alterarEpoca(epoca) {
    setFormulario((atual) => ({
      ...atual,
      epocas: atual.epocas.includes(epoca)
        ? atual.epocas.filter((e) => e !== epoca)
        : [...atual.epocas, epoca]
    }));
  }

  // Limpar formulário
  function limparFormulario() {
    setFormulario({ ...VAZIO, epocas: [] });
    setEditarId(null);
  }

  // ==========================================
  // EDITAR PRODUTO EXISTENTE
  // ==========================================

  function editar(produto) {
    setEditarId(produto._id);
    setErro('');
    setSucesso('');

    setFormulario({
      nome: produto.nome || '',
      descricao: produto.descricao || '',
      categoria: produto.categoria || 'Hortícolas',
      preco: String(produto.preco ?? ''),
      unidade: produto.unidade || 'kg',
      stock: String(produto.stock ?? 0),
      biologico: Boolean(produto.biologico),
      epocas: produto.epocas || []
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // ==========================================
  // CRIAR OU ATUALIZAR PRODUTO
  // ==========================================

  async function guardar(evento) {
    evento.preventDefault();

    setErro('');
    setSucesso('');

    if (!token) {
      setErro('É necessário iniciar sessão como produtor.');
      return;
    }

    const preco = Number(formulario.preco);
    const stock = Number(formulario.stock);

    // Validar os campos obrigatórios
    if (
      !formulario.nome.trim() ||
      !formulario.unidade.trim() ||
      formulario.preco === '' ||
      formulario.stock === '' ||
      !Number.isFinite(preco) ||
      !Number.isFinite(stock) ||
      preco < 0 ||
      stock < 0
    ) {
      setErro('Verifica os dados do produto.');
      return;
    }

    // Preparar os dados para a API
    const corpo = {
      nome: formulario.nome.trim(),
      descricao: formulario.descricao.trim(),
      categoria: formulario.categoria,
      preco,
      unidade: formulario.unidade.trim(),
      stock,
      biologico: formulario.biologico,
      epocas: formulario.epocas
    };

    setOcupado(true);

    try {
      if (editarId) {
        // Atualizar produto existente
        await api(`/products/${editarId}`, {
          metodo: 'PUT',
          corpo,
          token
        });

        setSucesso('Produto atualizado com sucesso.');
      } else {
        // Criar novo produto
        await api('/products', {
          metodo: 'POST',
          corpo,
          token
        });

        setSucesso('Produto criado com sucesso.');
      }

      limparFormulario();
      await recarregar();

    } catch (e) {
      setErro(
        e.message || 'Não foi possível guardar o produto.'
      );

    } finally {
      setOcupado(false);
    }
  }

  // ==========================================
  // ELIMINAR PRODUTO
  // ==========================================

  async function eliminar(produto) {
    const confirmar = window.confirm(
      `Tens a certeza de que queres eliminar "${produto.nome}"?`
    );

    if (!confirmar) return;

    setErro('');
    setSucesso('');
    setOcupado(true);

    try {
      await api(`/products/${produto._id}`, {
        metodo: 'DELETE',
        token
      });

      if (editarId === produto._id) {
        limparFormulario();
      }

      setSucesso('Produto eliminado com sucesso.');
      await recarregar();

    } catch (e) {
      setErro(
        e.message || 'Não foi possível eliminar o produto.'
      );

    } finally {
      setOcupado(false);
    }
  }

  // ==========================================
  // INTERFACE
  // ==========================================

  return (
    <>
      <Link
        to="/produtor"
        className="d-inline-block mb-3"
      >
        ← Voltar ao painel
      </Link>

      <h1 className="mb-4">
        Gerir produtos
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

      <div className="row g-4">

        {/* ======================================
            FORMULÁRIO DO PRODUTOR
        ====================================== */}

        <div className="col-12 col-lg-5">
          <section className="card">
            <div className="card-body">

              <h2 className="h4 mb-4">
                {editarId
                  ? 'Editar produto'
                  : 'Adicionar produto'}
              </h2>

              <form onSubmit={guardar}>

                {/* Nome */}
                <div className="mb-3">
                  <label
                    htmlFor="nome"
                    className="form-label"
                  >
                    Nome
                  </label>

                  <input
                    id="nome"
                    name="nome"
                    className="form-control"
                    value={formulario.nome}
                    onChange={alterar}
                    required
                    disabled={ocupado}
                  />
                </div>

                {/* Descrição */}
                <div className="mb-3">
                  <label
                    htmlFor="descricao"
                    className="form-label"
                  >
                    Descrição
                  </label>

                  <textarea
                    id="descricao"
                    name="descricao"
                    className="form-control"
                    rows="3"
                    placeholder="Descreve o produto, a sua origem e características..."
                    value={formulario.descricao}
                    onChange={alterar}
                    disabled={ocupado}
                  />

                  <div className="form-text">
                    Campo opcional. Acrescenta informações
                    úteis para os compradores.
                  </div>
                </div>

                {/* Categoria */}
                <div className="mb-3">
                  <label
                    htmlFor="categoria"
                    className="form-label"
                  >
                    Categoria
                  </label>

                  <select
                    id="categoria"
                    name="categoria"
                    className="form-select"
                    value={formulario.categoria}
                    onChange={alterar}
                    disabled={ocupado}
                  >
                    {CATEGORIAS.map((categoria) => (
                      <option
                        key={categoria}
                        value={categoria}
                      >
                        {categoria}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preço e unidade */}
                <div className="row g-3 mb-3">

                  <div className="col-6">
                    <label
                      htmlFor="preco"
                      className="form-label"
                    >
                      Preço (€)
                    </label>

                    <input
                      id="preco"
                      name="preco"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={formulario.preco}
                      onChange={alterar}
                      required
                      disabled={ocupado}
                    />
                  </div>

                  <div className="col-6">
                    <label
                      htmlFor="unidade"
                      className="form-label"
                    >
                      Unidade
                    </label>

                    <input
                      id="unidade"
                      name="unidade"
                      className="form-control"
                      placeholder="kg, unidade..."
                      value={formulario.unidade}
                      onChange={alterar}
                      required
                      disabled={ocupado}
                    />
                  </div>

                </div>

                {/* Stock */}
                <div className="mb-3">
                  <label
                    htmlFor="stock"
                    className="form-label"
                  >
                    Stock disponível
                  </label>

                  <input
                    id="stock"
                    name="stock"
                    type="number"
                    min="0"
                    step="any"
                    className="form-control"
                    value={formulario.stock}
                    onChange={alterar}
                    required
                    disabled={ocupado}
                  />
                </div>

                {/* Produto biológico */}
                <div className="form-check mb-3">

                  <input
                    id="biologico"
                    name="biologico"
                    type="checkbox"
                    className="form-check-input"
                    checked={formulario.biologico}
                    onChange={alterar}
                    disabled={ocupado}
                  />

                  <label
                    htmlFor="biologico"
                    className="form-check-label"
                  >
                    Produto biológico
                  </label>

                </div>

                {/* Épocas */}
                <fieldset className="mb-4">

                  <legend className="fs-6">
                    Épocas do ano
                  </legend>

                  {EPOCAS.map((epoca) => (
                    <div
                      className="form-check"
                      key={epoca}
                    >
                      <input
                        id={`epoca-${epoca}`}
                        type="checkbox"
                        className="form-check-input"
                        checked={
                          formulario.epocas.includes(epoca)
                        }
                        onChange={() =>
                          alterarEpoca(epoca)
                        }
                        disabled={ocupado}
                      />

                      <label
                        htmlFor={`epoca-${epoca}`}
                        className="form-check-label"
                      >
                        {epoca}
                      </label>
                    </div>
                  ))}

                </fieldset>

                {/* Botões */}
                <div className="d-flex gap-2">

                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={ocupado}
                  >
                    {ocupado
                      ? 'A guardar...'
                      : editarId
                        ? 'Guardar alterações'
                        : 'Adicionar produto'}
                  </button>

                  {editarId && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={limparFormulario}
                      disabled={ocupado}
                    >
                      Cancelar
                    </button>
                  )}

                </div>

              </form>
            </div>
          </section>
        </div>

        {/* ======================================
            LISTA DE PRODUTOS
        ====================================== */}

        <div className="col-12 col-lg-7">
          <section>

            <h2 className="h4 mb-3">
              Os meus produtos ({produtos.length})
            </h2>

            {aCarregar && (
              <p role="status">
                A carregar produtos...
              </p>
            )}

            {erroConsulta && (
              <div
                className="alert alert-danger"
                role="alert"
              >
                {erroConsulta}
              </div>
            )}

            {!aCarregar &&
              !erroConsulta &&
              produtos.length === 0 && (
                <p className="alert alert-info">
                  Ainda não tens produtos registados.
                </p>
              )}

            {!aCarregar &&
              produtos.length > 0 && (
                <div className="table-responsive">

                  <table className="table table-striped align-middle">

                    <thead>
                      <tr>
                        <th scope="col">Produto</th>
                        <th scope="col">Preço</th>
                        <th scope="col">Stock</th>
                        <th scope="col">Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {produtos.map((produto) => (
                        <tr key={produto._id}>

                          <td>
                            <strong>
                              {produto.nome}
                            </strong>

                            <div className="small texto-secundario">
                              {produto.categoria}
                            </div>

                            {produto.descricao && (
                              <div className="small texto-secundario mt-1">
                                {produto.descricao}
                              </div>
                            )}
                          </td>

                          <td>
                            {euro(produto.preco)}
                          </td>

                          <td>
                            {produto.stock}{' '}
                            {produto.unidade}
                          </td>

                          <td>
                            <div className="d-flex flex-wrap gap-2">

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() =>
                                  editar(produto)
                                }
                                disabled={ocupado}
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() =>
                                  eliminar(produto)
                                }
                                disabled={ocupado}
                              >
                                Eliminar
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
        </div>

      </div>
    </>
  );
}

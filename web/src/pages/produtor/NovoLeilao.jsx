import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../api/client.js';

const formularioInicial = {
  produto: '',
  lote: '',
  quantidade: '',
  precoBase: '',
  incremento: '',
  duracao: '30',
  iniciaEm: ''
};

export default function NovoLeilao() {
  const { utilizador, token } = useAuth();

  const produtorId = utilizador?.id || utilizador?._id;

  // Consultar os produtos deste produtor
  const {
    dados,
    erro: erroProdutos,
    aCarregar
  } = useApi(
    produtorId
      ? `/products?produtor=${encodeURIComponent(produtorId)}`
      : null
  );

  const produtos = Array.isArray(dados) ? dados : [];

  const [formulario, setFormulario] = useState(
    formularioInicial
  );
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  function alterarCampo(evento) {
    const { name, value } = evento.target;

    setFormulario((atual) => ({
      ...atual,
      [name]: value
    }));
  }

  async function criarLeilao(evento) {
    evento.preventDefault();

    setErro('');
    setSucesso('');

    if (!token || !produtorId) {
      setErro('É necessário iniciar sessão como produtor.');
      return;
    }

    if (!formulario.produto) {
      setErro('Seleciona um produto.');
      return;
    }

    const corpo = {
      produto: formulario.produto,
      lote: formulario.lote.trim(),
      quantidade: formulario.quantidade.trim(),
      precoBase: Number(formulario.precoBase),
      incremento: Number(formulario.incremento),
      duracao: Number(formulario.duracao)
    };

    if (formulario.iniciaEm) {
      const inicio = new Date(formulario.iniciaEm);

      if (Number.isNaN(inicio.getTime())) {
        setErro('A data de início é inválida.');
        return;
      }

      corpo.iniciaEm = inicio.toISOString();
    }

    setAEnviar(true);

    try {
      const leilao = await api('/auctions', {
        metodo: 'POST',
        corpo,
        token
      });

      setSucesso(
        `Leilão "${leilao.lote}" criado com sucesso!`
      );

      setFormulario(formularioInicial);
    } catch (e) {
      setErro(e.message);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="formulario-estreito">
      <Link
        to="/produtor"
        className="d-inline-block mb-3"
      >
        ← Voltar ao painel
      </Link>

      <h1 className="mb-4">Criar leilão</h1>

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

      {erroProdutos && (
        <div className="alert alert-danger" role="alert">
          Não foi possível carregar os produtos:
          {' '}{erroProdutos}
        </div>
      )}

      {aCarregar && produtorId && (
        <p role="status">A carregar produtos...</p>
      )}

      {!produtorId && (
        <p className="alert alert-warning">
          Não foi possível identificar o produtor.
        </p>
      )}

      {!aCarregar &&
        !erroProdutos &&
        produtos.length === 0 && (
          <p className="alert alert-info">
            Ainda não tens produtos disponíveis
            para associar a um leilão.
          </p>
        )}

      <form onSubmit={criarLeilao}>

        {/* Produto */}
        <div className="mb-3">
          <label htmlFor="produto" className="form-label">
            Produto
          </label>

          <select
            id="produto"
            name="produto"
            className="form-select"
            value={formulario.produto}
            onChange={alterarCampo}
            required
            disabled={aEnviar || aCarregar}
          >
            <option value="">
              Seleciona um produto
            </option>

            {produtos.map((produto) => (
              <option
                key={produto._id}
                value={produto._id}
              >
                {produto.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Descrição do lote */}
        <div className="mb-3">
          <label htmlFor="lote" className="form-label">
            Descrição do lote
          </label>

          <input
            id="lote"
            name="lote"
            type="text"
            className="form-control"
            placeholder="Ex.: Kiwi Hayward, calibre A"
            value={formulario.lote}
            onChange={alterarCampo}
            required
            disabled={aEnviar}
          />
        </div>

        {/* Quantidade */}
        <div className="mb-3">
          <label
            htmlFor="quantidade"
            className="form-label"
          >
            Quantidade do lote
          </label>

          <input
            id="quantidade"
            name="quantidade"
            type="text"
            className="form-control"
            placeholder="Ex.: 200 kg"
            value={formulario.quantidade}
            onChange={alterarCampo}
            required
            disabled={aEnviar}
          />
        </div>

        {/* Preço base */}
        <div className="mb-3">
          <label
            htmlFor="precoBase"
            className="form-label"
          >
            Preço base (€)
          </label>

          <input
            id="precoBase"
            name="precoBase"
            type="number"
            className="form-control"
            min="0"
            step="0.01"
            value={formulario.precoBase}
            onChange={alterarCampo}
            required
            disabled={aEnviar}
          />
        </div>

        {/* Incremento */}
        <div className="mb-3">
          <label
            htmlFor="incremento"
            className="form-label"
          >
            Incremento mínimo (€)
          </label>

          <input
            id="incremento"
            name="incremento"
            type="number"
            className="form-control"
            min="0.01"
            step="0.01"
            placeholder="Ex.: 5"
            value={formulario.incremento}
            onChange={alterarCampo}
            required
            disabled={aEnviar}
          />
        </div>

        {/* Duração */}
        <div className="mb-3">
          <label
            htmlFor="duracao"
            className="form-label"
          >
            Duração (minutos)
          </label>

          <input
            id="duracao"
            name="duracao"
            type="number"
            className="form-control"
            min="1"
            step="1"
            value={formulario.duracao}
            onChange={alterarCampo}
            required
            disabled={aEnviar}
          />
        </div>

        {/* Data de início */}
        <div className="mb-4">
          <label
            htmlFor="iniciaEm"
            className="form-label"
          >
            Data e hora de início
          </label>

          <input
            id="iniciaEm"
            name="iniciaEm"
            type="datetime-local"
            className="form-control"
            value={formulario.iniciaEm}
            onChange={alterarCampo}
            disabled={aEnviar}
          />

          <div className="form-text">
            Deixa em branco para iniciar imediatamente.
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-success w-100"
          disabled={
            aEnviar ||
            aCarregar ||
            !!erroProdutos ||
            produtos.length === 0
          }
        >
          {aEnviar
            ? 'A criar leilão...'
            : 'Criar leilão'}
        </button>

      </form>
    </div>
  );
}

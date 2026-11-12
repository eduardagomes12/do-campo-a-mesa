import { useEffect, useState } from 'react';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import produtosSimulados from '../data/produtos.json';
import DestaqueLeilao from '../components/DestaqueLeilao.jsx';


const CATEGORIAS = [
  'Todos',
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

const FILTRO_INICIAL = {
  q: '',
  categoria: 'Todos',
  bio: false,
  epoca: '',
  precoMax: '',
  ordenar: 'recentes'
};

export default function Catalogo() {
  const [produtos, setProdutos] = useState([]);
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(
    !USAR_DADOS_SIMULADOS
  );

  const carrinho = useCarrinho();
  const { utilizador } = useAuth();

  useEffect(() => {

    // ==========================================
    // MODO COM DADOS SIMULADOS
    // ==========================================

    if (USAR_DADOS_SIMULADOS) {
      const pesquisa = filtro.q
        .trim()
        .toLocaleLowerCase('pt-PT');

      const encontrados = produtosSimulados.filter((p) =>
        (
          filtro.categoria === 'Todos' ||
          p.categoria === filtro.categoria
        ) &&
        (
          !filtro.bio ||
          p.biologico
        ) &&
        p.nome
          .toLocaleLowerCase('pt-PT')
          .includes(pesquisa) &&
        (
          !filtro.epoca ||
          (p.epocas || []).includes(filtro.epoca)
        ) &&
        (
          filtro.precoMax === '' ||
          p.preco <= Number(filtro.precoMax)
        )
      );

      // Ordenar por preço crescente
      if (filtro.ordenar === 'preco_asc') {
        encontrados.sort((a, b) => a.preco - b.preco);
      }

      setProdutos(encontrados);
      setErro('');
      setACarregar(false);

      return undefined;
    }

    // ==========================================
    // MODO COM API REST
    // ==========================================

    let ativo = true;

    setACarregar(true);

    // Debounce de 300 ms
    const temporizador = setTimeout(() => {
      const parametros = new URLSearchParams();

      if (filtro.q.trim()) {
        parametros.set('q', filtro.q.trim());
      }

      if (filtro.categoria !== 'Todos') {
        parametros.set('categoria', filtro.categoria);
      }

      if (filtro.bio) {
        parametros.set('bio', 'true');
      }

      if (filtro.epoca) {
        parametros.set('epoca', filtro.epoca);
      }

      if (filtro.precoMax !== '') {
        parametros.set('precoMax', filtro.precoMax);
      }

      parametros.set('ordenar', filtro.ordenar);

      api(`/products?${parametros.toString()}`)
        .then((dados) => {
          if (!ativo) return;

          setProdutos(dados);
          setErro('');
        })
        .catch((e) => {
          if (!ativo) return;

          setProdutos([]);
          setErro(e.message);
        })
        .finally(() => {
          if (ativo) {
            setACarregar(false);
          }
        });

    }, 300);

    return () => {
      ativo = false;
      clearTimeout(temporizador);
    };

  }, [filtro]);

  // Atualizar qualquer campo do filtro
  const mudar = (campo) => (e) => {
    const valor = e.target.type === 'checkbox'
      ? e.target.checked
      : e.target.value;

    setFiltro((anterior) => ({
      ...anterior,
      [campo]: valor
    }));
  };

  // Limpar todos os filtros
  const limparFiltros = () => {
    setFiltro({ ...FILTRO_INICIAL });
  };

  return (
    <>
      {/* ======================================
          DESTAQUE INICIAL
      ====================================== */}

      <section className="destaque mb-4">
        <h1>
          Direto de quem produz, para a sua mesa.
        </h1>

        <p className="texto-secundario">
          Produtores do Alto Minho. Encomende ou dispute
          os lotes da época nos leilões em direto.
        </p>


        <DestaqueLeilao />

      </section>

      {/* ======================================
          FILTROS DO CATÁLOGO
      ====================================== */}

      <section
        className="mb-4"
        aria-label="Filtros de produtos"
      >

        <div className="row g-3 align-items-end">

          {/* Pesquisa */}
          <div className="col-12 col-lg-4">
            <label
              htmlFor="pesquisa"
              className="form-label"
            >
              Pesquisar produtos
            </label>

            <input
              id="pesquisa"
              type="search"
              className="form-control"
              placeholder="Pesquisar kiwi, mel, Alvarinho…"
              value={filtro.q}
              onChange={mudar('q')}
            />
          </div>

          {/* Época */}
          <div className="col-12 col-sm-6 col-lg-3">
            <label
              htmlFor="epoca"
              className="form-label"
            >
              Época
            </label>

            <select
              id="epoca"
              className="form-select"
              value={filtro.epoca}
              onChange={mudar('epoca')}
            >
              <option value="">
                Todas as épocas
              </option>

              {EPOCAS.map((epoca) => (
                <option key={epoca} value={epoca}>
                  {epoca}
                </option>
              ))}
            </select>
          </div>

          {/* Preço máximo */}
          <div className="col-12 col-sm-6 col-lg-2">
            <label
              htmlFor="precoMax"
              className="form-label"
            >
              Preço máximo (€)
            </label>

            <input
              id="precoMax"
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              placeholder="Sem limite"
              value={filtro.precoMax}
              onChange={mudar('precoMax')}
            />
          </div>

          {/* Ordenação */}
          <div className="col-12 col-lg-3">
            <label
              htmlFor="ordenar"
              className="form-label"
            >
              Ordenar por
            </label>

            <select
              id="ordenar"
              className="form-select"
              value={filtro.ordenar}
              onChange={mudar('ordenar')}
            >
              <option value="recentes">
                Mais recentes
              </option>

              <option value="preco_asc">
                Preço: mais barato primeiro
              </option>
            </select>
          </div>

        </div>

        {/* Categorias */}
        <div
          className="d-flex flex-wrap gap-2 mt-3"
          aria-label="Categorias"
        >
          {CATEGORIAS.map((categoria) => (
            <button
              key={categoria}
              type="button"
              aria-pressed={filtro.categoria === categoria}
              className={`btn btn-sm ${
                filtro.categoria === categoria
                  ? 'btn-dark'
                  : 'btn-outline-secondary'
              }`}
              onClick={() =>
                setFiltro((anterior) => ({
                  ...anterior,
                  categoria
                }))
              }
            >
              {categoria}
            </button>
          ))}
        </div>

        {/* Biológico e limpar filtros */}
        <div className="d-flex flex-wrap align-items-center gap-3 mt-3">

          <div className="form-check mb-0">
            <input
              id="bio"
              className="form-check-input"
              type="checkbox"
              checked={filtro.bio}
              onChange={mudar('bio')}
            />

            <label
              className="form-check-label"
              htmlFor="bio"
            >
              Só biológico
            </label>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={limparFiltros}
          >
            Limpar filtros
          </button>

        </div>
      </section>

      {/* ======================================
          ESTADOS DE CARREGAMENTO E ERRO
      ====================================== */}

      {aCarregar && (
        <p role="status">
          A carregar produtos...
        </p>
      )}

      {erro && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {erro}
        </div>
      )}

      {/* ======================================
          GRELHA DOS PRODUTOS
      ====================================== */}

      {!aCarregar && !erro && (
        <>
          <section
            className="grelha-produtos"
            aria-label="Produtos"
          >
            {produtos.map((p) => (
              <CartaoProduto
                key={p._id}
                produto={p}
                onAdicionar={
                  utilizador?.papel === 'comprador'
                    ? () => carrinho.adicionar(p)
                    : undefined
                }
              />
            ))}
          </section>

          {produtos.length === 0 && (
            <p className="texto-secundario mt-3">
              Nenhum produto encontrado.
            </p>
          )}
        </>
      )}

    </>
  );
}

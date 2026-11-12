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
  produtor: '',
  localidade: '',
  ordenar: 'recentes'
};


export default function Catalogo() {
  const [produtos, setProdutos] = useState([]);
  const [produtores, setProdutores] = useState([]);
  const [erroProdutores, setErroProdutores] = useState('');
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(
    !USAR_DADOS_SIMULADOS
  );

  const carrinho = useCarrinho();
  const { utilizador } = useAuth();




  // Carregar os produtores disponíveis para os filtros
  useEffect(() => {
    if (USAR_DADOS_SIMULADOS) {
      const unicos = new Map();

      for (const produto of produtosSimulados) {
        const produtor = produto.produtor;

        if (produtor?.nome) {
          unicos.set(produtor.nome, {
            _id: produtor.nome,
            nome: produtor.nome,
            produtor: produtor.produtor || {}
          });
        }
      }

      setProdutores([...unicos.values()]);
      return undefined;
    }

    let ativo = true;

    api('/producers')
      .then((lista) => {
        if (ativo) {
          setProdutores(Array.isArray(lista) ? lista : []);
          setErroProdutores('');
        }
      })
      .catch(() => {
        if (ativo) {
          setErroProdutores(
            'Não foi possível carregar a lista de produtores.'
          );
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  // Localidades disponíveis
  const localidades = [
    ...new Set(
      produtores
        .map((p) => p.produtor?.localidade)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, 'pt'));

  // Produtores correspondentes à localidade selecionada
  const produtoresFiltrados = produtores.filter(
    (p) =>
      !filtro.localidade ||
      p.produtor?.localidade === filtro.localidade
  );



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

        (
          p.nome.toLocaleLowerCase('pt-PT').includes(pesquisa) ||
          (p.descricao || '')
            .toLocaleLowerCase('pt-PT')
            .includes(pesquisa) ||
          (p.produtor?.nome || '')
            .toLocaleLowerCase('pt-PT')
            .includes(pesquisa)
        ) &&
        (
          !filtro.produtor ||
          (p.produtor?._id || p.produtor?.nome) === filtro.produtor
        ) &&
        (
          !filtro.localidade ||
          p.produtor?.produtor?.localidade === filtro.localidade
        ) &&

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

      if (filtro.produtor) {
        parametros.set('produtor', filtro.produtor);

      }

      if (filtro.localidade) {
        parametros.set('localidade', filtro.localidade);
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



        {/* Filtros por localidade e produtor */}
        <div className="row g-3 mt-1">
          <div className="col-12 col-md-6">
            <label htmlFor="localidade" className="form-label">
              Localidade
            </label>

            <select
              id="localidade"
              className="form-select"
              value={filtro.localidade}
              onChange={(e) => {
                setFiltro((anterior) => ({
                  ...anterior,
                  localidade: e.target.value,
                  produtor: ''
                }));
              }}
            >
              <option value="">Todas as localidades</option>

              {localidades.map((localidade) => (
                <option key={localidade} value={localidade}>
                  {localidade}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6">
            <label htmlFor="produtor" className="form-label">
              Produtor
            </label>

            <select
              id="produtor"
              className="form-select"
              value={filtro.produtor}
              onChange={mudar('produtor')}
            >
              <option value="">Todos os produtores</option>

              {produtoresFiltrados.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.produtor?.nomeExploracao || p.nome}
                </option>
              ))}
            </select>
          </div>

          {erroProdutores && (
            <p className="small text-danger mb-0" role="alert">
              {erroProdutores}
            </p>
          )}
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

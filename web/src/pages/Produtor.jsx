import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import CartaoProduto from '../components/CartaoProduto.jsx';

export default function Produtor() {
  const { id } = useParams();

  // Consultar os dados reais do produtor
  const {
    dados,
    erro,
    aCarregar
  } = useApi(`/producers/${id}`);

  // Consultar avaliações públicas do produtor
  const {
    dados: dadosAvaliacoes,
    erro: erroAvaliacoes,
    aCarregar: aCarregarAvaliacoes
  } = useApi(`/reviews?produtor=${id}`);


  const { utilizador } = useAuth();
  const carrinho = useCarrinho();

  // Estado de carregamento
  if (aCarregar) {
    return (
      <p role="status">A carregar dados do produtor...</p>
    );
  }

  // Erro ao consultar a API
  if (erro) {
    return (
      <div className="alert alert-danger" role="alert">
        Não foi possível carregar o produtor: {erro}
      </div>
    );
  }

  if (!dados?.produtor) {
    return (
      <div className="alert alert-warning">
        Produtor não encontrado.
      </div>
    );
  }

  // Dados recebidos do backend
  const perfil = dados.produtor;
  const exploracao = perfil.produtor || {};
  const produtos = Array.isArray(dados.produtos)
    ? dados.produtos
    : [];

  const nomeExploracao =
    exploracao.nomeExploracao || perfil.nome;

  const localidade = exploracao.localidade;
  const descricao = exploracao.descricao;
  const avaliacaoMedia = dados.avaliacaoMedia;


  // Apenas avaliações feitas à exploração.
  // Avaliações de produtos aparecem na página de cada produto.
  const avaliacoes = Array.isArray(dadosAvaliacoes)
    ? dadosAvaliacoes.filter(avaliacao => avaliacao.produto == null)
    : [];


  // Localização para apresentar no mapa
  const coordenadas = exploracao.localizacao;

  const temCoordenadas =
    Number.isFinite(coordenadas?.lat) &&
    Number.isFinite(coordenadas?.lng);

  // Se não existirem coordenadas, mostrar a localidade
  const localizacaoMapa = temCoordenadas
    ? `${coordenadas.lat},${coordenadas.lng}`
    : localidade
      ? `${localidade}, Portugal`
      : null;

  const mapaUrl = localizacaoMapa
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        localizacaoMapa
      )}&output=embed`
    : null;

  const podeComprar = utilizador?.papel === 'comprador';

  return (
    <>
      {/* Navegação */}
      <Link
        to="/"
        className="d-inline-block mb-4 texto-secundario"
      >
        ← Voltar aos produtos
      </Link>

      {/* Apresentação do produtor */}
      <section className="mb-5">
        <div className="row g-4">

          <div className="col-12 col-lg-7">
            <h1 className="mb-3">
              {nomeExploracao}
            </h1>

            {localidade && (
              <p className="texto-secundario mb-3">
                <strong>Localidade:</strong> {localidade}
              </p>
            )}

            <div className="mb-4">
              <h2 className="h5">Sobre o produtor</h2>

              <p>
                {descricao ||
                  'Este produtor ainda não adicionou uma descrição da sua exploração.'}
              </p>
            </div>

            <div className="mb-3">
              <h2 className="h5">Avaliação média</h2>

              {Number.isFinite(avaliacaoMedia) ? (
                <p className="fs-5">
                  <strong>
                    {avaliacaoMedia.toLocaleString('pt-PT', {
                      maximumFractionDigits: 1
                    })} / 5
                  </strong>
                  <span aria-hidden="true"> ★</span>
                </p>
              ) : (
                <p className="texto-secundario">
                  Ainda não existem avaliações deste produtor.
                </p>
              )}
            </div>
          </div>

          {/* Localização em mapa */}
          <div className="col-12 col-lg-5">
            <h2 className="h5 mb-3">Localização</h2>

            {mapaUrl ? (
              <>
                <div className="card overflow-hidden">
                  <iframe
                    title={`Mapa de ${nomeExploracao}`}
                    src={mapaUrl}
                    width="100%"
                    height="280"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>

                {!temCoordenadas && (
                  <p className="texto-secundario small mt-2">
                    O mapa apresenta a localidade do
                    produtor, não a localização exata
                    da exploração.
                  </p>
                )}
              </>
            ) : (
              <p className="texto-secundario">
                Localização não disponível.
              </p>
            )}
          </div>

        </div>
      </section>



      {/* Avaliações públicas da exploração */}
      <section className="mb-5" aria-labelledby="titulo-avaliacoes">
        <h2 id="titulo-avaliacoes" className="mb-4">
          Avaliações de {nomeExploracao}
        </h2>

        {aCarregarAvaliacoes ? (
          <p role="status">A carregar avaliações...</p>
        ) : erroAvaliacoes ? (
          <div className="alert alert-danger" role="alert">
            Não foi possível carregar as avaliações: {erroAvaliacoes}
          </div>
        ) : avaliacoes.length === 0 ? (
          <p className="texto-secundario">
            Ainda não existem avaliações desta exploração.
          </p>
        ) : (
          <div className="row g-3">
            {avaliacoes.map(avaliacao => (
              <div className="col-12 col-md-6" key={avaliacao._id}>
                <article className="card h-100">
                  <div className="card-body">
                    <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                      <strong>
                        {avaliacao.autor?.nome || 'Comprador'}
                      </strong>

                      <span
                        className="text-warning"
                        aria-label={`${avaliacao.classificacao} de 5 estrelas`}
                      >
                        <span aria-hidden="true">
                          {'★'.repeat(avaliacao.classificacao)}
                          {'☆'.repeat(5 - avaliacao.classificacao)}
                        </span>
                      </span>
                    </div>

                    {avaliacao.createdAt && (
                      <p className="texto-secundario small mb-2">
                        {new Date(avaliacao.createdAt).toLocaleDateString('pt-PT')}
                      </p>
                    )}

                    <p className="mb-0">
                      {avaliacao.comentario ||
                        'Avaliação sem comentário escrito.'}
                    </p>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}
      </section>


      {/* Produtos do produtor */}
      <section aria-labelledby="titulo-produtos">
        <h2 id="titulo-produtos" className="mb-4">
          Produtos de {nomeExploracao}
        </h2>

        {produtos.length > 0 ? (
          <div className="grelha-produtos">
            {produtos.map((produto) => (
              <CartaoProduto
                key={produto._id}
                produto={produto}
                onAdicionar={
                  podeComprar
                    ? () => carrinho.adicionar(produto)
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <p className="texto-secundario">
            Este produtor ainda não tem produtos disponíveis.
          </p>
        )}
      </section>
    </>
  );
}

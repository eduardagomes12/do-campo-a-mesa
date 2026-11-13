import { Link } from 'react-router-dom';

// Formatar valores em euros
const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

export default function CartaoProduto({
  produto,
  onAdicionar
}) {
  // Dados do produtor associados ao produto
  const produtor = produto.produtor;

  const nomeProdutor =
    produtor?.produtor?.nomeExploracao ||
    produtor?.nome ||
    'Produtor não identificado';

  const localidade = produtor?.produtor?.localidade;

  // Só criar a ligação quando existir um ID real
  const produtorId = produtor?._id;

  const temPerfil =
    typeof produtorId === 'string' &&
    /^[a-f0-9]{24}$/i.test(produtorId);

  // Classe da imagem de substituição
  const classeCategoria = (produto.categoria || 'Outros')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return (
    <article className="card cartao-produto h-100">

      {/* Imagem do produto */}
      {produto.imagemUrl ? (
        <img
          src={produto.imagemUrl}
          className="card-img-top"
          alt={produto.nome}
        />
      ) : (
        <div
          className={`cartao-produto__imagem cat-${classeCategoria}`}
          aria-hidden="true"
        >
          <span>{produto.nome.charAt(0)}</span>
        </div>
      )}

      <div className="card-body d-flex flex-column">

        {/* Identificação de produto biológico */}
        {produto.biologico && (
          <span className="etiqueta-bio">
            BIO
          </span>
        )}

        {/* Nome do produto */}
        <h3 className="h6 mb-1">
          {produto.nome}
        </h3>

        {/* Nome do produtor e localidade */}
        <p className="texto-secundario small mb-2">

          {temPerfil ? (
            <Link
              to={`/produtores/${produtorId}`}
              className="text-reset text-decoration-underline"
              aria-label={`Ver perfil de ${nomeProdutor}`}
            >
              {nomeProdutor}
            </Link>
          ) : (
            <span>{nomeProdutor}</span>
          )}

          {localidade && (
            <span>
              {' · '}{localidade}
            </span>
          )}

        </p>

        {/* Preço do produto */}
        <p className="preco mt-auto">
          {euro(produto.preco)}

          <span className="texto-secundario small">
            {' / '}{produto.unidade}
          </span>
        </p>


        {/* Consultar os detalhes e as avaliações */}
        <Link
          to={`/produtos/${produto._id}`}
          className="btn btn-outline-success w-100 mb-2"
        >
          Ver detalhes e avaliações
        </Link>


        {/* Adicionar ao carrinho */}
        {onAdicionar && (
          <button
            type="button"
            className="btn btn-success w-100"
            onClick={onAdicionar}
          >
            Adicionar ao carrinho
          </button>
        )}

      </div>
    </article>
  );
}

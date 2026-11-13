import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';

const euro = (valor) =>
  Number(valor).toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  });

function Estrelas({ valor }) {
  const numero = Math.max(
    0,
    Math.min(5, Math.round(Number(valor) || 0))
  );

  return (
    <span
      className="text-warning"
      role="img"
      aria-label={`${valor} em 5 estrelas`}
    >
      <span aria-hidden="true">
        {'★'.repeat(numero)}
        {'☆'.repeat(5 - numero)}
      </span>
    </span>
  );
}

export default function Produto() {
  const { id } = useParams();

  const {
    dados: produto,
    erro: erroProduto,
    aCarregar: aCarregarProduto
  } = useApi(`/products/${id}`);

  const {
    dados: dadosAvaliacoes,
    erro: erroAvaliacoes,
    aCarregar: aCarregarAvaliacoes
  } = useApi(`/reviews?produto=${encodeURIComponent(id)}`);


    const { utilizador, token } = useAuth();

    const [denunciaEmCurso, setDenunciaEmCurso] = useState(null);
    const [resultadoDenuncia, setResultadoDenuncia] = useState({});

  const carrinho = useCarrinho();

  const avaliacoes = Array.isArray(dadosAvaliacoes)
    ? dadosAvaliacoes
    : [];

  const media = avaliacoes.length > 0
    ? avaliacoes.reduce(
        (soma, avaliacao) =>
          soma + Number(avaliacao.classificacao),
        0
      ) / avaliacoes.length
    : null;


async function denunciarAvaliacao(id) {
  if (!token || denunciaEmCurso) return;

  setDenunciaEmCurso(id);

  setResultadoDenuncia(atual => ({
    ...atual,
    [id]: null
  }));

  try {
    await api(`/reviews/${id}/denuncia`, {
      metodo: 'POST',
      token
    });

    setResultadoDenuncia(atual => ({
      ...atual,
      [id]: {
        tipo: 'sucesso',
        texto: 'Denúncia enviada ao administrador.'
      }
    }));
  } catch (err) {
    const duplicada =
      err.status === 409 &&
      err.message?.includes('Já denunciaste');

    setResultadoDenuncia(atual => ({
      ...atual,
      [id]: {
        tipo: duplicada ? 'sucesso' : 'erro',
        texto: duplicada
          ? 'Já denunciaste esta avaliação.'
          : err.message || 'Não foi possível enviar a denúncia.'
      }
    }));
  } finally {
    setDenunciaEmCurso(null);
  }
}


  if (aCarregarProduto) {
    return <p role="status">A carregar produto...</p>;
  }

  if (erroProduto || !produto) {
    return (
      <div className="alert alert-warning" role="alert">
        Produto não encontrado ou indisponível.
        <div className="mt-3">
          <Link to="/">Voltar ao catálogo</Link>
        </div>
      </div>
    );
  }

  const produtor = produto.produtor;
  const produtorId = produtor?._id;

  const nomeProdutor =
    produtor?.produtor?.nomeExploracao ||
    produtor?.nome ||
    'Produtor';

  const podeComprar =
    utilizador?.papel === 'comprador' &&
    Number(produto.stock) > 0;

  return (
    <>
      <Link
        to="/"
        className="d-inline-block mb-4 texto-secundario"
      >
        ← Voltar ao catálogo
      </Link>

      <section className="row g-4 mb-5">
        <div className="col-12 col-md-5">
          {produto.imagemUrl ? (
            <img
              src={produto.imagemUrl}
              alt={produto.nome}
              className="img-fluid rounded w-100"
              style={{ maxHeight: 380, objectFit: 'cover' }}
            />
          ) : (
            <div
              className="bg-light border rounded d-flex align-items-center justify-content-center"
              style={{ minHeight: 280 }}
              aria-hidden="true"
            >
              <span className="display-1 text-secondary">
                {produto.nome?.charAt(0)}
              </span>
            </div>
          )}
        </div>

        <div className="col-12 col-md-7">
          <span className="texto-secundario small">
            {produto.categoria}
          </span>

          <h1 className="mt-2">{produto.nome}</h1>

          {produtorId && (
            <p>
              Produzido por{' '}
              <Link to={`/produtores/${produtorId}`}>
                {nomeProdutor}
              </Link>
            </p>
          )}

          {produto.biologico && (
            <span className="badge text-bg-success mb-3">
              Produto biológico
            </span>
          )}

          <p>{produto.descricao || 'Sem descrição disponível.'}</p>

          <p className="fs-3 fw-bold">
            {euro(produto.preco)}
            <span className="fs-6 fw-normal texto-secundario">
              {' / '}{produto.unidade}
            </span>
          </p>

          <p className="texto-secundario">
            Stock disponível: {produto.stock} {produto.unidade}
          </p>

          {podeComprar && (
            <button
              type="button"
              className="btn btn-success"
              onClick={() => carrinho.adicionar(produto)}
            >
              Adicionar ao carrinho
            </button>
          )}

          {Number(produto.stock) <= 0 && (
            <p className="text-danger">
              Produto esgotado.
            </p>
          )}
        </div>
      </section>

      <section
        className="border-top pt-4 mb-5"
        aria-labelledby="titulo-avaliacoes-produto"
      >
        <h2 id="titulo-avaliacoes-produto" className="h3 mb-3">
          Avaliações dos compradores
        </h2>

        {aCarregarAvaliacoes ? (
          <p role="status">A carregar avaliações...</p>
        ) : erroAvaliacoes ? (
          <div className="alert alert-warning" role="alert">
            Não foi possível carregar as avaliações:
            {' '}{erroAvaliacoes}
          </div>
        ) : avaliacoes.length === 0 ? (
          <p className="texto-secundario">
            Ainda não existem avaliações deste produto.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <Estrelas valor={media} />
                <strong className="fs-5">
                  {media.toLocaleString('pt-PT', {
                    maximumFractionDigits: 1
                  })} / 5
                </strong>
              </div>

              <p className="texto-secundario small mt-1">
                Com base em {avaliacoes.length}{' '}
                {avaliacoes.length === 1
                  ? 'avaliação'
                  : 'avaliações'}
              </p>
            </div>

            <div className="d-flex flex-column gap-3">
              {avaliacoes.map((avaliacao) => (
                <article
                  key={avaliacao._id}
                  className="card"
                >
                  <div className="card-body">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                      <strong>
                        {avaliacao.autor?.nome || 'Comprador'}
                      </strong>

                      <Estrelas
                        valor={avaliacao.classificacao}
                      />
                    </div>

                    {avaliacao.createdAt && (
                      <p className="texto-secundario small mb-2">
                        {new Date(
                          avaliacao.createdAt
                        ).toLocaleDateString('pt-PT')}
                      </p>
                    )}

                    <p className="mb-0">
                      {avaliacao.comentario ||
                        'Avaliação sem comentário escrito.'}
                    </p>
                    
                    {utilizador?.papel === 'comprador' &&
                    String(avaliacao.autor?._id || avaliacao.autor) !==
                    String(utilizador._id || utilizador.id) && (
                        <div className="mt-3">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => denunciarAvaliacao(avaliacao._id)}
                            disabled={
                            denunciaEmCurso !== null ||
                            resultadoDenuncia[avaliacao._id]?.tipo === 'sucesso'
                            }
                        >
                            {denunciaEmCurso === avaliacao._id
                            ? 'A enviar...'
                            : resultadoDenuncia[avaliacao._id]?.tipo === 'sucesso'
                                ? 'Denunciada'
                                : 'Denunciar'}
                        </button>
                        </div>
                    )}

                    {resultadoDenuncia[avaliacao._id] && (
                    <p
                        className={
                        resultadoDenuncia[avaliacao._id].tipo === 'erro'
                            ? 'text-danger small mt-2 mb-0'
                            : 'text-success small mt-2 mb-0'
                        }
                        role={
                        resultadoDenuncia[avaliacao._id].tipo === 'erro'
                            ? 'alert'
                            : 'status'
                        }
                    >
                        {resultadoDenuncia[avaliacao._id].texto}
                    </p>
                    )}

                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

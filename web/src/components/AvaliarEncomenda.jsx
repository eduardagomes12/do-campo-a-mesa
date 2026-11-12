import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// Passo 7: avaliar produtores e produtos após a entrega.
export default function AvaliarEncomenda({
  encomenda,
  avaliacoes,
  onAvaliacaoCriada
}) {
  const { token } = useAuth();

  const [alvo, setAlvo] = useState('produtor');
  const [classificacao, setClassificacao] = useState(5);
  const [comentario, setComentario] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Avaliar o produtor e cada produto uma única vez.
  const alvos = [
    {
      chave: 'produtor',
      nome: 'Produtor',
      produto: null
    }
  ];

  const produtosAdicionados = new Set();

  for (const linha of encomenda.linhas || []) {
    if (!linha.produto) continue;

    const id = String(linha.produto);

    if (produtosAdicionados.has(id)) continue;

    produtosAdicionados.add(id);

    alvos.push({
      chave: id,
      nome: linha.nome,
      produto: id
    });
  }

  // Identificar os alvos já avaliados.
  const avaliados = new Set(
    avaliacoes.map((a) =>
      a.produto ? String(a.produto) : 'produtor'
    )
  );

  const disponiveis = alvos.filter(
    (item) => !avaliados.has(item.chave)
  );

  const selecionado =
    disponiveis.find((item) => item.chave === alvo) ||
    disponiveis[0];

  async function submeter(e) {
    e.preventDefault();

    if (!selecionado || aEnviar) return;

    setErro('');
    setSucesso('');
    setAEnviar(true);

    try {
      const dados = await api('/reviews', {
        metodo: 'POST',
        token,
        corpo: {
          encomenda: encomenda._id,
          ...(selecionado.produto
            ? { produto: selecionado.produto }
            : {}),
          classificacao,
          comentario: comentario.trim()
        }
      });

      onAvaliacaoCriada(dados);

      setClassificacao(5);
      setComentario('');
      setSucesso('Avaliação registada com sucesso!');
    } catch (err) {
      setErro(err.message);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <section className="mt-4 pt-3 border-top">
      <h3 className="h5 mb-3">Avaliações</h3>

      {/* Avaliações já realizadas nesta encomenda */}
      {avaliacoes.length > 0 && (
        <div className="mb-3">
          {avaliacoes.map((avaliacao) => {
            const chave = avaliacao.produto
              ? String(avaliacao.produto)
              : 'produtor';

            const nome = alvos.find(
              (item) => item.chave === chave
            )?.nome || 'Avaliação';

            return (
              <div
                key={avaliacao._id}
                className="border rounded p-3 mb-2"
              >
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <strong>{nome}</strong>
                  <span className="text-warning">
                    {'★'.repeat(avaliacao.classificacao)}
                    {'☆'.repeat(5 - avaliacao.classificacao)}
                  </span>
                </div>

                {avaliacao.comentario && (
                  <p className="mb-0 mt-2">
                    {avaliacao.comentario}
                  </p>
                )}

                <span className="small text-body-secondary">
                  Avaliação realizada
                </span>
              </div>
            );
          })}
        </div>
      )}

      {disponiveis.length === 0 ? (
        <div className="alert alert-success mb-0">
          Já avaliaste o produtor e todos os produtos
          desta encomenda.
        </div>
      ) : (
        <form onSubmit={submeter}>
          <div className="mb-3">
            <label
              htmlFor={`alvo-${encomenda._id}`}
              className="form-label"
            >
              O que pretendes avaliar?
            </label>

            <select
              id={`alvo-${encomenda._id}`}
              className="form-select"
              value={selecionado?.chave || ''}
              onChange={(e) => {
                setAlvo(e.target.value);
                setErro('');
                setSucesso('');
              }}
              disabled={aEnviar}
            >
              {disponiveis.map((item) => (
                <option key={item.chave} value={item.chave}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <p className="form-label mb-2">
              Classificação
            </p>

            <div
              className="d-flex flex-wrap gap-2"
              role="group"
              aria-label="Classificação de 1 a 5 estrelas"
            >
              {[1, 2, 3, 4, 5].map((estrela) => (
                <button
                  key={estrela}
                  type="button"
                  className={`btn ${
                    estrela <= classificacao
                      ? 'btn-warning'
                      : 'btn-outline-secondary'
                  }`}
                  aria-label={`${estrela} estrela${estrela > 1 ? 's' : ''}`}
                  aria-pressed={classificacao === estrela}
                  onClick={() => setClassificacao(estrela)}
                  disabled={aEnviar}
                >
                  ★
                </button>
              ))}
            </div>

            <p className="small text-body-secondary mt-2 mb-0">
              {classificacao} de 5 estrelas
            </p>
          </div>

          <div className="mb-3">
            <label
              htmlFor={`comentario-${encomenda._id}`}
              className="form-label"
            >
              Comentário (opcional)
            </label>

            <textarea
              id={`comentario-${encomenda._id}`}
              className="form-control"
              rows={3}
              maxLength={1000}
              placeholder="Como foi a tua experiência?"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              disabled={aEnviar}
            />
          </div>

          <button
            type="submit"
            className="btn btn-success"
            disabled={aEnviar}
          >
            {aEnviar
              ? 'A enviar avaliação...'
              : 'Enviar avaliação'}
          </button>
        </form>
      )}

      {erro && (
        <div className="alert alert-warning mt-3 mb-0" role="alert">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="alert alert-success mt-3 mb-0" role="status">
          {sucesso}
        </div>
      )}
    </section>
  );
}

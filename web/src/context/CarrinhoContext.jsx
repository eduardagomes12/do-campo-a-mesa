import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import { useAuth } from './AuthContext.jsx';

const CarrinhoContext = createContext(null);

// ==================================================
// RECUPERAR O CARRINHO DO UTILIZADOR
// ==================================================

// Recuperar os produtos guardados
function lerCarrinho(chave) {
  try {
    const dados = JSON.parse(localStorage.getItem(chave));
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

export function CarrinhoProvider({ children }) {
  const { utilizador } = useAuth();

  // Cada utilizador tem um carrinho independente.
  // Os visitantes também têm um carrinho próprio.
  const idUtilizador = utilizador?.id || utilizador?._id;

  const chaveCarrinho = idUtilizador
    ? `carrinho:utilizador:${idUtilizador}`
    : 'carrinho:visitante';

  // Guardar a chave juntamente com os produtos
  // evita misturar carrinhos quando muda a sessão.
  const [estado, setEstado] = useState(() => ({
    chave: chaveCarrinho,
    linhas: lerCarrinho(chaveCarrinho)
  }));

  // Se a conta mudar, ler imediatamente o carrinho
  // correspondente à nova conta.
  const linhas = estado.chave === chaveCarrinho
    ? estado.linhas
    : lerCarrinho(chaveCarrinho);

  // Atualizar apenas o carrinho da conta atual
  function definirLinhas(alteracao) {
    setEstado((anterior) => {
      const atuais = anterior.chave === chaveCarrinho
        ? anterior.linhas
        : lerCarrinho(chaveCarrinho);

      const novas = typeof alteracao === 'function'
        ? alteracao(atuais)
        : alteracao;

      return {
        chave: chaveCarrinho,
        linhas: novas
      };
    });
  }

  // Guardar o carrinho sempre que mudar
  useEffect(() => {
    // Não guardar dados de uma conta na chave de outra
    if (estado.chave !== chaveCarrinho) {
      return;
    }

    try {
      localStorage.setItem(
        chaveCarrinho,
        JSON.stringify(estado.linhas)
      );
    } catch {
      // Armazenamento indisponível
    }
  }, [estado, chaveCarrinho]);

  // ==================================================
  // ADICIONAR PRODUTOS
  // ==================================================

  // Adicionar produtos
  function adicionar(produto, quantidade = 1) {
    definirLinhas((atual) => {
      const existe = atual.find(
        (l) => l.produto._id === produto._id
      );

      if (existe) {
        return atual.map((l) =>
          l.produto._id === produto._id
            ? {
                ...l,
                quantidade: l.quantidade + quantidade
              }
            : l
        );
      }

      return [
        ...atual,
        { produto, quantidade }
      ];
    });
  }

  // ==================================================
  // ALTERAR QUANTIDADES
  // ==================================================

  // Alterar a quantidade de um produto
  function alterarQuantidade(produtoId, quantidade) {
    definirLinhas((atual) =>
      quantidade < 1
        ? atual.filter(
            (l) => l.produto._id !== produtoId
          )
        : atual.map((l) =>
            l.produto._id === produtoId
              ? { ...l, quantidade }
              : l
          )
    );
  }

  // ==================================================
  // REMOVER PRODUTOS
  // ==================================================

  // Remover um produto
  const remover = (produtoId) =>
    alterarQuantidade(produtoId, 0);

  // ==================================================
  // ESVAZIAR O CARRINHO
  // ==================================================

  // Esvaziar o carrinho
  const esvaziar = () => definirLinhas([]);

  // ==================================================
  // CALCULAR O TOTAL
  // ==================================================

  // Calcular o preço total
  const total = useMemo(
    () =>
      linhas.reduce(
        (soma, l) =>
          soma + l.produto.preco * l.quantidade,
        0
      ),
    [linhas]
  );

  return (
    <CarrinhoContext.Provider
      value={{
        linhas,
        adicionar,
        alterarQuantidade,
        remover,
        esvaziar,
        total
      }}
    >
      {children}
    </CarrinhoContext.Provider>
  );
}

export const useCarrinho = () => useContext(CarrinhoContext);

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

const CarrinhoContext = createContext(null);

// Recuperar os produtos guardados
function lerCarrinho() {
  try {
    const dados = JSON.parse(localStorage.getItem('carrinho'));
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

export function CarrinhoProvider({ children }) {
  const [linhas, setLinhas] = useState(lerCarrinho);

  // Guardar o carrinho sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem('carrinho', JSON.stringify(linhas));
    } catch {
      // Armazenamento indisponível
    }
  }, [linhas]);

  // Adicionar produtos
  function adicionar(produto, quantidade = 1) {
    setLinhas((atual) => {
      const existe = atual.find(
        (l) => l.produto._id === produto._id
      );

      if (existe) {
        return atual.map((l) =>
          l.produto._id === produto._id
            ? { ...l, quantidade: l.quantidade + quantidade }
            : l
        );
      }

      return [...atual, { produto, quantidade }];
    });
  }

  // Alterar a quantidade de um produto
  function alterarQuantidade(produtoId, quantidade) {
    setLinhas((atual) =>
      quantidade < 1
        ? atual.filter((l) => l.produto._id !== produtoId)
        : atual.map((l) =>
            l.produto._id === produtoId
              ? { ...l, quantidade }
              : l
          )
    );
  }

  // Remover um produto
  const remover = (produtoId) =>
    alterarQuantidade(produtoId, 0);

  // Esvaziar o carrinho
  const esvaziar = () => setLinhas([]);

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

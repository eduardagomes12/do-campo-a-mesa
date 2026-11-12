// Passo 7: notificações pessoais em tempo real
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import { useAuth } from '../context/AuthContext.jsx';
import { useEventoSocket } from '../context/SocketContext.jsx';

const moeda = (valor) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(valor) || 0);

export function useNotificacoes() {
  const { token } = useAuth();
  const [notificacoes, setNotificacoes] = useState([]);
  const proximoId = useRef(0);

  const mostrar = useCallback((mensagem, destino) => {
    const id = ++proximoId.current;

    setNotificacoes((anteriores) => [
      { id, mensagem, destino },
      ...anteriores
    ].slice(0, 5));
  }, []);

  const remover = useCallback((id) => {
    setNotificacoes((anteriores) =>
      anteriores.filter((n) => n.id !== id)
    );
  }, []);

  // Não mostrar notificações de uma sessão anterior.
  useEffect(() => {
    setNotificacoes([]);
  }, [token]);

  const onEncomendaAtualizada = useCallback((dados) => {
    mostrar(
      `${dados.produtor || 'O produtor'} atualizou ` +
      `a tua encomenda para "${dados.estado}".`,
      '/encomendas'
    );
  }, [mostrar]);

  const onLeilaoGanho = useCallback((dados) => {
    mostrar(
      `Ganhaste o leilão "${dados.lote}" ` +
      `por ${moeda(dados.valor)}!`,
      '/encomendas'
    );
  }, [mostrar]);

  const onLeilaoTerminado = useCallback((dados) => {
    mostrar(
      `O leilão "${dados.lote}" terminou.`,
      '/produtor'
    );
  }, [mostrar]);

  const onNovaEncomenda = useCallback((dados) => {
    mostrar(
      `Recebeste uma nova encomenda ` +
      `no valor de ${moeda(dados.total)}.`,
      '/produtor'
    );
  }, [mostrar]);

  useEventoSocket(
    'encomenda-atualizada',
    onEncomendaAtualizada
  );

  useEventoSocket('leilao-ganho', onLeilaoGanho);
  useEventoSocket('leilao-terminado', onLeilaoTerminado);
  useEventoSocket('nova-encomenda', onNovaEncomenda);

  return { notificacoes, remover };
}

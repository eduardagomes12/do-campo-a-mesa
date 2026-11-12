// Passo 7: ligação em tempo real a uma sala de leilão
import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

export function useLeilao(id, token) {
  const socket = useSocket();

  const [leilao, setLeilao] = useState(null);
  const [atual, setAtual] = useState(null);
  const [licitacoes, setLicitacoes] = useState([]);
  const [participantes, setParticipantes] = useState(0);
  const [erro, setErro] = useState('');
  const [ligado, setLigado] = useState(false);
  const [aLicitar, setALicitar] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Diferença entre o relógio do servidor e o navegador
  const [desvioMs, setDesvioMs] = useState(0);
  const [agoraMs, setAgoraMs] = useState(Date.now());

  useEffect(() => {
    const intervalo = setInterval(() => {
      setAgoraMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    setLeilao(null);
    setAtual(null);
    setLicitacoes([]);
    setParticipantes(0);
    setErro('');
    setLigado(false);
    setALicitar(false);
    setResultado(null);

    if (!socket || !id || !token) return undefined;

    function entrar() {
      setLigado(true);
      socket.emit('entrar', id);
    }

    function onEstado(dados) {
      if (
        !dados?.leilao ||
        String(dados.leilao._id) !== String(id)
      ) {
        return;
      }

      const l = dados.leilao;

      setLeilao(l);
      setAtual(l.licitacaoAtual);
      setLicitacoes(
        Array.isArray(dados.licitacoes)
          ? dados.licitacoes
          : []
      );

      const horaServidor = new Date(
        dados.agora
      ).getTime();

      if (Number.isFinite(horaServidor)) {
        setDesvioMs(horaServidor - Date.now());
      }

      setResultado(
        l.estado === 'terminado'
          ? {
              vencedor: l.licitacaoAtual?.comprador ?? null,
              valor: l.licitacaoAtual?.comprador
                ? l.licitacaoAtual.valor
                : null
            }
          : null
      );
    }

    function onNova(bid) {
      if (!bid) return;

      const licitacao = {
        valor: bid.valor,
        comprador: bid.comprador,
        nome: bid.nome,
        em: bid.createdAt
      };

      setAtual(licitacao);

      setLeilao((anterior) => anterior && ({
        ...anterior,
        licitacaoAtual: licitacao,
        numLicitacoes: bid.numLicitacoes
      }));

      setLicitacoes((anteriores) => [
        bid,
        ...anteriores.filter(
          (b) => String(b._id) !== String(bid._id)
        )
      ].slice(0, 20));
    }

    function onAberto(dados) {
      if (String(dados?.id) !== String(id)) return;

      // Pedir novamente o estado para sincronizar datas.
      socket.emit('entrar', id);
    }

    function onTerminado(dados) {
      setResultado(dados);
      setALicitar(false);

      setLeilao((anterior) => anterior && ({
        ...anterior,
        estado: 'terminado'
      }));
    }

    function onRecusada(mensagem) {
      setErro(mensagem);
      setALicitar(false);
    }

    function onErroLigacao(e) {
      setLigado(false);
      setErro(e.message);
    }

    function onDisconnect() {
      setLigado(false);
      setALicitar(false);
    }

    socket.on('connect', entrar);
    socket.on('estado', onEstado);
    socket.on('nova-licitacao', onNova);
    socket.on('presenca', setParticipantes);
    socket.on('aberto', onAberto);
    socket.on('terminado', onTerminado);
    socket.on('recusada', onRecusada);
    socket.on('connect_error', onErroLigacao);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      entrar();
    }

    return () => {
      if (socket.connected) {
        socket.emit('sair', id);
      }

      socket.off('connect', entrar);
      socket.off('estado', onEstado);
      socket.off('nova-licitacao', onNova);
      socket.off('presenca', setParticipantes);
      socket.off('aberto', onAberto);
      socket.off('terminado', onTerminado);
      socket.off('recusada', onRecusada);
      socket.off('connect_error', onErroLigacao);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket, id, token]);

  function licitar(valor) {
    setErro('');

    if (!socket?.connected) {
      setErro('Sem ligação ao servidor de leilões');
      return;
    }

    setALicitar(true);

    socket.timeout(8000).emit(
      'licitar',
      { leilaoId: id, valor },
      (falha, resposta) => {
        setALicitar(false);

        if (falha) {
          setErro(
            'Não foi possível confirmar a licitação. ' +
            'Verifica o valor atual antes de tentar novamente.'
          );
          return;
        }

        if (!resposta?.ok) {
          setErro(resposta?.erro || 'Licitação recusada');
        }
      }
    );
  }

  return {
    leilao,
    atual,
    licitacoes,
    participantes,
    erro,
    ligado,
    aLicitar,
    resultado,
    agoraServidorMs: agoraMs + desvioMs,
    licitar
  };
}

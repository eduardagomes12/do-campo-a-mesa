const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Order = require('../models/Order');

// Passo 7: ciclo automático dos leilões.
// A cada 2 segundos, abre leilões agendados e fecha os expirados.
const INTERVALO_MS = 2000;
const sala = (id) => `leilao:${id}`;

// ==========================================
// ABRIR UM LEILÃO AGENDADO
// ==========================================
async function abrirLeilao(io, id) {
  const agora = new Date();

  // A mudança só acontece se o leilão ainda estiver agendado.
  const leilao = await Auction.findOneAndUpdate(
    {
      _id: id,
      estado: 'agendado',
      iniciaEm: { $lte: agora },
      terminaEm: { $gt: agora }
    },
    { $set: { estado: 'ativo' } },
    { new: true }
  );

  if (!leilao) return null;

  io?.to(sala(leilao.id)).emit('aberto', {
    id: leilao.id
  });


   // Atualizar a lista de leilões ativos no painel admin.
   io?.to('admin:leiloes').emit('leiloes-atualizados');


  return leilao;
}

// ==========================================
// FECHAR UM LEILÃO EXPIRADO
// ==========================================
async function fecharLeilao(io, id) {
  // O encerramento e a encomenda fazem parte
  // da mesma transação MongoDB.
  const resultado = await mongoose.connection.transaction(
    async (session) => {
      const agora = new Date();

      // Apenas uma execução pode mudar este estado.
      const leilao = await Auction.findOneAndUpdate(
        {
          _id: id,
          estado: { $in: ['ativo', 'agendado'] },
          terminaEm: { $lte: agora }
        },
        { $set: { estado: 'terminado' } },
        {
          new: true,
          session
        }
      );

      if (!leilao) return null;

      const vencedor = leilao.licitacaoAtual?.comprador;
      let encomenda = null;

      // Criar a encomenda apenas se existir vencedor.
      if (vencedor) {
        const [novaEncomenda] = await Order.create(
          [{
            comprador: vencedor,
            produtor: leilao.produtor,
            linhas: [{
              produto: leilao.produto,
              nome: `Lote: ${leilao.lote}`,
              precoUnit: leilao.licitacaoAtual.valor,
              unidade: 'lote',
              quantidade: 1
            }],
            estado: 'confirmada',
            entrega: { tipo: 'levantamento' },
            origem: 'leilao',
            leilao: leilao._id
          }],
          {
            session,
            ordered: true
          }
        );

        encomenda = novaEncomenda;

        // Guardar a referência da encomenda no leilão.
        await Auction.updateOne(
          { _id: leilao._id },
          { $set: { encomenda: encomenda._id } },
          { session }
        );
      }

      return { leilao, encomenda };
    }
  );

  // Outra execução já encerrou o leilão.
  if (!resultado) return null;

  // Notificar apenas depois de a transação ter sucesso.
  const { leilao, encomenda } = resultado;
  const vencedor = leilao.licitacaoAtual?.comprador;
  const valor = vencedor
    ? leilao.licitacaoAtual.valor
    : null;

  io?.to(sala(leilao.id)).emit('terminado', {
    vencedor: vencedor ? String(vencedor) : null,
    valor
  });


  // Atualizar automaticamente o painel administrativo
  // depois do encerramento confirmado no MongoDB.
  io?.to('admin:leiloes').emit('leiloes-atualizados');


  // Informar o produtor, mesmo sem licitações.
  io?.to(`user:${leilao.produtor}`).emit(
    'leilao-terminado',
    {
      lote: leilao.lote,
      valor,
      encomenda: encomenda?._id ?? null
    }
  );

  if (vencedor && encomenda) {
    // Informar o comprador vencedor.
    io?.to(`user:${vencedor}`).emit(
      'leilao-ganho',
      {
        lote: leilao.lote,
        valor,
        encomenda: encomenda._id
      }
    );

    // Reutilizar a notificação de novas encomendas.
    io?.to(`user:${leilao.produtor}`).emit(
      'nova-encomenda',
      {
        id: encomenda._id,
        total: encomenda.total
      }
    );
  }

  return resultado;
}

// ==========================================
// ABRIR TODOS OS AGENDADOS QUE JÁ COMEÇARAM
// ==========================================
async function abrirAgendados(io) {
  const agora = new Date();

  const lista = await Auction.find({
    estado: 'agendado',
    iniciaEm: { $lte: agora },
    terminaEm: { $gt: agora }
  }).select('_id');

  for (const leilao of lista) {
    try {
      await abrirLeilao(io, leilao._id);
    } catch (err) {
      console.error(
        `Erro ao abrir leilão ${leilao.id}:`,
        err.message
      );
    }
  }
}

// ==========================================
// FECHAR TODOS OS LEILÕES EXPIRADOS
// ==========================================
async function fecharExpirados(io) {
  const agora = new Date();

  // Inclui agendados que expiraram durante uma
  // eventual interrupção do servidor.
  const lista = await Auction.find({
    estado: { $in: ['ativo', 'agendado'] },
    terminaEm: { $lte: agora }
  }).select('_id');

  for (const leilao of lista) {
    try {
      await fecharLeilao(io, leilao._id);
    } catch (err) {
      console.error(
        `Erro ao fechar leilão ${leilao.id}:`,
        err.message
      );
    }
  }
}

// ==========================================
// INICIAR O CICLO AUTOMÁTICO
// ==========================================
function iniciarCicloLeiloes(io) {
  let emExecucao = false;

  async function executar() {
    // Impedir duas verificações simultâneas
    // dentro desta instância do servidor.
    if (emExecucao) return;

    emExecucao = true;

    try {
      await fecharExpirados(io);
      await abrirAgendados(io);
    } catch (err) {
      console.error(
        'Erro no ciclo automático dos leilões:',
        err.message
      );
    } finally {
      emExecucao = false;
    }
  }

  // Verificar também imediatamente após o arranque.
  void executar();

  const temporizador = setInterval(
    () => { void executar(); },
    INTERVALO_MS
  );

  console.log('Ciclo de leilões iniciado (2 segundos)');

  // Permite desligar o ciclo em testes ou no encerramento.
  return () => clearInterval(temporizador);
}

module.exports = {
  abrirLeilao,
  fecharLeilao,
  abrirAgendados,
  fecharExpirados,
  iniciarCicloLeiloes
};
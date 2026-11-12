// Passo 7: leilões em tempo real
 // Eventos do cliente:   'entrar' (leilaoId), 'sair' (leilaoId), 'licitar' ({ leilaoId, valor })
 // Eventos do servidor:  'estado' (leilão), 'presenca' (n.º), 'nova-licitacao', 'recusada' (mensagem)
 const mongoose = require('mongoose');
 const Auction = require('../models/Auction');
 const Bid = require('../models/Bid');

 const sala = (leilaoId) => `leilao:${leilaoId}`;

 // Evitar erros de precisão com valores em euros
 const cent = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

 function emitirPresenca(io, leilaoId) {
   const n = io.sockets.adapter.rooms.get(sala(leilaoId))?.size ?? 0;
   io.to(sala(leilaoId)).emit('presenca', n);
 }

 module.exports = (io, socket) => {
   // ==========================================
   // ENTRAR NUMA SALA DE LEILÃO
   // ==========================================
   socket.on('entrar', async (leilaoId) => {
     try {
       if (!mongoose.isValidObjectId(leilaoId)) {
         socket.emit('recusada', 'Identificador de leilão inválido');
         return;
       }

       const leilao = await Auction.findById(leilaoId)
         .populate(
           'produtor',
           'nome produtor.localidade produtor.nomeExploracao'
         );

       if (!leilao) {
         socket.emit('recusada', 'Leilão não encontrado');
         return;
       }

       // Consultar as últimas 20 licitações
       const licitacoes = await Bid.find({ leilao: leilaoId })
         .sort({ createdAt: -1 })
         .limit(20);

       socket.join(sala(leilaoId));

       // "agora" permite sincronizar o relógio do cliente
       socket.emit('estado', {
         agora: new Date(),
         leilao,
         licitacoes
       });

       emitirPresenca(io, leilaoId);
     } catch (err) {
       console.error('Erro ao entrar no leilão:', err.message);
       socket.emit('recusada', 'Não foi possível entrar no leilão');
     }
   });

   // ==========================================
   // SAIR DE UMA SALA DE LEILÃO
   // ==========================================
   socket.on('sair', (leilaoId) => {
     if (!mongoose.isValidObjectId(leilaoId)) return;

     socket.leave(sala(leilaoId));
     emitirPresenca(io, leilaoId);
   });

   // ==========================================
   // LICITAR — OPERAÇÃO ATÓMICA
   // ==========================================
   socket.on('licitar', async (dados = {}, ack) => {
     const responder = typeof ack === 'function'
       ? ack
       : () => {};

     const recusar = (mensagem) => {
       socket.emit('recusada', mensagem);
       responder({ ok: false, erro: mensagem });
     };

     try {
       const { leilaoId, valor } =
         dados && typeof dados === 'object' ? dados : {};

       // Apenas compradores podem licitar
       if (socket.user.papel !== 'comprador') {
         return recusar('Apenas compradores podem licitar');
       }

       // Validar identificador
       if (!mongoose.isValidObjectId(leilaoId)) {
         return recusar('Identificador de leilão inválido');
       }

       // Validar valor monetário
       if (
         typeof valor !== 'number' ||
         !Number.isFinite(valor) ||
         valor <= 0 ||
         !Number.isSafeInteger(Math.round(valor * 100)) ||
         Math.abs(valor - cent(valor)) > 1e-8
       ) {
         return recusar('Introduz um valor válido em euros e cêntimos');
       }

       // Atualização e histórico na mesma transação.
       // Se uma operação falhar, a outra é revertida.
       const resultado = await mongoose.connection.transaction(
         async (session) => {
           const base = await Auction.findById(leilaoId)
             .select('incremento')
             .session(session);

           if (!base) return null;

           const agora = new Date();

           // Desafio central:
           // verificar o mínimo e atualizar numa ÚNICA
           // operação atómica sobre o documento Auction.
           const leilao = await Auction.findOneAndUpdate(
             {
               _id: leilaoId,
               estado: 'ativo',
               iniciaEm: { $lte: agora },
               terminaEm: { $gt: agora },
               'licitacaoAtual.valor': {
                 $lte: cent(valor - base.incremento)
               }
             },
             {
               $set: {
                 licitacaoAtual: {
                   valor: cent(valor),
                   comprador: socket.user.id,
                   nome: socket.user.nome,
                   em: agora
                 }
               },
               $inc: { numLicitacoes: 1 }
             },
             {
               new: true,
               session,
               runValidators: true
             }
           );

           if (!leilao) return null;

           // Guardar o histórico na mesma transação
           const [bid] = await Bid.create(
             [{
               leilao: leilaoId,
               comprador: socket.user.id,
               nome: socket.user.nome,
               valor: cent(valor)
             }],
             { session, ordered: true }
           );

           return {
             bid,
             numLicitacoes: leilao.numLicitacoes
           };
         }
       );

       if (!resultado) {
         // Relê os dados para explicar por que foi recusada
         const atual = await Auction.findById(leilaoId)
           .select('estado iniciaEm terminaEm licitacaoAtual incremento');

         if (!atual) {
           return recusar('Leilão não encontrado');
         }

         const agora = new Date();

         if (
           atual.estado !== 'ativo' ||
           atual.iniciaEm > agora ||
           atual.terminaEm <= agora
         ) {
           return recusar('O leilão não está ativo');
         }

         const minimo = cent(
           (atual.licitacaoAtual?.valor ?? 0) + atual.incremento
         );

         return recusar(
           `Licitação mínima: ${minimo.toFixed(2).replace('.', ',')} €`
         );
       }

       const { bid, numLicitacoes } = resultado;

        // A licitação foi guardada com sucesso.
        // Avisar os administradores para atualizarem o painel.
        io.to('admin:leiloes').emit('leiloes-atualizados');


       // Notificar todos os participantes da sala
       io.to(sala(leilaoId)).emit('nova-licitacao', {
         _id: bid._id,
         valor: bid.valor,
         comprador: socket.user.id,
         nome: socket.user.nome,
         createdAt: bid.createdAt,
         numLicitacoes
       });

       // Confirmação opcional ao cliente que licitou
       responder({
         ok: true,
         valor: bid.valor
       });
     } catch (err) {
       console.error('Erro ao licitar:', err.message);
       recusar('Não foi possível registar a licitação');
     }
   });

   // Atualizar a presença quando o utilizador fecha a página
   socket.on('disconnecting', () => {
     for (const s of socket.rooms) {
       if (s.startsWith('leilao:')) {
         setImmediate(() =>
           emitirPresenca(io, s.slice('leilao:'.length))
         );
       }
     }
   });

   // TODO: fechar os leilões expirados (estado 'terminado')
   // e avisar a sala e o vencedor — Etapa 7.3
 };

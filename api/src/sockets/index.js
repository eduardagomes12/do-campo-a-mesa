// Passo 7: autenticação dos sockets com o mesmo JWT da API
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const registarLeiloes = require('./leiloes');

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      // Token enviado pelo cliente durante a ligação
      const token = socket.handshake.auth?.token;

      // Confirmar assinatura e validade do JWT
      const dados = jwt.verify(token, process.env.JWT_SECRET);

      if (!dados.id) {
        throw new Error('Token sem identificador');
      }


      // Confirmar que o utilizador ainda existe
      const utilizador = await User.findById(dados.id)
        .select('nome papel produtor.validado produtor.rejeitado');

      if (!utilizador) {
        throw new Error('Utilizador inexistente');
      }

      // Impedir novas ligações de produtores não aprovados
      if (
        utilizador.papel === 'produtor' &&
        (
          utilizador.produtor?.rejeitado ||
          !utilizador.produtor?.validado
        )
      ) {
        return next(new Error('não autorizado'));
      }



      // Dados disponíveis nos eventos Socket.io
      socket.user = {
        id: utilizador.id,
        nome: utilizador.nome,
        papel: utilizador.papel
      };

      next();
    } catch {
      next(new Error('não autorizado'));
    }
  });

  io.on('connection', (socket) => {
    // Sala pessoal: permite notificar este utilizador
    // (ex.: estado da encomenda)
    socket.join(`user:${socket.user.id}`);

    // Sala exclusiva dos administradores.
    // Permite receber atualizações globais dos leilões.
    if (socket.user.papel === 'admin') {
      socket.join('admin:leiloes');
    }

    // Registar eventos dos leilões
    registarLeiloes(io, socket);
  });
};

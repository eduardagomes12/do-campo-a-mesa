const { Schema, model, Types } = require('mongoose');

// Modelo de uma licitação realizada num leilão
const bidSchema = new Schema({

  // Leilão ao qual pertence a licitação
  leilao: {
    type: Types.ObjectId,
    ref: 'Auction',
    required: true,
    index: true
  },

  // Comprador que realizou a licitação
  comprador: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Cópia do nome do comprador para o histórico
  nome: String,

  // Valor oferecido na licitação
  valor: {
    type: Number,
    required: true
  }

}, { timestamps: true });

module.exports = model('Bid', bidSchema);

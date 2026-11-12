const { Schema, model, Types } = require('mongoose');

// Modelo dos leilões
const auctionSchema = new Schema({

  // Produtor responsável pelo leilão
  produtor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Produto associado ao leilão
  produto: {
    type: Types.ObjectId,
    ref: 'Product'
  },

  // Identificação e descrição do lote
  lote: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },

  descricao: {
    type: String,
    maxlength: 1000
  },

  quantidade: String,

  // Valores do leilão
  precoBase: {
    type: Number,
    required: true,
    min: 0
  },

  incremento: {
    type: Number,
    required: true,
    min: 0.01
  },

  // Licitação atual embebida no leilão
  licitacaoAtual: {
    valor: Number,

    comprador: {
      type: Types.ObjectId,
      ref: 'User'
    },

    nome: String,
    em: Date
  },

  // Número total de licitações
  numLicitacoes: {
    type: Number,
    default: 0
  },

  // Datas de início e fim
  iniciaEm: {
    type: Date,
    required: true
  },

  terminaEm: {
    type: Date,
    required: true,
    index: true
  },

  // Estado do leilão
  estado: {
    type: String,
    enum: ['agendado', 'ativo', 'terminado'],
    default: 'agendado',
    index: true
  },

  // Encomenda criada para o vencedor
  encomenda: {
    type: Types.ObjectId,
    ref: 'Order'
  }

}, { timestamps: true });

module.exports = model('Auction', auctionSchema);

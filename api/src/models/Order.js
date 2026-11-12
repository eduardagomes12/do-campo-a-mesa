const { Schema, model, Types } = require('mongoose');

const ESTADOS = [
  'pendente',
  'confirmada',
  'pronta',
  'entregue'
];

const orderSchema = new Schema({
  comprador: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  produtor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Linhas embebidas na encomenda
  linhas: {
    type: [{
      produto: {
        type: Types.ObjectId,
        ref: 'Product'
      },
      nome: {
        type: String,
        required: true
      },
      precoUnit: {
        type: Number,
        required: true,
        min: 0
      },
      unidade: String,
      quantidade: {
        type: Number,
        required: true,
        min: 1
      }
    }],
    validate: [
      (v) => v.length > 0,
      'A encomenda tem de ter pelo menos uma linha'
    ]
  },

  estado: {
    type: String,
    enum: ESTADOS,
    default: 'pendente'
  },

  entrega: {
    tipo: {
      type: String,
      enum: ['levantamento', 'entrega'],
      default: 'levantamento'
    },
    morada: String
  },

  origem: {
    type: String,
    enum: ['loja', 'leilao'],
    default: 'loja'
  },

  leilao: {
    type: Types.ObjectId,
    ref: 'Auction'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Total calculado a partir das linhas
orderSchema.virtual('total').get(function total() {
  return Math.round(
    this.linhas.reduce(
      (s, l) => s + l.precoUnit * l.quantidade,
      0
    ) * 100
  ) / 100;
});

orderSchema.statics.ESTADOS = ESTADOS;

module.exports = model('Order', orderSchema);

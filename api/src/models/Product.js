const { Schema, model, Types } = require('mongoose');

// Modelo dos produtos disponibilizados pelos produtores
const productSchema = new Schema({
  // Referência ao produtor
  produtor: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Nome do produto
  nome: {
    type: String,
    required: true,
    trim: true
  },

  // Descrição do produto
  descricao: {
    type: String,
    trim: true
  },

  // Categoria do produto
  categoria: {
    type: String,
    enum: [
      'Hortícolas',
      'Fruta',
      'Mel',
      'Vinho',
      'Queijo',
      'Padaria',
      'Outros'
    ],
    required: true
  },

  // Preço do produto
  preco: {
    type: Number,
    required: true,
    min: 0
  },

  // Unidade de venda
  unidade: {
    type: String,
    default: 'kg'
  },

  // Quantidade disponível
  stock: {
    type: Number,
    default: 0,
    min: 0
  },

  // Identificação de produto biológico
  biologico: {
    type: Boolean,
    default: false
  },

  // Épocas de disponibilidade
  epocas: [{
    type: String,
    enum: [
      'Primavera',
      'Verão',
      'Outono',
      'Inverno'
    ]
  }],

  // Imagem do produto (Passo 8)
  imagemUrl: String

}, { timestamps: true });

// Índice para consultas dos produtos de um produtor
productSchema.index({
  produtor: 1,
  createdAt: -1
});

// Índice para filtros por categoria e preço
productSchema.index({
  categoria: 1,
  preco: 1
});

module.exports = model('Product', productSchema);

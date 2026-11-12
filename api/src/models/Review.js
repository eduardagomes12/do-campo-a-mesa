// Passo 4 — Decisão de modelação:
// As avaliações são armazenadas numa coleção própria (reviews).
// Esta abordagem permite consultar avaliações por produtor ou produto,
// moderá-las individualmente e evitar o crescimento dos documentos
// de produtos e produtores. As relações são feitas por referências ObjectId.

const { Schema, model, Types } = require('mongoose');

const reviewSchema = new Schema({
  autor: { type: Types.ObjectId, ref: 'User', required: true },
  produtor: { type: Types.ObjectId, ref: 'User', required: true },
  produto: { type: Types.ObjectId, ref: 'Product' },
  encomenda: { type: Types.ObjectId, ref: 'Order' },
  classificacao: { type: Number, min: 1, max: 5, required: true },
  comentario: String,
  denuncias: { type: Number, default: 0 },
  visivel: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = model('Review', reviewSchema);

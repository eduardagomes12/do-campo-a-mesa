// Passo 3: recurso /api/reviews

const router = require('express').Router();
const Review = require('../models/Review');
const auth = require('../middleware/auth');
const a = require('../utils/async');
const Order = require('../models/Order');
const erro = require('../utils/erro');

// POST /api/reviews
// Criar avaliação após uma encomenda entregue

router.post('/', auth('comprador'), a(async (req, res) => {
  const {
    encomenda,
    produto,
    classificacao,
    comentario
  } = req.body || {};

  // Validar os dados obrigatórios
  if (!encomenda ||
      !Number.isInteger(classificacao) ||
      classificacao < 1 ||
      classificacao > 5) {
    throw erro(400, 'Dados da avaliação inválidos');
  }

  // A encomenda tem de pertencer ao comprador
  const o = await Order.findOne({
    _id: encomenda,
    comprador: req.user.id
  });

  if (!o) {
    throw erro(404, 'Encomenda não encontrada');
  }

  // Só pode avaliar após a entrega
  if (o.estado !== 'entregue') {
    throw erro(409, 'A encomenda ainda não foi entregue');
  }

  // Se avaliar um produto, tem de pertencer à encomenda
  if (produto && !o.linhas.some(
    (l) => l.produto?.toString() === produto
  )) {
    throw erro(400, 'Produto não pertence à encomenda');
  }

  // Criar a avaliação
  const avaliacao = await Review.create({
    autor: req.user.id,
    produtor: o.produtor,
    produto,
    encomenda: o._id,
    classificacao,
    comentario
  });

  res.status(201).json(avaliacao);
}));


// GET /api/reviews?produtor=&produto=
// Listar avaliações visíveis
router.get('/', a(async (req, res) => {
  const { produtor, produto } = req.query;

  const filtro = {
    visivel: true
  };

  if (produtor) {
    filtro.produtor = produtor;
  }

  if (produto) {
    filtro.produto = produto;
  }

  const avaliacoes = await Review.find(filtro)
    .sort({ createdAt: -1 })
    .populate('autor', 'nome');

  res.json(avaliacoes);
}));

// POST /api/reviews/:id/denuncia
// Denunciar avaliação

router.post('/:id/denuncia', auth(), a(async (req, res) => {
  const avaliacao = await Review.findByIdAndUpdate(
    req.params.id,
    { $inc: { denuncias: 1 } },
    { new: true }
  );

  if (!avaliacao) {
    throw erro(404, 'Avaliação não encontrada');
  }

  res.status(204).end();
}));


module.exports = router;

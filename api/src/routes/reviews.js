// Passo 3: recurso /api/reviews

const router = require('express').Router();
const { isValidObjectId } = require('mongoose');
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
  if (
    !encomenda ||
    !isValidObjectId(encomenda) ||
    !Number.isInteger(classificacao) ||
    classificacao < 1 ||
    classificacao > 5
  ) {
    throw erro(400, 'Dados da avaliação inválidos');
  }

  // Validar o produto, quando indicado
  if (
    produto != null &&
    !isValidObjectId(produto)
  ) {
    throw erro(400, 'Produto inválido');
  }

  // Validar o comentário
  if (
    comentario != null &&
    (
      typeof comentario !== 'string' ||
      comentario.length > 1000
    )
  ) {
    throw erro(400, 'Comentário inválido');
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
  if (
    produto &&
    !o.linhas.some(
      (l) => String(l.produto) === String(produto)
    )
  ) {
    throw erro(400, 'Produto não pertence à encomenda');
  }

  // Não permitir avaliar duas vezes o mesmo alvo
  // dentro da mesma encomenda.
  const jaExiste = await Review.exists({
    autor: req.user.id,
    encomenda: o._id,
    produto: produto || null
  });

  if (jaExiste) {
    throw erro(409, 'Já avaliaste este produto ou produtor nesta encomenda');
  }

  // Criar a avaliação
  try {
    const avaliacao = await Review.create({
      autor: req.user.id,
      produtor: o.produtor,
      produto: produto || undefined,
      encomenda: o._id,
      classificacao,
      comentario: comentario?.trim()
    });

    return res.status(201).json(avaliacao);
  } catch (err) {
    // O índice único também protege contra pedidos simultâneos.
    if (err.code === 11000) {
      throw erro(
        409,
        'Já avaliaste este produto ou produtor nesta encomenda'
      );
    }

    throw err;
  }
}));


// GET /api/reviews/minhas?encomenda=
// Consultar as avaliações do comprador autenticado
router.get('/minhas', auth('comprador'), a(async (req, res) => {
  const { encomenda } = req.query;

  if (encomenda && !isValidObjectId(encomenda)) {
    throw erro(400, 'Identificador de encomenda inválido');
  }

  const filtro = {
    autor: req.user.id
  };

  if (encomenda) {
    filtro.encomenda = encomenda;
  }

  const avaliacoes = await Review.find(filtro)
    .sort({ createdAt: -1 });

  res.json(avaliacoes);
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
 // Cada comprador só pode denunciar uma avaliação uma vez.
 router.post('/:id/denuncia', auth('comprador'), a(async (req, res) => {
   if (!isValidObjectId(req.params.id)) {
     throw erro(400, 'Identificador da avaliação inválido');
   }

   const avaliacao = await Review.findOneAndUpdate(
     {
       _id: req.params.id,
       visivel: true,
       autor: { $ne: req.user.id },
       denunciadoPor: { $ne: req.user.id }
     },
     {
       $addToSet: { denunciadoPor: req.user.id },
       $inc: { denuncias: 1 }
     },
     { new: true }
   );

   if (avaliacao) {
     return res.status(204).end();
   }

   const existente = await Review.findById(req.params.id);

   if (!existente) {
     throw erro(404, 'Avaliação não encontrada');
   }

   if (String(existente.autor) === String(req.user.id)) {
     throw erro(403, 'Não podes denunciar a tua própria avaliação');
   }

   if (existente.visivel === false) {
     throw erro(409, 'Avaliação indisponível');
   }

   throw erro(409, 'Já denunciaste esta avaliação');
 }));

module.exports = router;

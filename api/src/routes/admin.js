// Painel do administrador
const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const a = require('../utils/async');
const erro = require('../utils/erro');
const Review = require('../models/Review');


router.use(auth('admin'));

// GET /api/admin/estatisticas  -> 200 { utilizadores, produtores, encomendasHoje, leiloesAtivos }

router.get('/estatisticas', a(async (req, res) => {

  // Início do dia atual
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  // Consultar os totais no MongoDB
  const [
    utilizadores,
    produtores,
    encomendasHoje,
    leiloesAtivos
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ papel: 'produtor' }),
    Order.countDocuments({
      createdAt: { $gte: inicioHoje }
    }),
    Auction.countDocuments({ estado: 'ativo' })
  ]);

  res.json({
    utilizadores,
    produtores,
    encomendasHoje,
    leiloesAtivos
  });
}));


// GET /api/admin/produtores/pendentes  -> 200 [produtores por validar]

router.get('/produtores/pendentes', a(async (req, res) => {
  const produtores = await User.find({
    papel: 'produtor',
    'produtor.validado': false
  })
    .select('nome email produtor createdAt')
    .sort({ createdAt: -1 });

  res.json(produtores);
}));


// PATCH /api/admin/produtores/:id/validacao  { aprovado: true|false }  -> 200

router.patch('/produtores/:id/validacao', a(async (req, res) => {
  const { aprovado } = req.body || {};

  // O campo aprovado deve ser true ou false
  if (typeof aprovado !== 'boolean') {
    throw erro(400, 'O campo aprovado deve ser booleano');
  }

  // Procurar o produtor e atualizar a validação
  const produtor = await User.findOneAndUpdate(
    {
      _id: req.params.id,
      papel: 'produtor'
    },
    {
      $set: { 'produtor.validado': aprovado }
    },
    {
      new: true,
      runValidators: true
    }
  ).select('nome email produtor');

  if (!produtor) {
    throw erro(404, 'Produtor não encontrado');
  }

  res.json(produtor);
}));


// GET /api/admin/reviews/denunciadas  -> 200

router.get('/reviews/denunciadas', a(async (req, res) => {
  const avaliacoes = await Review.find({
    denuncias: { $gt: 0 }
  })
    .sort({ denuncias: -1, createdAt: -1 })
    .populate('autor', 'nome')
    .populate('produtor', 'nome produtor.nomeExploracao');

  res.json(avaliacoes);
}));


// PATCH /api/admin/reviews/:id  { visivel: false }  -> 200
router.patch('/reviews/:id', a(async (req, res) => {
  const { visivel } = req.body || {};

  // Validar o campo recebido
  if (typeof visivel !== 'boolean') {
    throw erro(400, 'O campo visivel deve ser booleano');
  }

  // Atualizar a visibilidade da avaliação
  const avaliacao = await Review.findByIdAndUpdate(
    req.params.id,
    {
      $set: { visivel }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!avaliacao) {
    throw erro(404, 'Avaliação não encontrada');
  }

  res.json(avaliacao);
}));

module.exports = router;

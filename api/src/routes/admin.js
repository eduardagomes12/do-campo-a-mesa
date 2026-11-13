// Painel do administrador

const router = require('express').Router();

const auth = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Review = require('../models/Review');

const a = require('../utils/async');
const erro = require('../utils/erro');
const Product = require('../models/Product');

// Todas as rotas exigem administrador autenticado
router.use(auth('admin'));

// ==========================================
// GET /api/admin/estatisticas
// ==========================================

router.get('/estatisticas', a(async (req, res) => {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const [
    utilizadores,
    produtores,
    encomendasHoje,
    leiloesAtivos
  ] = await Promise.all([
    User.countDocuments(),

    User.countDocuments({
      papel: 'produtor'
    }),

    Order.countDocuments({
      createdAt: { $gte: inicioHoje }
    }),

    Auction.countDocuments({
      estado: 'ativo'
    })
  ]);

  res.json({
    utilizadores,
    produtores,
    encomendasHoje,
    leiloesAtivos
  });
}));

// ==========================================
// GET /api/admin/produtores/pendentes
// ==========================================

router.get('/produtores/pendentes', a(async (req, res) => {
  const produtores = await User.find({
    papel: 'produtor',

    // Ainda não aprovados
    'produtor.validado': false,

    // Excluir os que já foram rejeitados
    'produtor.rejeitado': { $ne: true }
  })
    .select('nome email produtor createdAt')
    .sort({ createdAt: -1 });

  res.json(produtores);
}));

// ==========================================
// PATCH /api/admin/produtores/:id/validacao
// Corpo: { aprovado: true | false }
// ==========================================

router.patch('/produtores/:id/validacao', a(async (req, res) => {
  const { aprovado } = req.body || {};

  if (typeof aprovado !== 'boolean') {
    throw erro(
      400,
      'O campo aprovado deve ser booleano'
    );
  }

  const produtor = await User.findOneAndUpdate(
    {
      _id: req.params.id,
      papel: 'produtor'
    },
    {
      $set: {
        // Aprovar
        'produtor.validado': aprovado,

        // Rejeitar quando aprovado === false
        'produtor.rejeitado': !aprovado
      }
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

// ==========================================
// GET /api/admin/reviews/denunciadas
// ==========================================

router.get('/reviews/denunciadas', a(async (req, res) => {
  const avaliacoes = await Review.find({
    denuncias: { $gt: 0 }
  })
    .sort({
      denuncias: -1,
      createdAt: -1
    })
    .populate('autor', 'nome')
    .populate(
      'produtor',
      'nome produtor.nomeExploracao'
    );

  res.json(avaliacoes);
}));

// ==========================================
// PATCH /api/admin/reviews/:id
// Corpo: { visivel: true | false }
// ==========================================

router.patch('/reviews/:id', a(async (req, res) => {
  const { visivel } = req.body || {};

  if (typeof visivel !== 'boolean') {
    throw erro(
      400,
      'O campo visivel deve ser booleano'
    );
  }

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



// ==========================================
// GET /api/admin/produtos
// Consultar produtos para moderação
// ==========================================

router.get('/produtos', a(async (req, res) => {
  const produtos = await Product.find()
    .sort({ createdAt: -1 })
    .populate(
      'produtor',
      'nome produtor.nomeExploracao'
    );

  res.json(produtos);
}));

// ==========================================
// PATCH /api/admin/produtos/:id/visibilidade
// Ocultar ou voltar a publicar um produto
// ==========================================

router.patch('/produtos/:id/visibilidade', a(async (req, res) => {
  const { visivel } = req.body || {};

  if (typeof visivel !== 'boolean') {
    throw erro(
      400,
      'O campo visivel deve ser booleano'
    );
  }

  const produto = await Product.findByIdAndUpdate(
    req.params.id,
    {
      $set: { visivel }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!produto) {
    throw erro(404, 'Produto não encontrado');
  }

  res.json(produto);
}));

module.exports = router;
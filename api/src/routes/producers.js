// Passo 3: páginas públicas dos produtores

const router = require('express').Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const a = require('../utils/async');
const erro = require('../utils/erro');

// GET /api/producers?localidade=
// Listar produtores validados
router.get('/', a(async (req, res) => {
  const { localidade } = req.query;

  const filtro = {
    papel: 'produtor',
    'produtor.validado': true
  };

  if (localidade) {
    filtro['produtor.localidade'] = localidade;
  }

  const produtores = await User.find(filtro)
    .select('nome produtor');

  res.json(produtores);
}));

// GET /api/producers/:id
// Página pública de um produtor
router.get('/:id', a(async (req, res) => {

  // Procurar produtor validado
  const produtor = await User.findOne({
    _id: req.params.id,
    papel: 'produtor',
    'produtor.validado': true
  }).select('nome produtor');

  if (!produtor) {
    throw erro(404, 'Produtor não encontrado');
  }

  // Obter os produtos do produtor
  const produtos = await Product.find({
    produtor: produtor._id
  }).populate(
    'produtor',
    'nome produtor.localidade produtor.nomeExploracao'
  );

  // Obter as avaliações visíveis do produtor
  const avaliacoes = await Review.find({
    produtor: produtor._id,
    visivel: true
  }).select('classificacao');

  // Calcular a classificação média
  const avaliacaoMedia = avaliacoes.length
    ? Math.round(
        avaliacoes.reduce(
          (soma, av) => soma + av.classificacao, 0
        ) / avaliacoes.length * 10
      ) / 10
    : null;

  res.json({
    produtor,
    produtos,
    avaliacaoMedia
  });
}));

module.exports = router;

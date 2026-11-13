// Passo 3: páginas públicas dos produtores

const router = require('express').Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const a = require('../utils/async');
const erro = require('../utils/erro');
const auth = require('../middleware/auth');




// PATCH /api/producers/me
// Atualizar os dados públicos da própria exploração.
router.patch('/me', auth('produtor'), a(async (req, res) => {
  const dados = req.body;

  if (!dados || typeof dados !== 'object' ||
      Array.isArray(dados) || !Object.keys(dados).length) {
    throw erro(400, 'Dados de atualização inválidos');
  }

  const permitidos = [
    'nomeExploracao',
    'descricao',
    'localidade',
    'localizacao'
  ];

  if (Object.keys(dados).some(c => !permitidos.includes(c))) {
    throw erro(400, 'Campo não permitido');
  }

  const alteracoes = {};
  const limites = {
    nomeExploracao: 150,
    descricao: 1000,
    localidade: 100
  };

  for (const campo of Object.keys(limites)) {
    if (!Object.prototype.hasOwnProperty.call(dados, campo)) {
      continue;
    }

    if (typeof dados[campo] !== 'string') {
      throw erro(400, `Campo ${campo} inválido`);
    }

    const valor = dados[campo].trim();

    if (campo !== 'descricao' && !valor) {
      throw erro(400, `O campo ${campo} é obrigatório`);
    }

    if (valor.length > limites[campo]) {
      throw erro(400, `O campo ${campo} é demasiado longo`);
    }

    alteracoes[`produtor.${campo}`] = valor;
  }

  // Coordenadas opcionais para o mapa da exploração.
  let limparLocalizacao = false;

  if (Object.prototype.hasOwnProperty.call(dados, 'localizacao')) {
    const localizacao = dados.localizacao;

    if (localizacao === null) {
      limparLocalizacao = true;
    } else {
      if (
        !localizacao ||
        typeof localizacao !== 'object' ||
        Array.isArray(localizacao) ||
        Object.keys(localizacao).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(localizacao, 'lat') ||
        !Object.prototype.hasOwnProperty.call(localizacao, 'lng')
      ) {
        throw erro(400, 'Localização inválida');
      }

      const { lat, lng } = localizacao;

      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 || lat > 90 ||
        lng < -180 || lng > 180
      ) {
        throw erro(400, 'Coordenadas inválidas');
      }

      alteracoes['produtor.localizacao'] = { lat, lng };
    }
  }

  const atualizacao = { $set: alteracoes };

  if (limparLocalizacao) {
    atualizacao.$unset = { 'produtor.localizacao': 1 };
  }

  const produtor = await User.findOneAndUpdate(
    {
      _id: req.user.id,
      papel: 'produtor'
    },
    atualizacao,
    { new: true, runValidators: true }
  );

  if (!produtor) {
    throw erro(404, 'Produtor não encontrado');
  }

  res.json(produtor.publico());
}));


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
    produtor: produtor._id,
    visivel: { $ne: false }
  }).populate(
    'produtor',
    'nome produtor.localidade produtor.nomeExploracao'
  );

  // Apenas avaliações feitas à exploração.
  // As avaliações de produtos são independentes.
  const avaliacoes = await Review.find({
    produtor: produtor._id,
    produto: null,
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

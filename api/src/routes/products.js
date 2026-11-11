
 // Passo 3: recurso /api/products

const router = require('express').Router();
const multer = require('multer');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');
const a = require('../utils/async');
const erro = require('../utils/erro');
const produtorValidado = require('../middleware/produtorValidado');

// Configuração do upload de imagens
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Proteger a pesquisa contra caracteres especiais
const escaparRegex = (t) =>
  t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Ordenação dos produtos
const ORDENACAO = {
  recentes: { createdAt: -1 },
  preco_asc: { preco: 1 }
};

// Campos que o produtor pode criar ou alterar
const CAMPOS = [
  'nome',
  'descricao',
  'categoria',
  'preco',
  'unidade',
  'stock',
  'biologico',
  'epocas'
];

// Selecionar apenas os campos permitidos
const escolher = (obj) =>
  Object.fromEntries(
    CAMPOS
      .filter((c) => obj[c] !== undefined)
      .map((c) => [c, obj[c]])
  );


// ==================================================
// GET /api/products
// Listar produtos com pesquisa e filtros
// ==================================================

router.get('/', a(async (req, res) => {
  const {
    q,
    categoria,
    precoMax,
    bio,
    epoca,
    produtor,
    ordenar
  } = req.query;

  const filtro = {};

  // Pesquisa por nome
  if (q) {
    filtro.nome = {
      $regex: escaparRegex(q),
      $options: 'i'
    };
  }

  // Filtrar por categoria
  if (categoria && categoria !== 'Todos') {
    filtro.categoria = categoria;
  }

  // Filtrar por preço máximo
  if (precoMax) {
    filtro.preco = { $lte: Number(precoMax) };
  }

  // Filtrar produtos biológicos
  if (bio === 'true') {
    filtro.biologico = true;
  }

  // Filtrar por época
  if (epoca) {
    filtro.epocas = { $in: [epoca] };
  }

  // Filtrar por produtor
  if (produtor) {
    filtro.produtor = produtor;
  }

  // Consultar os produtos no MongoDB
  const lista = await Product.find(filtro)
    .sort(ORDENACAO[ordenar] || ORDENACAO.recentes)
    .populate(
      'produtor',
      'nome produtor.localidade produtor.nomeExploracao'
    );

  res.json(lista);
}));


// ==================================================
// GET /api/products/:id
// Consultar um produto pelo identificador
// ==================================================

router.get('/:id', a(async (req, res) => {
  const produto = await Product.findById(req.params.id)
    .populate(
      'produtor',
      'nome produtor.localidade produtor.nomeExploracao'
    );

  if (!produto) {
    throw erro(404, 'Produto não encontrado');
  }

  res.json(produto);
}));


// ==================================================
// POST /api/products
// Criar produto (produtor autenticado e validado)
// ==================================================

router.post(
  '/',
  auth('produtor'),
  produtorValidado,
  a(async (req, res) => {

    const p = await Product.create({
      ...escolher(req.body),
      produtor: req.user.id
    });

    res.status(201)
      .location(`/api/products/${p._id}`)
      .json(p);
  })
);


// ==================================================
// PUT /api/products/:id
// Atualizar produto (produtor dono)
// Ainda por implementar
// ==================================================


router.put('/:id', auth('produtor'), a(async (req, res) => {
  const p = await Product.findOneAndUpdate(
    {
      _id: req.params.id,
      produtor: req.user.id
    },
    escolher(req.body),
    {
      new: true,
      runValidators: true
    }
  );

  if (!p) {
    throw erro(404, 'Produto não encontrado');
  }

  res.json(p);
}));


// ==================================================
// DELETE /api/products/:id
// Remover produto (produtor dono)
// Ainda por implementar
// ==================================================


router.delete('/:id', auth('produtor'), a(async (req, res) => {
  const r = await Product.deleteOne({
    _id: req.params.id,
    produtor: req.user.id
  });

  if (!r.deletedCount) {
    throw erro(404, 'Produto não encontrado');
  }

  res.status(204).end();
}));



// ==================================================
// POST /api/products/:id/imagem
// Upload da imagem do produto
// Passo 8: armazenamento na Cloud
// ==================================================

router.post(
  '/:id/imagem',
  auth('produtor'),
  upload.single('imagem'),
  porFazer('Upload da imagem do produto')
);


module.exports = router;

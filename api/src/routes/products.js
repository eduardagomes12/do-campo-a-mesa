// Passo 3: recurso /api/products

const router = require('express').Router();
const multer = require('multer');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { guardarImagem } = require('../services/imagens');
const a = require('../utils/async');
const erro = require('../utils/erro');
const produtorValidado = require('../middleware/produtorValidado');
const mongoose = require('mongoose');
const User = require('../models/User');

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

const escolher = (obj) => {
  // Garantir que trabalhamos sempre com um objeto válido
  const dados =
    obj &&
    typeof obj === 'object' &&
    !Array.isArray(obj)
      ? obj
      : {};

  // Copiar apenas os campos permitidos
  return Object.fromEntries(
    CAMPOS
      .filter((campo) => dados[campo] !== undefined)
      .map((campo) => [campo, dados[campo]])
  );
};



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
    localidade,
    ordenar
  } = req.query;

  const filtro = {};

  // Os produtos ocultados pelo administrador não são públicos.
  // $ne: false também inclui os produtos antigos sem este campo.
  filtro.visivel = { $ne: false };

  // Pesquisa por nome ou descrição do produto
  // e nome do produtor ou da exploração.
  if (q) {
    if (typeof q !== 'string' || q.length > 100) {
      throw erro(400, 'Pesquisa inválida (máximo 100 caracteres)');
    }

    const termo = q.trim();

    if (termo) {
      const regex = new RegExp(escaparRegex(termo), 'i');

      const produtoresEncontrados = await User.find({
        papel: 'produtor',
        'produtor.validado': true,
        $or: [
          { nome: regex },
          { 'produtor.nomeExploracao': regex }
        ]
      }).select('_id');

      filtro.$or = [
        { nome: regex },
        { descricao: regex },
        {
          produtor: {
            $in: produtoresEncontrados.map((u) => u._id)
          }
        }
      ];
    }
  }

  // Filtrar por categoria
  if (categoria && categoria !== 'Todos') {
    filtro.categoria = categoria;
  }

  // Filtrar por preço máximo
  if (precoMax) {
    const valor = Number(precoMax);

    if (!Number.isFinite(valor) || valor < 0) {
      throw erro(400, 'Preço máximo inválido');
    }

    filtro.preco = { $lte: valor };
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
    if (
      typeof produtor !== 'string' ||
      !mongoose.isValidObjectId(produtor)
    ) {
      throw erro(400, 'Identificador de produtor inválido');
    }

    filtro.produtor = produtor;
  }

  // Filtrar por localidade da exploração
  if (localidade) {
    if (
      typeof localidade !== 'string' ||
      localidade.length > 100 ||
      !localidade.trim()
    ) {
      throw erro(400, 'Localidade inválida');
    }

    const produtoresDaLocalidade = await User.find({
      papel: 'produtor',
      'produtor.validado': true,
      'produtor.localidade': {
        $regex: `^${escaparRegex(localidade.trim())}$`,
        $options: 'i'
      }
    }).select('_id');

    const ids = produtoresDaLocalidade.map((u) => u._id);

    // Se forem usados ambos os filtros,
    // o produtor tem de pertencer à localidade.
    filtro.produtor = produtor
      ? (
          ids.some((id) => String(id) === produtor)
            ? produtor
            : { $in: [] }
        )
      : { $in: ids };
  }


  // Apenas mostrar produtos de produtores aprovados.
  // Esta condição mantém os restantes filtros do catálogo.
  const idsAprovados = await User.distinct('_id', {
    papel: 'produtor',
    'produtor.validado': true,
    'produtor.rejeitado': { $ne: true }
  });

  filtro.$and = [
    { produtor: { $in: idsAprovados } }
  ];


  // Consultar os produtos no MongoDB
  const lista = await Product.find(filtro)
    .sort(ORDENACAO[ordenar] || ORDENACAO.recentes)
    .populate(
      'produtor',
      'nome produtor.localidade produtor.nomeExploracao'
    );

  res.json(lista);
}));


 // GET /api/products/me
 // O produtor consulta todos os seus produtos,
 // incluindo os ocultados pelo administrador.
 router.get('/me', auth('produtor'), a(async (req, res) => {
   const produtos = await Product.find({
     produtor: req.user.id
   })
     .sort({ createdAt: -1 });

   res.json(produtos);
 }));




// ==================================================
// GET /api/products/:id
// Consultar um produto pelo identificador
// ==================================================


router.get('/:id', a(async (req, res) => {
  const produto = await Product.findOne({
    _id: req.params.id,
    visivel: { $ne: false }
  })
    .populate({
      path: 'produtor',
      select: 'nome produtor.localidade produtor.nomeExploracao',
      match: {
        papel: 'produtor',
        'produtor.validado': true,
        'produtor.rejeitado': { $ne: true }
      }
    });

  if (!produto || !produto.produtor) {
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
// ==================================================

router.post(
  '/:id/imagem',
  auth('produtor'),
  upload.single('imagem'),
  a(async (req, res) => {

    // Verificar se o produto pertence ao produtor
    const produto = await Product.findOne({
      _id: req.params.id,
      produtor: req.user.id
    });

    if (!produto) {
      throw erro(404, 'Produto não encontrado');
    }

    // Verificar se foi enviada uma imagem
    if (!req.file) {
      throw erro(400, 'Seleciona uma imagem');
    }

    // Guardar a imagem
    const imagemUrl = await guardarImagem(req.file, req);

    // Associar a imagem ao produto no MongoDB
    produto.imagemUrl = imagemUrl;
    await produto.save();

    // Resposta HTTP 200
    res.json({
      imagemUrl: produto.imagemUrl
    });
  })
);


module.exports = router;

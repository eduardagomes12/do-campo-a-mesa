// Leilões (a parte REST; as licitações em direto são feitas por Socket.io)
const router = require('express').Router();
const auth = require('../middleware/auth');
const Auction = require('../models/Auction');
const a = require('../utils/async');
const Bid = require('../models/Bid');
const erro = require('../utils/erro');
const Product = require('../models/Product');
const produtorValidado = require('../middleware/produtorValidado');

// GET /api/auctions?estado=ativo  -> 200 [leilões]

router.get('/', a(async (req, res) => {
  const { estado } = req.query;

  const filtro = {};

  // Filtrar pelo estado, quando indicado
  if (estado) {
    filtro.estado = estado;
  }

  const leiloes = await Auction.find(filtro)
    .sort({ createdAt: -1 })
    .populate(
      'produtor',
      'nome produtor.localidade produtor.nomeExploracao'
    );

  res.json(leiloes);
}));



 // GET /api/auctions/me
 // Listar todos os leilões do produtor autenticado
 router.get('/me', auth('produtor'), a(async (req, res) => {
   const leiloes = await Auction.find({
     produtor: req.user.id
   })
     .sort({ createdAt: -1 })
     .populate('produto', 'nome unidade');

   res.json(leiloes);
 }));


// GET /api/auctions/:id  -> 200 leilão + últimas licitações

router.get('/:id', a(async (req, res) => {
  const leilao = await Auction.findById(req.params.id)
    .populate(
      'produtor',
      'nome produtor.localidade produtor.nomeExploracao'
    );

  if (!leilao) {
    throw erro(404, 'Leilão não encontrado');
  }

  // Consultar as últimas 20 licitações
  const licitacoes = await Bid.find({
    leilao: req.params.id
  })
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({
    leilao,
    licitacoes
  });
}));


// POST /api/auctions  (produtor)  -> 201
// TODO: definir licitacaoAtual.valor = precoBase e terminaEm = iniciaEm + duração

router.post(
  '/',
  auth('produtor'),
  produtorValidado,
  a(async (req, res) => {
    const {
      produto,
      lote,
      quantidade,
      precoBase,
      incremento,
      iniciaEm,
      duracao
    } = req.body || {};

    const preco = Number(precoBase);
    const inc = Number(incremento);
    const minutos = Number(duracao);

    // Validar os dados do leilão
    if (
      !lote ||
      precoBase == null ||
      incremento == null ||
      duracao == null ||
      !Number.isFinite(preco) ||
      !Number.isFinite(inc) ||
      !Number.isFinite(minutos) ||
      preco < 0 ||
      inc < 0.01 ||
      minutos <= 0
    ) {
      throw erro(400, 'Dados do leilão inválidos');
    }

    // Verificar que o produto pertence ao produtor

    if (produto) {
      const existe = await Product.exists({
        _id: produto,
        produtor: req.user.id,
        visivel: { $ne: false }
      });

      if (!existe) {
        throw erro(404, 'Produto não encontrado ou indisponível');
      }
    }


    // Calcular o início e o fim
    const agora = new Date();
    const inicio = iniciaEm
      ? new Date(iniciaEm)
      : agora;

    if (Number.isNaN(inicio.getTime())) {
      throw erro(400, 'Data de início inválida');
    }

    const fim = new Date(
      inicio.getTime() + minutos * 60 * 1000
    );

    if (Number.isNaN(fim.getTime()) || fim <= agora) {
      throw erro(400, 'Prazo do leilão inválido');
    }

    // Criar o leilão
    const leilao = await Auction.create({
      produtor: req.user.id,
      produto,
      lote,
      quantidade,
      precoBase: preco,
      incremento: inc,
      licitacaoAtual: {
        valor: preco
      },
      iniciaEm: inicio,
      terminaEm: fim,
      estado: inicio <= agora ? 'ativo' : 'agendado'
    });


    // Avisar os administradores após a criação
    // do leilão ter sido confirmada no MongoDB.
    const io = req.app.get('io');

    io?.to('admin:leiloes').emit('leiloes-atualizados');


    res.status(201).json(leilao);
  })
);


// GET /api/auctions/:id/bids  -> 200 [licitações]

router.get('/:id/bids', a(async (req, res) => {
  const leilao = await Auction.findById(req.params.id);

  if (!leilao) {
    throw erro(404, 'Leilão não encontrado');
  }

  const licitacoes = await Bid.find({
    leilao: req.params.id
  }).sort({ createdAt: -1 });

  res.json(licitacoes);
}));


module.exports = router;

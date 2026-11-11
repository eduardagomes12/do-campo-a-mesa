// Passo 3: recurso /api/orders

const router = require('express').Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const a = require('../utils/async');
const erro = require('../utils/erro');

// Repor o stock se a encomenda falhar
async function reporStock(reservas) {
  for (const { id, q } of reservas) {
    await Product.updateOne(
      { _id: id },
      { $inc: { stock: q } }
    );
  }
}


// ==================================================
// POST /api/orders
// Criar encomenda (comprador autenticado)
// ==================================================

router.post('/', auth('comprador'), a(async (req, res) => {
  const { linhas, entrega = {} } = req.body || {};

  if (!Array.isArray(linhas) || linhas.length === 0) {
    throw erro(400, 'A encomenda tem de ter pelo menos uma linha');
  }

  const reservas = [];
  const porProdutor = new Map();

  try {
    for (const l of linhas) {
      const q = Number(l.quantidade);

      if (!l.produto || !Number.isFinite(q) || q < 1) {
        throw erro(400, 'Linha de encomenda inválida');
      }

      // Reservar stock de forma atómica
      const p = await Product.findOneAndUpdate(
        {
          _id: l.produto,
          stock: { $gte: q }
        },
        {
          $inc: { stock: -q }
        },
        {
          new: true
        }
      );

      if (!p) {
        const existe = await Product.findById(l.produto)
          .select('nome');

        throw erro(
          409,
          existe
            ? `Stock insuficiente: ${existe.nome}`
            : 'Produto não encontrado'
        );
      }

      reservas.push({ id: p._id, q });

      // Agrupar produtos por produtor
      const chave = p.produtor.toString();

      if (!porProdutor.has(chave)) {
        porProdutor.set(chave, []);
      }

      porProdutor.get(chave).push({
        produto: p._id,
        nome: p.nome,
        precoUnit: p.preco,
        unidade: p.unidade,
        quantidade: q
      });
    }

    // Criar uma encomenda por produtor
    const criadas = await Order.create(
      [...porProdutor].map(([produtor, ls]) => ({
        comprador: req.user.id,
        produtor,
        linhas: ls,
        entrega: {
          tipo: entrega?.tipo || 'levantamento',
          morada: entrega?.morada
        }
      }))
    );

    // Notificar os produtores em tempo real
    const io = req.app.get('io');

    criadas.forEach((o) => {
      io?.to(`user:${o.produtor}`).emit('nova-encomenda', {
        id: o._id,
        total: o.total
      });
    });

    res.status(201).json(criadas);

  } catch (err) {
    await reporStock(reservas);
    throw err;
  }
}));


// ==================================================
// GET /api/orders
// Listar encomendas do utilizador
// Ainda por implementar
// ==================================================


router.get('/', auth(), a(async (req, res) => {
  const filtro = req.user.papel === 'produtor'
    ? { produtor: req.user.id }
    : { comprador: req.user.id };

  const encomendas = await Order.find(filtro)
    .sort({ createdAt: -1 });

  res.json(encomendas);
}));



// ==================================================
// GET /api/orders/:id
// Consultar detalhe da encomenda
// Ainda por implementar
// ==================================================


router.get('/:id', auth(), a(async (req, res) => {
  const encomenda = await Order.findOne({
    _id: req.params.id,
    $or: [
      { comprador: req.user.id },
      { produtor: req.user.id }
    ]
  });

  if (!encomenda) {
    throw erro(404, 'Encomenda não encontrada');
  }

  res.json(encomenda);
}));



// ==================================================
// PATCH /api/orders/:id/estado
// Atualizar estado da encomenda
// Ainda por implementar
// ==================================================


router.patch('/:id/estado', auth('produtor'), a(async (req, res) => {
  const { estado } = req.body || {};

  const ESTADOS = Order.ESTADOS;
  const novo = ESTADOS.indexOf(estado);

  // Verificar se o estado é válido
  if (novo < 0) {
    throw erro(400, 'Estado inválido');
  }

  // Atualizar apenas se o novo estado for posterior
  const o = await Order.findOneAndUpdate(
    {
      _id: req.params.id,
      produtor: req.user.id,
      estado: { $in: ESTADOS.slice(0, novo) }
    },
    { estado },
    { new: true, runValidators: true }
  );

  // Distinguir encomenda inexistente de mudança inválida
  if (!o) {
    const existe = await Order.exists({
      _id: req.params.id,
      produtor: req.user.id
    });

    throw erro(
      existe ? 409 : 404,
      existe
        ? 'O estado só pode avançar'
        : 'Encomenda não encontrada'
    );
  }

  // Notificar o comprador em tempo real
  req.app.get('io')?.to(`user:${o.comprador}`).emit(
    'encomenda-atualizada',
    {
      id: o._id,
      estado: o.estado,
      produtor: req.user.nome
    }
  );

  res.json(o);
}));


module.exports = router;

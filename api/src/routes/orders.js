const router = require('express').Router();
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Order = require('../models/Order');

const auth = require('../middleware/auth');
const a = require('../utils/async');
const erro = require('../utils/erro');

// ==================================================
// POST /api/orders
// Criar encomendas (comprador autenticado)
// ==================================================

router.post('/', auth('comprador'), a(async (req, res) => {
  const { linhas, entrega = {} } = req.body || {};

  // Validar se existem produtos no carrinho
  if (!Array.isArray(linhas) || linhas.length === 0) {
    throw erro(
      400,
      'A encomenda tem de ter pelo menos uma linha'
    );
  }

  // Todas as reservas e encomendas fazem parte
  // da mesma transação MongoDB.
  const criadas = await mongoose.connection.transaction(
    async (session) => {
      const porProdutor = new Map();

      // ==========================================
      // RESERVAR STOCK DOS PRODUTOS
      // ==========================================

      for (const linha of linhas) {
        const quantidade = Number(linha?.quantidade);

        // Validar a linha
        if (
          !linha?.produto ||
          !Number.isFinite(quantidade) ||
          quantidade < 1
        ) {
          throw erro(400, 'Linha de encomenda inválida');
        }

        // Reservar stock de forma atómica
        const produto = await Product.findOneAndUpdate(
          {
            _id: linha.produto,
            stock: { $gte: quantidade },
            visivel: { $ne: false }
          },
          {
            $inc: { stock: -quantidade }
          },
          {
            new: true,
            session
          }
        );

        // Stock insuficiente ou produto inexistente

        if (!produto) {
          const existe = await Product
            .findById(linha.produto)
            .select('nome visivel')
            .session(session);

          if (!existe) {
            throw erro(404, 'Produto não encontrado');
          }

          if (existe.visivel === false) {
            throw erro(409, 'Produto indisponível');
          }

          throw erro(
            409,
            `Stock insuficiente: ${existe.nome}`
          );
        }


        // ==========================================
        // AGRUPAR PRODUTOS POR PRODUTOR
        // ==========================================

        const idProdutor = produto.produtor.toString();

        if (!porProdutor.has(idProdutor)) {
          porProdutor.set(idProdutor, []);
        }

        porProdutor.get(idProdutor).push({
          produto: produto._id,
          nome: produto.nome,
          precoUnit: produto.preco,
          unidade: produto.unidade,
          quantidade
        });
      }

      // ==========================================
      // CRIAR UMA ENCOMENDA POR PRODUTOR
      // ==========================================

      const documentos = [...porProdutor].map(
        ([produtor, ls]) => ({
          comprador: req.user.id,
          produtor,
          linhas: ls,
          entrega: {
            tipo: entrega?.tipo || 'levantamento',
            morada: entrega?.morada
          }
        })
      );

      // Criar as encomendas na mesma transação.
      // Se falhar, o stock também é revertido.
      
      return Order.create(documentos, {
        session,
        ordered: true
      });

    }
  );

  // ==========================================
  // NOTIFICAR OS PRODUTORES
  // ==========================================

  // Só notificar depois de a transação
  // terminar com sucesso.
  const io = req.app.get('io');

  criadas.forEach((o) => {
    io?.to(`user:${o.produtor}`).emit(
      'nova-encomenda',
      {
        id: o._id,
        total: o.total
      }
    );
  });

  res.status(201).json(criadas);
}));

// ==================================================
// GET /api/orders
// Listar encomendas do utilizador
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
// Consultar detalhe de uma encomenda
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
// ==================================================

router.patch(
  '/:id/estado',
  auth('produtor'),
  a(async (req, res) => {
    const { estado } = req.body || {};

    const ESTADOS = Order.ESTADOS;
    const novo = ESTADOS.indexOf(estado);

    // Validar o novo estado
    if (novo < 0) {
      throw erro(400, 'Estado inválido');
    }

    // O estado só pode avançar
    const o = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        produtor: req.user.id,
        estado: {
          $in: ESTADOS.slice(0, novo)
        }
      },
      {
        estado
      },
      {
        new: true,
        runValidators: true
      }
    );

    // Distinguir mudança inválida de encomenda inexistente
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
    req.app.get('io')
      ?.to(`user:${o.comprador}`)
      .emit('encomenda-atualizada', {
        id: o._id,
        estado: o.estado,
        produtor: req.user.nome
      });

    res.json(o);
  })
);

module.exports = router;

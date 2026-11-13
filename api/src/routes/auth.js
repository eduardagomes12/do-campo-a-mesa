 // Passo 6: registo e login
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const a = require('../utils/async');
const erro = require('../utils/erro');

// ==================================================
// FUNÇÃO AUXILIAR — EMITIR TOKEN JWT
// ==================================================

// O token contém o identificador, o papel e o nome.
// A expiração é configurada no .env ou assume 2 horas.
function emitirToken(utilizador) {
  return jwt.sign(
    {
      id: utilizador._id.toString(),
      papel: utilizador.papel,
      nome: utilizador.nome
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '2h'
    }
  );
}

// ==================================================
// REGISTO DE UTILIZADORES
// ==================================================

// POST /api/auth/registo  -> 201 { id }
// TODO: validar dados, fazer hash da password com bcrypt (custo 12) e criar o utilizador.
//       Um produtor fica com produtor.validado = false até o administrador aprovar.
router.post('/registo', a(async (req, res) => {
  const {
    nome,
    email,
    password,
    papel,
    produtor
  } = req.body || {};

  // Validar os campos obrigatórios
  if (
    typeof nome !== 'string' ||
    !nome.trim() ||
    typeof email !== 'string' ||
    !email.trim() ||
    typeof password !== 'string' ||
    !password ||
    typeof papel !== 'string'
  ) {
    throw erro(400, 'Nome, email, password e papel são obrigatórios');
  }

  // Validar o nome e o email
  const nomeLimpo = nome.trim();
  const emailLimpo = email.trim().toLowerCase();

  if (nomeLimpo.length > 100) {
    throw erro(400, 'O nome não pode exceder 100 caracteres');
  }

  if (!/^\S+@\S+\.\S+$/.test(emailLimpo)) {
    throw erro(400, 'Email inválido');
  }

  // Validar a password
  if (password.length < 8) {
    throw erro(400, 'A password deve ter pelo menos 8 caracteres');
  }

  // O bcrypt utiliza, no máximo, 72 bytes da password
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw erro(400, 'A password é demasiado longa');
  }

  // Impedir o registo direto de administradores
  if (!['comprador', 'produtor'].includes(papel)) {
    throw erro(400, 'O papel deve ser comprador ou produtor');
  }

  // Verificar se o email já existe
  const existente = await User.exists({
    email: emailLimpo
  });

  if (existente) {
    throw erro(409, 'Email já registado');
  }

  // Dados específicos das contas de produtor
  let dadosProdutor;

  if (papel === 'produtor') {
    if (
      !produtor ||
      typeof produtor !== 'object' ||
      Array.isArray(produtor) ||
      typeof produtor.nomeExploracao !== 'string' ||
      !produtor.nomeExploracao.trim() ||
      typeof produtor.localidade !== 'string' ||
      !produtor.localidade.trim()
    ) {
      throw erro(
        400,
        'O produtor deve indicar o nome da exploração e a localidade'
      );
    }

    if (
      produtor.descricao !== undefined &&
      (
        typeof produtor.descricao !== 'string' ||
        produtor.descricao.length > 1000
      )
    ) {
      throw erro(400, 'Descrição do produtor inválida');
    }

    dadosProdutor = {
      nomeExploracao: produtor.nomeExploracao.trim(),
      localidade: produtor.localidade.trim(),

      ...(typeof produtor.descricao === 'string'
        ? { descricao: produtor.descricao.trim() }
        : {}),

      // Um produtor novo aguarda aprovação
      validado: false,
      rejeitado: false
    };
  }

  // Guardar apenas o hash, nunca a password original
  const passwordHash = await bcrypt.hash(password, 12);

  // Criar o utilizador com os campos permitidos
  const utilizador = await User.create({
    nome: nomeLimpo,
    email: emailLimpo,
    passwordHash,
    papel,

    ...(papel === 'produtor'
      ? { produtor: dadosProdutor }
      : {})
  });

  // Resposta prevista pelo enunciado
  res.status(201).json({
    id: utilizador._id.toString()
  });
}));

// ==================================================
// LOGIN
// ==================================================

// POST /api/auth/login  -> 200 { token, utilizador }
// TODO: procurar pelo email (com .select('+passwordHash')), comparar com bcrypt.compare
//       e devolver um JWT com { id, papel } assinado com process.env.JWT_SECRET.
router.post('/login', a(async (req, res) => {
  const { email, password } = req.body || {};

  // Validar os tipos dos dados recebidos
  if (
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    throw erro(401, 'Credenciais inválidas');
  }

  // Procurar o utilizador pelo email
  // É necessário pedir explicitamente o passwordHash
  // porque está configurado com select: false
  const utilizador = await User.findOne({
    email: email.trim().toLowerCase()
  }).select('+passwordHash');

  // Não revelar se o email ou a password estão errados
  if (
    !utilizador ||
    !(await bcrypt.compare(password, utilizador.passwordHash))
  ) {
    throw erro(401, 'Credenciais inválidas');
  }


  // Produtores rejeitados não podem iniciar sessão
  if (
    utilizador.papel === 'produtor' &&
    utilizador.produtor?.rejeitado
  ) {
    throw erro(
      403,
      'A tua conta de produtor foi rejeitada pelo administrador.'
    );
  }

  // Produtores pendentes aguardam a aprovação
  if (
    utilizador.papel === 'produtor' &&
    !utilizador.produtor?.validado
  ) {
    throw erro(
      403,
      'A tua conta de produtor está a aguardar aprovação do administrador.'
    );
  }


  // Criar o token JWT
  const token = emitirToken(utilizador);

  // Nunca devolver o passwordHash
  res.status(200).json({
    token,
    utilizador: utilizador.publico()
  });
}));

// ==================================================
// UTILIZADOR AUTENTICADO
// ==================================================

// GET /api/auth/eu  -> 200 dados do utilizador autenticado
router.get('/eu', auth(), a(async (req, res) => {
  // O middleware auth() já verificou o JWT
  const utilizador = await User.findById(req.user.id);

  if (!utilizador) {
    throw erro(401, 'Sessão inválida');
  }

  // Devolver apenas os dados públicos
  res.status(200).json(utilizador.publico());
}));

module.exports = router;

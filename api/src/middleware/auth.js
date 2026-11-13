const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = (...papeis) => async (req, res, next) => {
  const cabecalho = req.headers.authorization || '';

  const token = cabecalho.startsWith('Bearer ')
    ? cabecalho.slice(7)
    : null;

  let dadosToken;

  try {
    dadosToken = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
  } catch {
    return res.status(401).json({
      erro: 'Token inválido ou em falta'
    });
  }

  try {
    // Consultar o estado atual do utilizador na BD
    const utilizador = await User.findById(
      dadosToken.id
    );

    if (!utilizador) {
      return res.status(401).json({
        erro: 'Sessão inválida'
      });
    }

    // Bloquear sessões de produtores rejeitados
    if (
      utilizador.papel === 'produtor' &&
      utilizador.produtor?.rejeitado
    ) {
      return res.status(401).json({
        erro: 'Conta de produtor rejeitada'
      });
    }

    // Bloquear sessões de produtores ainda pendentes
    if (
      utilizador.papel === 'produtor' &&
      !utilizador.produtor?.validado
    ) {
      return res.status(401).json({
        erro: 'Conta de produtor pendente de aprovação'
      });
    }

    // Confirmar o papel atual na base de dados
    if (
      papeis.length &&
      !papeis.includes(utilizador.papel)
    ) {
      return res.status(403).json({
        erro: 'Sem permissão'
      });
    }

    req.user = {
      ...dadosToken,
      papel: utilizador.papel,
      nome: utilizador.nome
    };

    next();
  } catch (err) {
    next(err);
  }
};

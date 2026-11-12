
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id);

    // Produtor inexistente ou não aprovado
    if (!u || u.papel !== 'produtor') {
      return res.status(403).json({
        erro: 'Conta de produtor não autorizada'
      });
    }

    // Produtor rejeitado
    if (u.produtor?.rejeitado) {
      return res.status(403).json({
        erro: 'Conta de produtor rejeitada pelo administrador'
      });
    }

    // Produtor ainda pendente
    if (!u.produtor?.validado) {
      return res.status(403).json({
        erro: 'Conta de produtor a aguardar validação do administrador'
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

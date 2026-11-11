
module.exports = (err, req, res, next) => {
  // Erros de validação do Mongoose
  if (err.name === 'ValidationError') {
    const detalhes = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
    );

    return res.status(400).json({
      erro: 'Dados inválidos',
      detalhes
    });
  }

  // Identificadores ou valores inválidos
  if (err.name === 'CastError') {
    return res.status(400).json({
      erro: 'Identificador ou valor inválido'
    });
  }

  // Dados duplicados, por exemplo um email
  if (err.code === 11000) {
    return res.status(409).json({
      erro: 'Já existe um registo com esses dados'
    });
  }

  // Erros no upload de ficheiros
  if (err.name === 'MulterError') {
    return res.status(400).json({
      erro: err.message
    });
  }

  const status = err.status || 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    erro: status >= 500 ? 'Erro interno' : err.message
  });
};

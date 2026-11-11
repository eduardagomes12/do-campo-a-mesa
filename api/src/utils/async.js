
 // Envolve handlers assíncronos e encaminha erros
 // para o middleware centralizado.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

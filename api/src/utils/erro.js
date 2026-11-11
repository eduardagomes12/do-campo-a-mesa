
 // Cria um erro com um código HTTP.
module.exports = (status, mensagem) =>
  Object.assign(new Error(mensagem), { status });

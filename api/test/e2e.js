const test = require('node:test');
const assert = require('node:assert/strict');

const API = process.env.TEST_API_URL ||
  'http://localhost:3000/api';

// ==========================================
// TESTE 1 — HEALTH CHECK
// ==========================================

test('API responde ao health check', async () => {
  const resposta = await fetch(`${API}/health`);

  assert.equal(resposta.status, 200);

  const dados = await resposta.json();
  assert.equal(dados.estado, 'ok');
});

// ==========================================
// TESTE 2 — LOGIN INVÁLIDO
// ==========================================

test('Login com password errada é recusado', async () => {
  const resposta = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'tasca@exemplo.pt',
      password: 'password-errada'
    })
  });

  assert.equal(resposta.status, 401);
});

// ==========================================
// TESTE 3 — LOGIN VÁLIDO
// ==========================================

test('Comprador consegue iniciar sessão', async () => {
  const resposta = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'tasca@exemplo.pt',
      password: 'password123'
    })
  });

  assert.equal(resposta.status, 200);

  const dados = await resposta.json();

  assert.ok(dados.token, 'Token JWT em falta');
});

// ==========================================
// TESTE 4 — VISITANTE SEM PERMISSÃO
// ==========================================

test('Visitante não acede às estatísticas do administrador', async () => {
  const resposta = await fetch(`${API}/admin/estatisticas`);

  assert.equal(resposta.status, 401);
});

// ==========================================
// TESTE 5 — COMPRADOR NÃO É ADMIN
// ==========================================

test('Comprador não acede às funcionalidades do administrador', async () => {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'tasca@exemplo.pt',
      password: 'password123'
    })
  });

  assert.equal(login.status, 200);
  const { token } = await login.json();

  assert.ok(token);

  const resposta = await fetch(`${API}/admin/estatisticas`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  assert.equal(resposta.status, 403);
});

// ==========================================
// TESTE 6 — COMPRADOR NÃO CRIA LEILÕES
// ==========================================

test('Comprador não pode criar leilões', async () => {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'tasca@exemplo.pt',
      password: 'password123'
    })
  });

  assert.equal(login.status, 200);
  const { token } = await login.json();

  assert.ok(token);

  const resposta = await fetch(`${API}/auctions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({})
  });

  assert.equal(resposta.status, 403);
});

// ==========================================
// TESTE 7 — CONCORRÊNCIA E ENCERRAMENTO
// ==========================================

test('Duas licitações simultâneas: só uma é aceite', {
  timeout: 60000
}, async () => {
  require('dotenv').config();

  const mongoose = require('mongoose');
  const jwt = require('jsonwebtoken');
  const path = require('node:path');
  const { createRequire } = require('node:module');

  const User = require('../src/models/User');
  const Auction = require('../src/models/Auction');
  const Bid = require('../src/models/Bid');
  const Order = require('../src/models/Order');

  const requireWeb = createRequire(
    path.resolve(__dirname, '../../web/package.json')
  );

  const { io } = requireWeb('socket.io-client');

  const servidor = API.replace(/\/api\/?$/, '');
  const sockets = [];
  let leilaoId = null;

  // ==========================================
  // LIGAR SOCKET
  // ==========================================

  function ligar(token) {
    return new Promise((resolve, reject) => {
      const socket = io(servidor, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        autoConnect: false,
        timeout: 5000
      });

      sockets.push(socket);

      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);

      socket.connect();
    });
  }

  // ==========================================
  // ENVIAR LICITAÇÃO
  // ==========================================

  function licitar(socket, valor = 105) {
    return new Promise((resolve, reject) => {
      socket.timeout(15000).emit(
        'licitar',
        {
          leilaoId: String(leilaoId),
          valor
        },
        (erro, resposta) => {
          if (erro) return reject(erro);
          resolve(resposta);
        }
      );
    });
  }

  try {
    assert.ok(process.env.MONGODB_URI);
    assert.ok(process.env.JWT_SECRET);

    await mongoose.connect(process.env.MONGODB_URI);

    const produtor = await User.findOne({
      papel: 'produtor',
      'produtor.validado': true,
      'produtor.rejeitado': { $ne: true }
    });

    assert.ok(produtor, 'Produtor aprovado não encontrado');

    const compradores = await User.find({
      papel: 'comprador'
    })
      .sort({ _id: 1 })
      .limit(2);

    assert.equal(
      compradores.length,
      2,
      'São necessárias duas contas de comprador'
    );

    // Criar um leilão temporário.
    const agora = Date.now();

    const leilao = await Auction.create({
      produtor: produtor._id,
      lote: 'Teste automático de concorrência',
      precoBase: 100,
      incremento: 5,
      licitacaoAtual: { valor: 100 },
      iniciaEm: new Date(agora - 10000),
      terminaEm: new Date(agora + 20 * 60 * 1000),
      estado: 'ativo'
    });

    leilaoId = leilao._id;

    // Criar um token para cada comprador.
    const tokens = compradores.map(comprador =>
      jwt.sign(
        {
          id: String(comprador._id),
          papel: comprador.papel,
          nome: comprador.nome
        },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      )
    );

    const [socket1, socket2] = await Promise.all(
      tokens.map(ligar)
    );

    // ==========================================
    // FASE 1 — DUAS LICITAÇÕES IGUAIS
    // ==========================================

    const respostas = await Promise.all([
      licitar(socket1),
      licitar(socket2)
    ]);

    const aceites = respostas.filter(
      resposta => resposta?.ok === true
    );

    const recusadas = respostas.filter(
      resposta => resposta?.ok === false
    );

    assert.equal(
      aceites.length,
      1,
      'Deve existir exatamente uma licitação aceite'
    );

    assert.equal(
      recusadas.length,
      1,
      'Deve existir exatamente uma licitação recusada'
    );

    console.log('PASSOU: uma licitação aceite e uma recusada');

    // Confirmar persistência no MongoDB.
    const atualizado = await Auction.findById(leilaoId);

    const historico = await Bid.find({
      leilao: leilaoId
    });

    assert.equal(atualizado.licitacaoAtual.valor, 105);
    assert.equal(atualizado.numLicitacoes, 1);
    assert.equal(historico.length, 1);
    assert.equal(historico[0].valor, 105);

    console.log('PASSOU: valor final de 105 €');
    console.log('PASSOU: histórico contém apenas uma licitação');

    // ==========================================
    // FASE 2 — RAJADA DE 10 LICITAÇÕES
    // ==========================================

    const valores = Array.from(
      { length: 10 },
      (_, i) => 110 + i * 5
    );

    // Enviar 10 licitações em paralelo.
    const respostasRajada = await Promise.all(
      valores.map((valor, i) =>
        licitar(
          i % 2 === 0 ? socket1 : socket2,
          valor
        )
      )
    );

    const aceitesRajada = respostasRajada.filter(
      resposta => resposta?.ok === true
    );

    const recusadasRajada = respostasRajada.filter(
      resposta => resposta?.ok === false
    );

    assert.equal(
      aceitesRajada.length + recusadasRajada.length,
      10,
      'Todas as tentativas devem ter resposta'
    );

    assert.ok(
      aceitesRajada.length >= 1,
      'Deve existir pelo menos uma licitação aceite'
    );

    console.log(
      `Rajada: ${aceitesRajada.length} aceites, ` +
      `${recusadasRajada.length} recusadas`
    );

    // Confirmar persistência no MongoDB.
    const leilaoFinal = await Auction.findById(leilaoId);

    const historicoFinal = await Bid.find({
      leilao: leilaoId
    });

    const totalEsperado = 1 + aceitesRajada.length;

    assert.equal(
      leilaoFinal.numLicitacoes,
      totalEsperado,
      'Contador do leilão inconsistente'
    );

    assert.equal(
      historicoFinal.length,
      totalEsperado,
      'Histórico inconsistente'
    );

    const valoresEsperados = [
      105,
      ...aceitesRajada.map(resposta => resposta.valor)
    ].sort((a, b) => a - b);

    const valoresGuardados = historicoFinal
      .map(licitacao => licitacao.valor)
      .sort((a, b) => a - b);

    assert.deepEqual(
      valoresGuardados,
      valoresEsperados,
      'As licitações aceites não correspondem ao histórico'
    );

    assert.equal(
      leilaoFinal.licitacaoAtual.valor,
      Math.max(...valoresEsperados),
      'Valor atual do leilão incorreto'
    );

    console.log(
      'PASSOU: todas as licitações aceites estão no histórico'
    );

    console.log(
      'PASSOU: contador e valor final consistentes'
    );

    // ==========================================
    // FASE 3 — ENCERRAMENTO AUTOMÁTICO
    // E NOTIFICAÇÕES
    // ==========================================

    // Esperar por um evento Socket.io.
    const esperarEvento = (socket, evento, limite = 15000) =>
      new Promise((resolve, reject) => {
        const aoReceber = (dados) => {
          clearTimeout(temporizador);
          socket.off(evento, aoReceber);
          resolve(dados);
        };

        const temporizador = setTimeout(() => {
          socket.off(evento, aoReceber);
          reject(new Error(`Não chegou o evento ${evento}`));
        }, limite);

        socket.on(evento, aoReceber);
      });

    // Entrar na sala do leilão.
    const estadoRecebido = esperarEvento(socket1, 'estado');

    socket1.emit('entrar', String(leilaoId));

    const estadoInicial = await estadoRecebido;

    assert.equal(
      String(estadoInicial.leilao._id),
      String(leilaoId)
    );

    // Ligar o produtor à sua sala pessoal.
    const tokenProdutor = jwt.sign({
      id: String(produtor._id),
      papel: 'produtor',
      nome: produtor.nome
    }, process.env.JWT_SECRET, { expiresIn: '5m' });

    const socketProdutor = await ligar(tokenProdutor);

    // Descobrir qual dos compradores ganhou.
    const vencedorId = String(
      leilaoFinal.licitacaoAtual.comprador
    );

    const socketVencedor =
      vencedorId === String(compradores[0]._id)
        ? socket1
        : socket2;

    // Inscrever os ouvintes ANTES do encerramento.
    const avisos = Promise.all([
      esperarEvento(socket1, 'terminado'),
      esperarEvento(socketVencedor, 'leilao-ganho'),
      esperarEvento(socketProdutor, 'leilao-terminado'),
      esperarEvento(socketProdutor, 'nova-encomenda')
    ]);

    // Forçar a expiração apenas do leilão de teste.
    await Auction.updateOne(
      { _id: leilaoId },
      {
        $set: {
          terminaEm: new Date(Date.now() - 1000)
        }
      }
    );

    // Esperar que o ciclo automático da API
    // detete e encerre o leilão.
    const [
      fimSala,
      avisoVencedor,
      avisoProdutor,
      novaEncomenda
    ] = await avisos;

    // Consultar o estado final no MongoDB.
    const encerrado = await Auction.findById(leilaoId);

    const encomendas = await Order.find({
      leilao: leilaoId
    });

    // O leilão deve ficar terminado.
    assert.equal(
      encerrado.estado,
      'terminado'
    );

    // Deve existir exatamente uma encomenda.
    assert.equal(
      encomendas.length,
      1,
      'Deve existir uma só encomenda'
    );

    // A encomenda deve estar confirmada.
    assert.equal(
      encomendas[0].estado,
      'confirmada'
    );

    // A origem deve ser o leilão.
    assert.equal(
      encomendas[0].origem,
      'leilao'
    );

    // O comprador deve ser o vencedor.
    assert.equal(
      String(encomendas[0].comprador),
      vencedorId
    );

    // O valor deve corresponder à última licitação.
    assert.equal(
      encomendas[0].linhas[0].precoUnit,
      leilaoFinal.licitacaoAtual.valor
    );

    // O leilão deve referenciar a encomenda criada.
    assert.equal(
      String(encerrado.encomenda),
      String(encomendas[0]._id)
    );

    // Validar o evento enviado à sala.
    assert.equal(
      String(fimSala.vencedor),
      vencedorId
    );

    assert.equal(
      fimSala.valor,
      leilaoFinal.licitacaoAtual.valor
    );

    // Validar a notificação ao vencedor.
    assert.equal(
      avisoVencedor.valor,
      leilaoFinal.licitacaoAtual.valor
    );

    assert.equal(
      String(avisoVencedor.encomenda),
      String(encomendas[0]._id)
    );

    // Validar a notificação ao produtor.
    assert.equal(
      String(avisoProdutor.encomenda),
      String(encomendas[0]._id)
    );

    assert.equal(
      String(novaEncomenda.id),
      String(encomendas[0]._id)
    );

    console.log('PASSOU: leilão encerrado automaticamente');

    console.log(
      'PASSOU: vencedor recebeu encomenda confirmada'
    );

    console.log(
      'PASSOU: notificações recebidas pela sala, vencedor e produtor'
    );

    // ==========================================
    // FASE 4 — NÃO DUPLICAR ENCOMENDAS
    // ==========================================

    const { fecharLeilao } = require(
      '../src/services/cicloLeiloes'
    );

    // Tentar encerrar novamente o mesmo leilão.
    const segundoFecho = await fecharLeilao(
      null,
      leilaoId
    );

    // Não deve existir novo encerramento.
    assert.equal(segundoFecho, null);

    // Continua a existir uma única encomenda.
    assert.equal(
      await Order.countDocuments({
        leilao: leilaoId
      }),
      1
    );

    console.log(
      'PASSOU: encerramento repetido não duplica encomenda'
    );


    // ==========================================
    // FASE 5 — ESTADOS E NOTIFICAÇÕES DA ENCOMENDA
    // ==========================================

    const encomendaId = String(encomendas[0]._id);

    async function mudarEstado(estado) {
      return fetch(`${API}/orders/${encomendaId}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenProdutor}`
        },
        body: JSON.stringify({ estado })
      });
    }

    // 1) Confirmada -> Pronta:
    // deve atualizar e notificar o comprador.
    // Registar o listener antes do pedido.
    const avisoPronta = esperarEvento(
      socketVencedor, 'encomenda-atualizada'
    );

    const respostaPronta = await mudarEstado('pronta');

    assert.equal(respostaPronta.status, 200);
    assert.equal(
      (await respostaPronta.json()).estado,
      'pronta'
    );

    const eventoPronta = await avisoPronta;

    assert.equal(String(eventoPronta.id), encomendaId);
    assert.equal(eventoPronta.estado, 'pronta');

    assert.equal(
      (await Order.findById(encomendaId)).estado,
      'pronta'
    );

    console.log(
      'PASSOU: comprador notificado quando a encomenda fica pronta'
    );

    // 2) Pronta -> Confirmada:
    // deve recusar a regressão com HTTP 409.
    const respostaRecuo = await mudarEstado('confirmada');

    assert.equal(respostaRecuo.status, 409);

    assert.equal(
      (await Order.findById(encomendaId)).estado,
      'pronta'
    );

    console.log(
      'PASSOU: recuar o estado da encomenda devolve 409'
    );

    // 3) Pronta -> Entregue:
    // deve atualizar e notificar novamente.
    const avisoEntregue = esperarEvento(
      socketVencedor, 'encomenda-atualizada'
    );

    const respostaEntregue = await mudarEstado('entregue');

    assert.equal(respostaEntregue.status, 200);

    assert.equal(
      (await respostaEntregue.json()).estado,
      'entregue'
    );

    const eventoEntregue = await avisoEntregue;

    assert.equal(String(eventoEntregue.id), encomendaId);
    assert.equal(eventoEntregue.estado, 'entregue');

    assert.equal(
      (await Order.findById(encomendaId)).estado,
      'entregue'
    );

    console.log(
      'PASSOU: comprador notificado quando a encomenda é entregue'
    );


  } finally {
    // ==========================================
    // LIMPEZA AUTOMÁTICA
    // ==========================================

    // Desligar todos os sockets.
    sockets.forEach(socket => socket.disconnect());

    // Eliminar apenas os dados temporários.
    if (mongoose.connection.readyState === 1) {
      try {
        if (leilaoId) {
          // Eliminar a encomenda criada pelo teste.
          await Order.deleteMany({
            leilao: leilaoId
          });

          // Eliminar as licitações temporárias.
          await Bid.deleteMany({
            leilao: leilaoId
          });

          // Eliminar o leilão temporário.
          const limpeza = await Auction.deleteOne({
            _id: leilaoId
          });

          assert.equal(
            limpeza.deletedCount,
            1,
            'Leilão temporário não foi eliminado'
          );

          console.log(
            'LIMPEZA: leilão temporário eliminado'
          );
        }
      } finally {
        await mongoose.disconnect();
      }
    }
  }
});

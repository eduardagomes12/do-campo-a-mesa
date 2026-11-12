// Passo 4 — Dados de exemplo para as seis coleções
// ATENÇÃO: npm run seed APAGA os dados anteriores.

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Review = require('../models/Review');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    // 1. Limpar os dados anteriores
    const modelos = [
      User,
      Product,
      Order,
      Auction,
      Bid,
      Review
    ];

    await Promise.all(
      modelos.map((Modelo) => Modelo.deleteMany({}))
    );

    // Garantir a existência da coleção bids,
    // mesmo sem licitações iniciais
    await Bid.createCollection();

    // 2. Criar utilizadores
    const passwordHash = await bcrypt.hash('password123', 12);

    const [admin, horta, mel, comprador] = await User.create([
      {
        nome: 'Administração',
        email: 'admin@exemplo.pt',
        passwordHash,
        papel: 'admin'
      },
      {
        nome: 'Horta da Ribeira',
        email: 'horta@exemplo.pt',
        passwordHash,
        papel: 'produtor',
        produtor: {
          nomeExploracao: 'Horta da Ribeira',
          localidade: 'Ponte de Lima',
          validado: true
        }
      },
      {
        nome: 'Mel do Soajo',
        email: 'mel@exemplo.pt',
        passwordHash,
        papel: 'produtor',
        produtor: {
          nomeExploracao: 'Mel do Soajo',
          localidade: 'Arcos de Valdevez',
          validado: true
        }
      },
      {
        nome: 'Tasca do Lima',
        email: 'tasca@exemplo.pt',
        passwordHash,
        papel: 'comprador'
      }
    ]);

    // 3. Criar produtos
    const produtos = await Product.create([
      {
        produtor: horta._id,
        nome: 'Kiwi Hayward',
        categoria: 'Fruta',
        preco: 2.4,
        unidade: 'kg',
        stock: 300,
        biologico: true,
        epocas: ['Outono', 'Inverno']
      },
      {
        produtor: horta._id,
        nome: 'Abóbora-menina',
        categoria: 'Hortícolas',
        preco: 1.2,
        unidade: 'kg',
        stock: 80,
        epocas: ['Outono']
      },
      {
        produtor: horta._id,
        nome: 'Couve-galega',
        categoria: 'Hortícolas',
        preco: 1.5,
        unidade: 'molho',
        stock: 40,
        biologico: true,
        epocas: ['Outono', 'Inverno']
      },
      {
        produtor: mel._id,
        nome: 'Mel de urze',
        categoria: 'Mel',
        preco: 7.5,
        unidade: '500 g',
        stock: 38
      },
      {
        produtor: mel._id,
        nome: 'Mel de castanheiro',
        categoria: 'Mel',
        preco: 7.0,
        unidade: '500 g',
        stock: 21
      }
    ]);

    const kiwi = produtos[0];
    const melUrze = produtos[3];

    // 4. Criar encomendas de exemplo
    const [encomendaEntregue] = await Order.create([
      {
        comprador: comprador._id,
        produtor: horta._id,
        linhas: [
          {
            produto: kiwi._id,
            nome: kiwi.nome,
            precoUnit: kiwi.preco,
            unidade: kiwi.unidade,
            quantidade: 2
          }
        ],
        estado: 'entregue',
        entrega: {
          tipo: 'levantamento'
        },
        origem: 'loja'
      },
      {
        comprador: comprador._id,
        produtor: mel._id,
        linhas: [
          {
            produto: melUrze._id,
            nome: melUrze.nome,
            precoUnit: melUrze.preco,
            unidade: melUrze.unidade,
            quantidade: 1
          }
        ],
        estado: 'pendente',
        entrega: {
          tipo: 'levantamento'
        },
        origem: 'loja'
      }
    ]);

    // 5. Criar uma avaliação associada à
    // encomenda que já foi entregue
    await Review.create({
      autor: comprador._id,
      produtor: horta._id,
      produto: kiwi._id,
      encomenda: encomendaEntregue._id,
      classificacao: 5,
      comentario: 'Kiwis frescos e de ótima qualidade.'
    });

    // 6. Criar leilão com datas relativas ao momento atual
    const agora = Date.now();
    const MIN = 60 * 1000;

    await Auction.create({
      produtor: horta._id,
      produto: kiwi._id,
      lote: '200 kg de kiwi Hayward, calibre A',
      quantidade: '200 kg',
      descricao: 'Excedente da colheita de outubro, em caixas de 10 kg.',
      precoBase: 200,
      incremento: 5,
      licitacaoAtual: {
        valor: 200
      },
      iniciaEm: new Date(agora),
      terminaEm: new Date(agora + 30 * MIN),
      estado: 'ativo'
    });

    // A coleção bids fica vazia inicialmente.
    // As licitações reais serão criadas no Passo 7.

    console.log('Seed concluído. Utilizadores (password: password123):');

    console.log(
      [admin, horta, mel, comprador]
        .map(
          (u) => `  ${u.papel.padEnd(10)} ${u.email}`
        )
        .join('\n')
    );

    console.log('As seis coleções foram preparadas.');
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

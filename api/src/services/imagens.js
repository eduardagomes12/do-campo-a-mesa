const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { BlobServiceClient } = require('@azure/storage-blob');

// Formatos permitidos
const TIPOS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

let container;

// Obter o container do Azure
function obterContainer() {
  if (!container) {
    container = BlobServiceClient
      .fromConnectionString(process.env.STORAGE_CONN)
      .getContainerClient(
        process.env.STORAGE_CONTAINER || 'produtos'
      );
  }

  return container;
}

// Guardar imagem localmente ou na Cloud
async function guardarImagem(ficheiro, req) {
  if (!ficheiro) {
    throw Object.assign(
      new Error('Seleciona uma imagem'),
      { status: 400 }
    );
  }

  const extensao = TIPOS[ficheiro.mimetype];

  if (!extensao) {
    throw Object.assign(
      new Error('Formato não suportado. Usa JPEG, PNG ou WebP.'),
      { status: 400 }
    );
  }

  // Gerar um nome único para evitar conflitos
  const nome = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extensao}`;

  // ==================================
  // PRODUÇÃO — AZURE BLOB STORAGE
  // ==================================

  if (process.env.STORAGE_CONN) {
    const blob = obterContainer().getBlockBlobClient(nome);

    await blob.uploadData(ficheiro.buffer, {
      blobHTTPHeaders: {
        blobContentType: ficheiro.mimetype
      }
    });

    return blob.url;
  }

  // ==================================
  // DESENVOLVIMENTO — STORAGE LOCAL
  // ==================================

  const pasta = path.join(
    __dirname,
    '..',
    '..',
    'uploads'
  );

  await fs.mkdir(pasta, { recursive: true });

  await fs.writeFile(
    path.join(pasta, nome),
    ficheiro.buffer,
    { flag: 'wx' }
  );

  return `${req.protocol}://${req.get('host')}/uploads/${nome}`;
}

module.exports = { guardarImagem };

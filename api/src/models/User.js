const { Schema, model } = require('mongoose');

// Modelo do utilizador:
// comprador, produtor ou administrador
const userSchema = new Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^\S+@\S+\.\S+$/
  },

  passwordHash: {
    type: String,
    required: true,
    select: false
  },

  papel: {
    type: String,
    enum: ['comprador', 'produtor', 'admin'],
    default: 'comprador'
  },

  // Dados específicos do produtor
  produtor: {
    nomeExploracao: String,

    descricao: {
      type: String,
      maxlength: 1000
    },

    localidade: String,

    localizacao: {
      lat: Number,
      lng: Number
    },

    // Indica se o administrador aprovou o produtor
    validado: {
      type: Boolean,
      default: false
    },

    // Permite distinguir rejeitados de pendentes
    rejeitado: {
      type: Boolean,
      default: false
    }
  }
}, { timestamps: true });

// Dados que podem ser enviados ao cliente
// Nunca incluir passwordHash
userSchema.methods.publico = function publico() {
  return {
    id: this._id,
    nome: this.nome,
    email: this.email,
    papel: this.papel,

    ...(this.papel === 'produtor'
      ? { produtor: this.produtor }
      : {})
  };
};

module.exports = model('User', userSchema);

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';

import { api } from '../api/client.js';

// Estado global da sessão (utilizador + token)
const AuthContext = createContext(null);

function lerSessaoGuardada() {
  try {
    const guardada = JSON.parse(
      localStorage.getItem('sessao')
    );

    return guardada?.token && guardada?.utilizador
      ? guardada
      : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(lerSessaoGuardada);

  const [aValidar, setAValidar] = useState(
    () => Boolean(lerSessaoGuardada()?.token)
  );

  const guardarSessao = useCallback((nova) => {
    localStorage.setItem('sessao', JSON.stringify(nova));
    setSessao(nova);
  }, []);

  function sair() {
    localStorage.removeItem('sessao');
    setSessao(null);
  }

  // TODO (Passo 6): chamar POST /api/auth/login e guardar { token, utilizador }
  async function entrar(email, password) {
    const dados = await api('/auth/login', {
      metodo: 'POST',
      corpo: { email, password }
    });

    if (!dados?.token || !dados?.utilizador) {
      throw new Error('Resposta de login inválida');
    }

    guardarSessao({
      token: dados.token,
      utilizador: dados.utilizador
    });

    return dados.utilizador;
  }

  // Registar não inicia sessão automaticamente.
  // O backend devolve apenas { id }.
  async function registar(corpo) {
    return api('/auth/registo', {
      metodo: 'POST',
      corpo
    });
  }

  // Atualizar os dados do utilizador autenticado
  const atualizar = useCallback(async () => {
    if (!sessao?.token) return null;

    const tokenAtual = sessao.token;

    try {
      const utilizador = await api('/auth/eu', {
        token: tokenAtual
      });

      guardarSessao({
        token: tokenAtual,
        utilizador
      });

      return utilizador;
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem('sessao');
        setSessao(null);
      }

      throw err;
    }
  }, [sessao?.token, guardarSessao]);

  // Validar a sessão quando a aplicação arranca
  // e sempre que o token muda.
  useEffect(() => {
    const tokenAtual = sessao?.token;

    if (!tokenAtual) {
      setAValidar(false);
      return;
    }

    let ativo = true;
    setAValidar(true);

    api('/auth/eu', { token: tokenAtual })
      .then((utilizador) => {
        if (!ativo) return;

        setSessao((atual) => {
          if (atual?.token !== tokenAtual) {
            return atual;
          }

          const nova = { ...atual, utilizador };

          localStorage.setItem(
            'sessao',
            JSON.stringify(nova)
          );

          return nova;
        });
      })
      .catch((err) => {
        if (!ativo || err.status !== 401) return;

        setSessao((atual) => {
          if (atual?.token !== tokenAtual) {
            return atual;
          }

          localStorage.removeItem('sessao');
          return null;
        });
      })
      .finally(() => {
        if (ativo) setAValidar(false);
      });

    return () => {
      ativo = false;
    };
  }, [sessao?.token]);

  return (
    <AuthContext.Provider
      value={{
        utilizador: sessao?.utilizador || null,
        token: sessao?.token || null,
        aValidar,
        entrar,
        registar,
        sair,
        guardarSessao,
        atualizar
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

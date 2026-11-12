import { useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dados, setDados] = useState({
    email: '',
    password: ''
  });

  const [erro, setErro] = useState('');
  const [aEntrar, setAEntrar] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    setErro('');
    setAEntrar(true);

    try {
      const utilizador = await entrar(
        dados.email,
        dados.password
      );

      const destinos = {
        comprador: '/',
        produtor: '/produtor',
        admin: '/admin'
      };

      
      navigate(
        destinos[utilizador.papel] || '/',
        { replace: true }
      );

    } catch (err) {
      setErro(err.message);
    } finally {
      setAEntrar(false);
    }
  }

  return (
    <form
      className="formulario-estreito"
      onSubmit={submeter}
    >
      <h1>Entrar</h1>

      {location.state?.registado && (
        <div className="alert alert-success" role="status">
          Conta criada com sucesso. Já podes iniciar sessão.
        </div>
      )}

      <label htmlFor="email" className="form-label">
        Email
      </label>

      <input
        id="email"
        type="email"
        className="form-control mb-3"
        required
        autoComplete="email"
        value={dados.email}
        onChange={(e) =>
          setDados({ ...dados, email: e.target.value })
        }
      />

      <label htmlFor="password" className="form-label">
        Password
      </label>

      <input
        id="password"
        type="password"
        className="form-control mb-3"
        required
        autoComplete="current-password"
        value={dados.password}
        onChange={(e) =>
          setDados({ ...dados, password: e.target.value })
        }
      />

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-success w-100"
        disabled={aEntrar}
      >
        {aEntrar ? 'A entrar...' : 'Entrar'}
      </button>

      <p className="mt-3 text-center">
        Ainda não tens conta?{' '}
        <Link to="/registo">Registar</Link>
      </p>
    </form>
  );
}

import {
  createContext,
  useContext,
  useEffect,
  useState
} from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return undefined;
    }

    // O Socket.io liga à origem, não à rota /api.
    const servidor = new URL(
      API_URL,
      window.location.origin
    ).origin;

    const ligacao = io(servidor, {
      auth: { token },
      reconnection: true
    });

    setSocket(ligacao);

    return () => {
      ligacao.disconnect();
      setSocket((atual) =>
        atual === ligacao ? null : atual
      );
    };
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);

// Subscrever um evento e limpar a subscrição ao desmontar.
export function useEventoSocket(evento, handler) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return undefined;

    socket.on(evento, handler);

    return () => socket.off(evento, handler);
  }, [socket, evento, handler]);
}

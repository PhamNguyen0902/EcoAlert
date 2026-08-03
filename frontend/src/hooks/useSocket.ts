import { useSocket as useSocketContext } from '../contexts/SocketContext';
import { useEffect } from 'react';

export const useSocket = (event?: string, callback?: (data: any) => void) => {
  const context = useSocketContext();

  useEffect(() => {
    if (!context.socket || !event || !callback) return;

    context.socket.on(event, callback);

    return () => {
      context.socket?.off(event, callback);
    };
  }, [context.socket, event, callback]);

  return context;
};

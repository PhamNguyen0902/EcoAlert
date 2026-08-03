import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../utils/constants';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // API_BASE_URL derived from environment or constants
    const socketHost = API_BASE_URL.replace('/api/v1', '');
    const socketInstance = io(socketHost, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    });

    socketInstance.on('connect', () => {
      console.log('[Mobile Socket] Connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('[Mobile Socket] Disconnected');
      setIsConnected(false);
    });

    socketInstance.on('alert:created', (data) => {
      console.log('[Mobile Socket] alert:created', data);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
    });

    socketInstance.on('alert:updated', (data) => {
      console.log('[Mobile Socket] alert:updated', data);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['alert', data._id || data.alertId] });
    });

    socketInstance.on('image:analyzed', (data) => {
      console.log('[Mobile Socket] image:analyzed', data);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['alert', data._id || data.alertId] });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [queryClient]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

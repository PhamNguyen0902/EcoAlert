import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../utils/constants';
import { useProfile } from '../hooks/useAuth';

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
  const { data: user } = useProfile();
  const userRef = useRef(user);

  // Keep userRef updated for socket callbacks
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // 1. Initialize persistent Socket instance
  useEffect(() => {
    let socketHost: string;
    try {
      socketHost = new URL(API_BASE_URL).origin;
    } catch {
      socketHost = API_BASE_URL.replace(/\/api(\/v1)?\/?$/, '');
    }

    console.log('[Mobile Socket] Connecting to:', socketHost);
    const socketInstance = io(socketHost, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('[Mobile Socket] Connected:', socketInstance.id);
      setIsConnected(true);

      const currentUser = userRef.current;
      if (currentUser?._id) {
        socketInstance.emit('join', {
          userId: currentUser._id,
          role: currentUser.role,
        });
        console.log(`[Mobile Socket] Emitted join room for user:${currentUser._id}, role:${currentUser.role}`);
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Mobile Socket] Disconnected, reason:', reason);
      setIsConnected(false);
    });

    const refreshActiveData = () => {
      queryClient.invalidateQueries();
      queryClient.refetchQueries({ type: 'active' });
    };

    socketInstance.on('alert:created', (data) => {
      console.log('[Mobile Socket] alert:created', data);
      refreshActiveData();
    });

    socketInstance.on('alert:updated', (data) => {
      console.log('[Mobile Socket] alert:updated', data);
      refreshActiveData();
    });

    socketInstance.on('image:analyzed', (data) => {
      console.log('[Mobile Socket] image:analyzed', data);
      refreshActiveData();
    });

    socketInstance.on('officer:assigned', (data) => {
      console.log('[Mobile Socket] officer:assigned', data);
      refreshActiveData();
    });

    socketInstance.on('realtime:event', (data) => {
      console.log('[Mobile Socket] realtime:event', data);
      refreshActiveData();
    });

    setSocket(socketInstance);

    return () => {
      console.log('[Mobile Socket] Unmounting SocketProvider');
      socketInstance.disconnect();
    };
  }, [queryClient]);

  // 2. Handle user changes (login/logout/switch account) on existing socket without reconnecting
  useEffect(() => {
    if (socket && isConnected && user?._id) {
      socket.emit('join', {
        userId: user._id,
        role: user.role,
      });
      console.log(`[Mobile Socket] User updated -> Emitted join room for user:${user._id}, role:${user.role}`);
    }
  }, [socket, isConnected, user?._id, user?.role]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);



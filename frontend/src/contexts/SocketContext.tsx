import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

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
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Target API Gateway port 3000 directly or via Vite proxy
    const socketUrl = window.location.port === '5173' ? 'http://localhost:3000' : window.location.origin;
    const socketInstance = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected to server, ID:', socketInstance.id);
      setIsConnected(true);

      // Join room by user role & userId if logged in
      if (user) {
        socketInstance.emit('join', {
          userId: user._id,
          role: user.role,
        });
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      setIsConnected(false);
    });

    const refreshActiveData = () => {
      queryClient.invalidateQueries();
      queryClient.refetchQueries({ type: 'active' });
    };

    socketInstance.on('alert:created', (data: any) => {
      console.log('[Socket] New alert created:', data);
      const alertId = data._id || data.alertId || 'new';
      toast.success(`Sự cố mới vừa được báo cáo: ${data.title || 'Không có tiêu đề'}`, {
        id: `alert-created-${alertId}`,
        duration: 5000,
        position: 'top-right',
      });
      refreshActiveData();
    });

    socketInstance.on('alert:updated', (data: any) => {
      console.log('[Socket] Alert updated:', data);
      const alertId = data._id || data.alertId || 'update';
      toast('Trạng thái sự cố đã được cập nhật!', {
        id: `alert-updated-${alertId}`,
        icon: '🔄',
        duration: 4000,
        position: 'top-right',
      });
      refreshActiveData();
    });

    socketInstance.on('image:analyzed', (data: any) => {
      console.log('[Socket] Image analyzed by AI:', data);
      const alertId = data._id || data.alertId || 'analyzed';
      toast(`AI đã phân tích sự cố! Mức độ: ${data.suggestedPriority || data.severity || 'đã cập nhật'}`, {
        id: `image-analyzed-${alertId}`,
        icon: '🤖',
        duration: 5000,
        position: 'top-right',
      });
      refreshActiveData();
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user, token, queryClient]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

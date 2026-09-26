import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { playNotificationSound } from '@/lib/audio-alert';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}
// tạo ngữ cảnh WebSocket để quản lý kết nối socket và cung cấp thông tin trạng thái kết nối trong toàn bộ ứng dụng.
const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const userRef = useRef(user);
  const tRef = useRef(t);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    // Realtime updates are meaningful only after an authenticated user exists.
    // Avoid reconnect traffic while the login page is open or a session expires.
    if (!user?._id) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // trỏ trực tiếp đến api gateway cổng 3000 hoặc qua vite proxy
    const { protocol, hostname, port } = window.location;
    const socketUrl = (port === '5173' || port === '4173') ? `${protocol}//${hostname}:3000` : window.location.origin;
    console.log('[Web Socket] Connecting to:', socketUrl);

    const socketInstance = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('[Web Socket] Connected to server, ID:', socketInstance.id);
      setIsConnected(true);

      const currentUser = userRef.current;
      if (currentUser?._id) {
        socketInstance.emit('join', {
          userId: currentUser._id,
          role: currentUser.role,
        });
        console.log(`[Web Socket] Emitted join room for user:${currentUser._id}, role:${currentUser.role}`);
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Web Socket] Disconnected from server, reason:', reason);
      setIsConnected(false);
    });

    const refreshActiveData = () => {
      // Refetch only views affected by a realtime incident event. Invalidating
      // all queries caused unrelated screens to reload for every notification.
      queryClient.invalidateQueries({ queryKey: ['alerts'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['notifications'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['officer-tasks'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['users'], refetchType: 'active' });
    };

    const isSelfAction = (data: any) => {
      const currentUserId = userRef.current?._id || (userRef.current as any)?.id;
      if (!currentUserId || !data) return false;
      const actorId = data.actorId || data.updatedBy || data.deletedBy || data.userId || data.citizenId || data.createdBy;
      return Boolean(actorId && String(actorId) === String(currentUserId));
    };

    socketInstance.on('alert:created', (data: any) => {
      console.log('[Web Socket] New alert created:', data);
      refreshActiveData();

      if (isSelfAction(data)) return;

      playNotificationSound('alert');
      const alertId = data._id || data.alertId || 'new';
      const titleStr = data.title ? ` ${data.title}` : '';
      toast.success(`${tRef.current('toast.new_alert_created')}${titleStr}`, {
        id: `alert-created-${alertId}`,
        duration: 5000,
        position: 'top-right',
      });
    });

    socketInstance.on('alert:updated', (data: any) => {
      console.log('[Web Socket] Alert updated:', data);
      refreshActiveData();

      if (isSelfAction(data)) return;

      playNotificationSound('info');
      const alertId = data._id || data.alertId || 'update';
      if (data.isDeleted || data.status === 'deleted') {
        toast(tRef.current('toast.alert_deleted'), {
          id: `alert-updated-${alertId}`,
          icon: '🗑️',
          duration: 4000,
          position: 'top-right',
        });
      } else {
        toast(tRef.current('toast.alert_updated'), {
          id: `alert-updated-${alertId}`,
          icon: '🔄',
          duration: 4000,
          position: 'top-right',
        });
      }
    });

    // nhận kết quả phân tích hình ảnh từ AI và hiển thị thông báo cho người dùng.
    socketInstance.on('image:analyzed', (data: any) => {
      console.log('[Web Socket] Image analyzed by AI:', data);
      playNotificationSound('success');
      const alertId = data._id || data.alertId || 'analyzed';
      const severityStr = data.suggestedPriority || data.severity || '';
      toast(`${tRef.current('toast.ai_analyzed')} ${severityStr}`, {
        id: `image-analyzed-${alertId}`,
        icon: '🤖',
        duration: 5000,
        position: 'top-right',
      });
      refreshActiveData();
    });

    socketInstance.on('officer:assigned', (data: any) => {
      console.log('[Web Socket] Officer assigned:', data);
      playNotificationSound('alert');
      refreshActiveData();
    });

    socketInstance.on('realtime:event', (data: any) => {
      console.log('[Web Socket] Realtime event:', data);
      playNotificationSound('info');
      refreshActiveData();
    });

    setSocket(socketInstance);

    return () => {
      console.log('[Web Socket] Unmounting SocketProvider');
      socketInstance.disconnect();
    };
  }, [queryClient, user?._id, user?.role]);

  // gửi sự kiện tham gia phòng khi thông tin người dùng được cập nhật trên kết nối hiện có
  useEffect(() => {
    if (socket && isConnected && user?._id) {
      socket.emit('join', {
        userId: user._id,
        role: user.role,
      });
      console.log(`[Web Socket] User updated -> Emitted join room for user:${user._id}, role:${user.role}`);
    }
  }, [socket, isConnected, user?._id, user?.role]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

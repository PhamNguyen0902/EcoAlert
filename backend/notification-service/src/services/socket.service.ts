import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createLogger } from '@ecoalert/shared';
import jwt from 'jsonwebtoken';

const logger = createLogger('notification-service:socket');

export class SocketService {
  private io: SocketIOServer | null = null;

  public initialize(httpServer: HttpServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (typeof token !== 'string' || !process.env.JWT_SECRET) throw new Error();
        const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (typeof claims === 'string' || typeof claims.userId !== 'string' ||
          !/^[a-f\d]{24}$/i.test(claims.userId) || !['CITIZEN', 'OFFICER', 'ADMIN'].includes(claims.role) || !claims.exp) throw new Error();
        socket.data.identity = { userId: claims.userId, role: claims.role, expiresAt: claims.exp * 1000 };
        next();
      } catch { next(new Error('Vui lòng đăng nhập lại để nhận thông báo.')); }
    });
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected to WebSocket: ${socket.id}`);

      const { userId, role, expiresAt } = socket.data.identity;
      socket.join(`user:${userId}`);
      socket.join(`role:${role}`);
      // Ignore legacy 'join' payloads: only signed claims select private rooms.
      const expiry = setTimeout(() => socket.disconnect(true), Math.min(expiresAt - Date.now(), 2_147_483_647));

      socket.on('disconnect', (reason: string) => {
        clearTimeout(expiry);
        logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });
    });

    logger.info('Socket.IO initialized on notification-service');
    return this.io;
  }

  public getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.IO is not initialized!');
    }
    return this.io;
  }

  public emitToAll(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
      logger.info(`Emitted '${event}' to all clients`);
    }
  }

  public emitToRoom(room: string, event: string, data: any) {
    if (this.io) {
      this.io.to(room).emit(event, data);
      logger.info(`Emitted '${event}' to room '${room}'`);
    }
  }
  public emitToRooms(rooms: string[], event: string, data: unknown) {
    this.io?.to(rooms).emit(event, data);
  }
}

export const socketService = new SocketService();

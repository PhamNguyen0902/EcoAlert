import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createLogger } from '@ecoalert/shared';

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

    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected to WebSocket: ${socket.id}`);

      // Allow client to join user/role specific rooms
      socket.on('join', (data: { userId?: string; role?: string }) => {
        if (data.userId) {
          socket.join(`user:${data.userId}`);
          logger.info(`Socket ${socket.id} joined room user:${data.userId}`);
        }
        if (data.role) {
          socket.join(`role:${data.role}`);
          logger.info(`Socket ${socket.id} joined room role:${data.role}`);
        }
      });

      socket.on('disconnect', (reason: string) => {
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
}

export const socketService = new SocketService();

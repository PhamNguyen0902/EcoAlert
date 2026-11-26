import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createLogger } from '@ecoalert/shared';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

const logger = createLogger('notification-service:socket');

export class SocketService {
  private io: SocketIOServer | null = null;
  private redisClient: Redis | null = null;
  private blacklistChecker: ((token: string) => Promise<boolean>) | null = null;

  public setBlacklistChecker(checker: ((token: string) => Promise<boolean>) | null) {
    this.blacklistChecker = checker;
  }

  public async closeRedis() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      } finally {
        this.redisClient = null;
      }
    }
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    if (this.blacklistChecker) {
      return this.blacklistChecker(token);
    }
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return false;
    try {
      if (!this.redisClient) {
        this.redisClient = new Redis(redisUrl, {
          connectTimeout: 2_000,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
        });
        this.redisClient.on('error', (err) => {
          logger.warn('Notification Redis blacklist error', {
            message: err instanceof Error ? err.message : String(err),
          });
        });
      }
      const blacklisted = await this.redisClient.get(`blacklist:${token}`);
      return Boolean(blacklisted);
    } catch (error) {
      logger.warn('Notification Redis blacklist lookup unavailable; continuing', {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  public initialize(httpServer: HttpServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (typeof token !== 'string' || !process.env.JWT_SECRET) throw new Error();
        const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (typeof claims === 'string' || typeof claims.userId !== 'string' ||
          !/^[a-f\d]{24}$/i.test(claims.userId) || !['CITIZEN', 'OFFICER', 'ADMIN'].includes(claims.role) || !claims.exp) throw new Error();
        if (await this.isTokenBlacklisted(token)) {
          return next(new Error('Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.'));
        }
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
      const expiry = setTimeout(
        () => socket.disconnect(true),
        Math.max(0, Math.min(expiresAt - Date.now(), 2_147_483_647)),
      );

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

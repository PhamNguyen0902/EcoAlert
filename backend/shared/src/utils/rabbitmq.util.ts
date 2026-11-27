export interface RabbitChannelLike {
  on(event: 'error' | 'close', listener: (...args: any[]) => void): unknown;
  assertExchange(
    exchange: string,
    type: string,
    options?: { durable?: boolean },
  ): Promise<unknown>;
  assertQueue(
    queue: string,
    options?: { durable?: boolean; arguments?: Record<string, unknown> },
  ): Promise<{ queue: string }>;
  bindQueue(queue: string, source: string, pattern: string): Promise<unknown>;
}

export interface RabbitConnectionLike {
  on(event: 'error' | 'close', listener: (...args: any[]) => void): unknown;
}

export interface RabbitMQLoggerLike {
  info: (message: string, meta?: unknown) => unknown;
  warn: (message: string, meta?: unknown) => unknown;
  error: (message: string, meta?: unknown) => unknown;
}

export interface ResilientRabbitMQOptions<
  TConn extends RabbitConnectionLike,
  TChan extends RabbitChannelLike,
> {
  connect: () => Promise<TConn>;
  createChannel: (connection: TConn) => Promise<TChan>;
  queueName: string;
  dlqName: string;
  exchangeName?: string;
  dlxExchangeName?: string;
  reconnectDelayMs?: number;
  logger: RabbitMQLoggerLike;
  onConnected: (channel: TChan, queue: string) => Promise<void>;
}

export interface ResilientRabbitMQConnector<TChan extends RabbitChannelLike> {
  connect: () => Promise<void>;
  getChannel: () => TChan | undefined;
  stop: () => void;
}

/**
 * Creates a resilient RabbitMQ connector with deduplicated reconnect timers,
 * connection/channel error & close recovery, and DLX/DLQ declaration (falling
 * back safely if a legacy queue already exists without DLX arguments).
 */
export function createResilientRabbitMQConnector<
  TConn extends RabbitConnectionLike,
  TChan extends RabbitChannelLike,
>(
  options: ResilientRabbitMQOptions<TConn, TChan>,
): ResilientRabbitMQConnector<TChan> {
  const exchangeName = options.exchangeName ?? 'ecoalert_exchange';
  const dlxExchangeName = options.dlxExchangeName ?? 'ecoalert_dlx';
  const reconnectDelayMs = options.reconnectDelayMs ?? 5000;

  let connection: TConn | undefined;
  let channel: TChan | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isConnecting = false;
  let stopped = false;

  const scheduleReconnect = () => {
    channel = undefined;
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, reconnectDelayMs);
    reconnectTimer.unref();
  };

  const attachChannelHandlers = (ch: TChan) => {
    ch.on('error', (error) => {
      options.logger.warn('RabbitMQ channel error', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    });
    ch.on('close', () => {
      options.logger.warn('RabbitMQ channel closed; scheduling reconnect');
      scheduleReconnect();
    });
  };

  const assertQueueWithDlq = async (conn: TConn, ch: TChan): Promise<{ queue: string; activeChannel: TChan }> => {
    await ch.assertExchange(dlxExchangeName, 'direct', { durable: true });
    await ch.assertQueue(options.dlqName, { durable: true });
    await ch.bindQueue(options.dlqName, dlxExchangeName, options.queueName);

    try {
      const asserted = await ch.assertQueue(options.queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': dlxExchangeName,
          'x-dead-letter-routing-key': options.queueName,
        },
      });
      return { queue: asserted.queue, activeChannel: ch };
    } catch (error) {
      if ((error as { code?: number })?.code !== 406) throw error;
      options.logger.warn(
        `Legacy queue ${options.queueName} lacks DLX arguments; recreating channel without DLX args`,
      );
      const nextChannel = await options.createChannel(conn);
      attachChannelHandlers(nextChannel);
      await nextChannel.assertExchange(exchangeName, 'topic', { durable: true });
      const asserted = await nextChannel.assertQueue(options.queueName, { durable: true });
      return { queue: asserted.queue, activeChannel: nextChannel };
    }
  };

  const connect = async (): Promise<void> => {
    if (isConnecting) return;
    stopped = false;
    isConnecting = true;
    try {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const conn = await options.connect();
      connection = conn;
      conn.on('error', (error) => {
        options.logger.warn('RabbitMQ connection error', {
          errorType: error instanceof Error ? error.name : 'UnknownError',
        });
      });
      conn.on('close', () => {
        options.logger.warn('RabbitMQ connection closed; scheduling reconnect');
        scheduleReconnect();
      });

      const ch = await options.createChannel(conn);
      attachChannelHandlers(ch);
      await ch.assertExchange(exchangeName, 'topic', { durable: true });

      const { queue, activeChannel } = await assertQueueWithDlq(conn, ch);
      channel = activeChannel;
      await options.onConnected(activeChannel, queue);
    } catch (error) {
      options.logger.error('RabbitMQ connection failed', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      scheduleReconnect();
    } finally {
      isConnecting = false;
    }
  };

  return {
    connect,
    getChannel: () => (connection && channel ? channel : undefined),
    stop: () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      channel = undefined;
      connection = undefined;
    },
  };
}

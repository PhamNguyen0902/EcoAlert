import amqp from 'amqplib';
import { envConfig } from '../config/env.config';
import { createLogger, IEventMessage, EVENTS } from '@ecoalert/shared';
import { gisService } from './gis.service';

const logger = createLogger('gis-service');
type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

//RabbitMQ để quản lý kết nối và xử lý các sự kiện liên quan đến GIS
// bao gồm việc lắng nghe các sự kiện từ hàng đợi và lưu trữ dữ liệu vị trí vào cơ sở dữ liệu.
class RabbitMQService {
  private connection: AmqpConnection | undefined;
  private channel: AmqpChannel | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;

  private scheduleReconnect(delayMs = 5000) {
    this.channel = undefined;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delayMs);
    this.reconnectTimer.unref();
  }

  private attachChannelHandlers(channel: AmqpChannel) {
    channel.on('error', (error) => {
      logger.warn('RabbitMQ channel error', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    });
    channel.on('close', () => {
      logger.warn('RabbitMQ channel closed; scheduling reconnect');
      this.scheduleReconnect();
    });
  }

  private async assertQueueWithDlq(queueName: string, dlqName: string) {
    if (!this.channel || !this.connection) {
      throw new Error('RabbitMQ channel is unavailable');
    }
    await this.channel.assertExchange('ecoalert_dlx', 'direct', { durable: true });
    await this.channel.assertQueue(dlqName, { durable: true });
    await this.channel.bindQueue(dlqName, 'ecoalert_dlx', queueName);

    try {
      return await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'ecoalert_dlx',
          'x-dead-letter-routing-key': queueName,
        },
      });
    } catch (error) {
      if ((error as { code?: number })?.code !== 406) throw error;
      logger.warn(`Legacy queue ${queueName} lacks DLX arguments; recreating channel without DLX args`);
      this.channel = await this.connection.createChannel();
      this.attachChannelHandlers(this.channel);
      await this.channel.assertExchange('ecoalert_exchange', 'topic', { durable: true });
      return this.channel.assertQueue(queueName, { durable: true });
    }
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.connection = await amqp.connect(envConfig.rabbitMqUrl);
      this.connection.on('error', (error) => {
        logger.warn('RabbitMQ connection error', {
          errorType: error instanceof Error ? error.name : 'UnknownError',
        });
      });
      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed; scheduling reconnect');
        this.scheduleReconnect();
      });
      this.channel = await this.connection.createChannel();
      this.attachChannelHandlers(this.channel);

      await this.channel.assertExchange('ecoalert_exchange', 'topic', { durable: true });

      const q = await this.assertQueueWithDlq('gis_service_queue', 'gis_service_dlq');
      // Đồng bộ read model bản đồ khi báo cáo mới được tạo hoặc workflow thay đổi.
      await this.channel.bindQueue(q.queue, 'ecoalert_exchange', EVENTS.ALERT_CREATED);
      await this.channel.bindQueue(q.queue, 'ecoalert_exchange', EVENTS.ALERT_UPDATED);

      await this.channel.prefetch(1);
      this.channel.consume(q.queue, async (msg) => {
        if (msg && this.channel) {
          try {
            const event: IEventMessage<any> = JSON.parse(msg.content.toString());
            await gisService.saveLocation(event.data);
            this.channel.ack(msg);
          } catch (error) {
            logger.error('Error processing GIS msg', error);
            this.channel.nack(msg, false, false);
          }
        }
      });

      logger.info('Connected to RabbitMQ and listening to gis_service_queue');
    } catch (error) {
      logger.error('RabbitMQ Connection Error:', error);
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }
}

export const rabbitMQService = new RabbitMQService();

import amqp from 'amqplib';
import { envConfig } from '../config/env.config';
import {
  createLogger,
  createResilientRabbitMQConnector,
  IEventMessage,
  EVENTS,
} from '@ecoalert/shared';
import { gisService } from './gis.service';

const logger = createLogger('gis-service');
type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

//RabbitMQ để quản lý kết nối và xử lý các sự kiện liên quan đến GIS
// bao gồm việc lắng nghe các sự kiện từ hàng đợi và lưu trữ dữ liệu vị trí vào cơ sở dữ liệu.
class RabbitMQService {
  private readonly connector = createResilientRabbitMQConnector<
    AmqpConnection,
    AmqpChannel
  >({
    connect: () => amqp.connect(envConfig.rabbitMqUrl),
    createChannel: (connection) => connection.createChannel(),
    queueName: 'gis_service_queue',
    dlqName: 'gis_service_dlq',
    logger,
    onConnected: async (channel, queue) => {
      // Đồng bộ read model bản đồ khi báo cáo mới được tạo hoặc workflow thay đổi.
      await channel.bindQueue(queue, 'ecoalert_exchange', EVENTS.ALERT_CREATED);
      await channel.bindQueue(queue, 'ecoalert_exchange', EVENTS.ALERT_UPDATED);

      await channel.prefetch(1);
      channel.consume(queue, async (msg) => {
        const activeChannel = this.connector.getChannel();
        if (msg && activeChannel) {
          try {
            const event: IEventMessage<any> = JSON.parse(msg.content.toString());
            await gisService.saveLocation(event.data);
            activeChannel.ack(msg);
          } catch (error) {
            logger.error('Error processing GIS msg', error);
            activeChannel.nack(msg, false, false);
          }
        }
      });

      logger.info('Connected to RabbitMQ and listening to gis_service_queue');
    },
  });

  async connect() {
    await this.connector.connect();
  }
}

export const rabbitMQService = new RabbitMQService();

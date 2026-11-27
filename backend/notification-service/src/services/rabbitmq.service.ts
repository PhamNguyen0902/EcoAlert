import amqp from "amqplib";
import { envConfig } from "../config/env.config";
import { createLogger, IEventMessage, EVENTS } from "@ecoalert/shared";
import { notificationService } from "./notification.service";
import { socketService } from "./socket.service";
import { buildNotificationContent } from "../utils/notification-content";

const logger = createLogger("notification-service");
export interface AlertEventData {
  _id?: string;
  alertId?: string;
  title?: string;
  citizenId?: string;
  assignedOfficerId?: string;
  status?: string;
  previousStatus?: string;
  analysisMode?: string;
  workflowNotificationHandled?: boolean;
}
class RabbitMQService {
  private connection: amqp.ChannelModel | undefined;
  private channel: amqp.Channel | undefined;
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

  private attachChannelHandlers(channel: amqp.Channel) {
    channel.on("error", (error) => {
      logger.warn("RabbitMQ channel error", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    });
    channel.on("close", () => {
      logger.warn("RabbitMQ channel closed; scheduling reconnect");
      this.scheduleReconnect();
    });
  }

  private async assertQueueWithDlq(queueName: string, dlqName: string) {
    if (!this.channel || !this.connection) {
      throw new Error("RabbitMQ channel is unavailable");
    }
    await this.channel.assertExchange("ecoalert_dlx", "direct", {
      durable: true,
    });
    await this.channel.assertQueue(dlqName, { durable: true });
    await this.channel.bindQueue(dlqName, "ecoalert_dlx", queueName);

    try {
      return await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "ecoalert_dlx",
          "x-dead-letter-routing-key": queueName,
        },
      });
    } catch (error) {
      if ((error as { code?: number })?.code !== 406) throw error;
      logger.warn(
        `Legacy queue ${queueName} lacks DLX arguments; recreating channel without DLX args`,
      );
      this.channel = await this.connection.createChannel();
      this.attachChannelHandlers(this.channel);
      await this.channel.assertExchange("ecoalert_exchange", "topic", {
        durable: true,
      });
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
      this.connection.on("error", (error) => {
        logger.warn("RabbitMQ connection error", {
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
      });
      this.connection.on("close", () => {
        logger.warn("RabbitMQ connection closed; scheduling reconnect");
        this.scheduleReconnect();
      });
      this.channel = await this.connection.createChannel();
      this.attachChannelHandlers(this.channel);
      await this.channel.assertExchange("ecoalert_exchange", "topic", {
        durable: true,
      });
      const queue = await this.assertQueueWithDlq(
        "notification_service_queue",
        "notification_service_dlq",
      );
      const events = [
        EVENTS.ALERT_CREATED,
        EVENTS.AI_ANALYZED,
        EVENTS.ALERT_UPDATED,
        EVENTS.OFFICER_ASSIGNED,
        EVENTS.ALERT_STARTED,
        EVENTS.ALERT_ARRIVED,
        EVENTS.ALERT_RESOLVED,
        EVENTS.ALERT_CLOSED,
      ];
      await Promise.all(
        events.map((name) =>
          this.channel!.bindQueue(queue.queue, "ecoalert_exchange", name),
        ),
      );
      await this.channel.prefetch(10);
      await this.channel.consume(queue.queue, async (message) => {
        if (!message || !this.channel) return;
        try {
          await this.handleEvent(JSON.parse(message.content.toString()));
          this.channel.ack(message);
        } catch (error) {
          logger.error("Error processing notification message", error);
          this.channel.nack(message, false, false);
        }
      });
      logger.info("Listening to notification_service_queue");
    } catch (error) {
      logger.error("RabbitMQ Connection Error:", error);
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }
  async handleEvent(event: IEventMessage<AlertEventData>) {
    const data = event.data;
    if (
      event.eventType === EVENTS.ALERT_UPDATED &&
      Boolean(data.workflowNotificationHandled)
    ) {
      return;
    }

    const entity = data.alertId || data._id;
    const alertId =
      typeof entity === "string" && /^[a-f\d]{24}$/i.test(entity)
        ? entity
        : undefined;
    const rooms = [
      "role:ADMIN",
      ...(data.citizenId ? [`user:${data.citizenId}`] : []),
      ...(data.assignedOfficerId ? [`user:${data.assignedOfficerId}`] : []),
    ];

    const isNonTransitionAlertUpdate =
      event.eventType === EVENTS.ALERT_UPDATED &&
      (!data.previousStatus ||
        !data.status ||
        data.previousStatus.toUpperCase() === data.status.toUpperCase());
    const isFailedAiEvent =
      event.eventType === EVENTS.AI_ANALYZED &&
      (!data.analysisMode || data.analysisMode === "FAILED");
    const shouldPersistNotifications =
      !isNonTransitionAlertUpdate && !isFailedAiEvent;

    if (shouldPersistNotifications) {
      const recipients: Array<
        [string | undefined, "CITIZEN" | "OFFICER" | "ADMIN"]
      > = [
        [data.citizenId, "CITIZEN"],
        [data.assignedOfficerId, "OFFICER"],
        ["admins", "ADMIN"],
      ];
      for (const [recipientId, recipientRole] of recipients) {
        if (!recipientId) continue;
        const content = buildNotificationContent({
          eventType: event.eventType,
          status: data.status,
          recipientRole,
          alertTitle: data.title,
        });
        if (content)
          await notificationService.notify(
            recipientId,
            content,
            event.eventId,
            alertId,
            data.title,
            event.eventType,
          );
      }
    }

    // General subscribers get invalidation only, never a private report/AI payload.
    socketService.emitToAll("realtime:event", { type: event.eventType });
    const update = {
      alertId,
      status: data.status,
      title: data.title,
      citizenId: data.citizenId,
      assignedOfficerId: data.assignedOfficerId,
    };
    socketService.emitToRooms(
      rooms,
      event.eventType === EVENTS.ALERT_CREATED
        ? "alert:created"
        : "alert:updated",
      update,
    );
    if (event.eventType === EVENTS.AI_ANALYZED)
      socketService.emitToRooms(rooms, "ai:analyzed", { alertId });
    if (event.eventType === EVENTS.OFFICER_ASSIGNED && data.assignedOfficerId)
      socketService.emitToRoom(
        `user:${data.assignedOfficerId}`,
        "officer:assigned",
        update,
      );
  }
}
export const rabbitMQService = new RabbitMQService();

import amqp from "amqplib";
import { envConfig } from "../config/env.config";
import {
  createLogger,
  createResilientRabbitMQConnector,
  IEventMessage,
  EVENTS,
} from "@ecoalert/shared";
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
  private readonly connector = createResilientRabbitMQConnector<
    amqp.ChannelModel,
    amqp.Channel
  >({
    connect: () => amqp.connect(envConfig.rabbitMqUrl),
    createChannel: (connection) => connection.createChannel(),
    queueName: "notification_service_queue",
    dlqName: "notification_service_dlq",
    logger,
    onConnected: async (channel, queue) => {
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
          channel.bindQueue(queue, "ecoalert_exchange", name),
        ),
      );
      await channel.prefetch(10);
      await channel.consume(queue, async (message) => {
        const activeChannel = this.connector.getChannel();
        if (!message || !activeChannel) return;
        try {
          await this.handleEvent(JSON.parse(message.content.toString()));
          activeChannel.ack(message);
        } catch (error) {
          logger.error("Error processing notification message", error);
          activeChannel.nack(message, false, false);
        }
      });
      logger.info("Listening to notification_service_queue");
    },
  });

  async connect() {
    await this.connector.connect();
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

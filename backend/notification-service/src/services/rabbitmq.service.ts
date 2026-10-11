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
  private connection: unknown;
  private channel: amqp.Channel | undefined;
  async connect() {
    try {
      this.connection = await amqp.connect(envConfig.rabbitMqUrl);
      this.channel = await (
        this.connection as amqp.ChannelModel
      ).createChannel();
      await this.channel.assertExchange("ecoalert_exchange", "topic", {
        durable: true,
      });
      const queue = await this.channel.assertQueue(
        "notification_service_queue",
        { durable: true },
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
      setTimeout(() => this.connect(), 5000);
    }
  }
  async handleEvent(event: IEventMessage<AlertEventData>) {
    const data = event.data;
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

    if (event.eventType === EVENTS.ALERT_UPDATED) {
      // Generic edits, AI persistence and the companion workflow update aren't transitions.
      if (
        data.workflowNotificationHandled ||
        !data.previousStatus ||
        !data.status ||
        data.previousStatus.toUpperCase() === data.status.toUpperCase()
      )
        return;
    }
    if (
      event.eventType === EVENTS.AI_ANALYZED &&
      (!data.analysisMode || data.analysisMode === "FAILED")
    )
      return;
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
}
export const rabbitMQService = new RabbitMQService();

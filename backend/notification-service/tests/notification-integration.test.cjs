require("ts-node/register");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const http = require("node:http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");
const { app } = require("../src/app");
const { Notification } = require("../src/models/notification.model");
const { rabbitMQService } = require("../src/services/rabbitmq.service");
const { socketService } = require("../src/services/socket.service");
const {
  formatNotificationContent,
} = require("../src/utils/notification-content");
const { EVENTS } = require("@ecoalert/shared");
const citizen = "507f1f77bcf86cd799439011",
  other = "507f1f77bcf86cd799439012";
const officer = "507f1f77bcf86cd799439013",
  admin = "507f1f77bcf86cd799439014";
const alertId = "507f1f77bcf86cd799439015";
const until = async (predicate) => {
  const deadline = Date.now() + 5000;
  while (!(await predicate())) {
    if (Date.now() > deadline)
      assert.fail("Timed out waiting for real workflow delivery");
    await new Promise((r) => setTimeout(r, 20));
  }
};
test(
  "Mongo + HTTP + Socket + broker: workflow recipients, legacy, dedup, ownership and isolated shared state",
  { skip: !process.env.NOTIFICATION_TEST_MONGO_URI, timeout: 30000 },
  async () => {
    process.env.JWT_SECRET = "notification-integration-only-secret";
    // Never connect the test model to a production database. Only a newly named test DB is cleaned up.
    const dbName = `ecoalert-notification-test-${randomUUID()}`;
    await mongoose.connect(process.env.NOTIFICATION_TEST_MONGO_URI, {
      dbName,
      serverSelectionTimeoutMS: 3000,
    });
    await Notification.init();
    const server = http.createServer(app);
    const sockets = socketService.initialize(server);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${server.address().port}`;
    const clients = [];
    let broker, channel;
    const sign = (userId, role, expiresIn = "5m") =>
      jwt.sign({ userId, role }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn,
      });
    const request = async (
      userId,
      role,
      path = "/",
      method = "GET",
      token = sign(userId, role),
    ) => {
      const response = await fetch(url + path, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "x-user-id": other,
          "x-user-role": "ADMIN",
        },
      });
      return { status: response.status, body: await response.json() };
    };
    const connect = async (userId, role) => {
      const client = io(url, {
        transports: ["websocket"],
        auth: { token: sign(userId, role) },
        reconnection: false,
      });
      clients.push(client);
      await new Promise((resolve, reject) => {
        client.once("connect", resolve);
        client.once("connect_error", reject);
      });
      return client;
    };
    try {
      assert.equal((await fetch(url + "/")).status, 401);
      assert.equal(
        (
          await fetch(url + "/", {
            headers: { "x-user-id": citizen, "x-user-role": "ADMIN" },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request(
            citizen,
            "CITIZEN",
            "/",
            "GET",
            sign(citizen, "CITIZEN", -1),
          )
        ).status,
        401,
      );
      const ownerSocket = await connect(citizen, "CITIZEN");
      const otherSocket = await connect(other, "CITIZEN");
      const officerSocket = await connect(officer, "OFFICER");
      const adminSocket = await connect(admin, "ADMIN");
      const bad = io(url, {
        transports: ["websocket"],
        auth: { token: "forged" },
        reconnection: false,
      });
      clients.push(bad);
      await new Promise((resolve) => bad.once("connect_error", resolve));
      assert.equal(bad.connected, false);
      otherSocket.emit("join", { userId: citizen, role: "ADMIN" });
      let ownerNotices = 0,
        otherNotices = 0,
        officerNotices = 0,
        adminNotices = 0,
        privateLeaks = 0;
      ownerSocket.on("notification:created", () => ownerNotices++);
      otherSocket.on("notification:created", () => otherNotices++);
      officerSocket.on("notification:created", () => officerNotices++);
      adminSocket.on("notification:created", () => adminNotices++);
      otherSocket.on("alert:updated", () => privateLeaks++);
      otherSocket.on("realtime:event", (data) => {
        if ("data" in data || "alertId" in data) privateLeaks++;
      });

      // Exercise actual AMQP delivery in an exclusive test queue, not the running app's exchange/queue.
      if (process.env.NOTIFICATION_TEST_AMQP_URL) {
        broker = await require("amqplib").connect(
          process.env.NOTIFICATION_TEST_AMQP_URL,
        );
        channel = await broker.createChannel();
        const queue = await channel.assertQueue("", {
          exclusive: true,
          autoDelete: true,
        });
        const event = {
          eventId: randomUUID(),
          eventType: EVENTS.ALERT_CREATED,
          data: { alertId, citizenId: citizen, title: "Rác ven đường" },
        };
        let settled = false,
          failure;
        await channel.consume(queue.queue, async (message) => {
          try {
            await rabbitMQService.handleEvent(
              JSON.parse(message.content.toString()),
            );
            channel.ack(message);
            settled = true;
          } catch (error) {
            failure = error;
            settled = true;
            channel.nack(message, false, false);
          }
        });
        channel.sendToQueue(queue.queue, Buffer.from(JSON.stringify(event)));
        await until(() => settled);
        if (failure) throw failure;
        assert.equal(
          await Notification.countDocuments({ eventId: event.eventId }),
          2,
        );
      }
      const assignment = {
        eventType: EVENTS.OFFICER_ASSIGNED,
        eventId: randomUUID(),
        data: {
          alertId,
          citizenId: citizen,
          assignedOfficerId: officer,
          title: "Rác ven đường",
          status: "assigned",
        },
      };
      await Promise.all(
        Array.from({ length: 4 }, () =>
          rabbitMQService.handleEvent(assignment),
        ),
      );
      assert.equal(
        await Notification.countDocuments({ eventId: assignment.eventId }),
        2,
      );
      await until(() => ownerNotices >= 1 && officerNotices >= 1);
      assert.equal(
        ownerNotices,
        process.env.NOTIFICATION_TEST_AMQP_URL ? 2 : 1,
      );
      assert.equal(officerNotices, 1);
      assert.equal(otherNotices, 0);
      assert.equal(privateLeaks, 0);
      const privateNotice = await Notification.findOne({
        eventId: assignment.eventId,
        recipientId: citizen,
      });
      assert.equal(privateNotice.alertId, alertId);
      assert.equal(privateNotice.eventId, assignment.eventId);
      for (const path of [
        `/${privateNotice.id}/read`,
        `/${privateNotice.id}`,
      ]) {
        const method = path.endsWith("/read") ? "PATCH" : "DELETE";
        assert.equal(
          (await request(other, "CITIZEN", path, method)).status,
          404,
        );
        assert.equal((await request(admin, "ADMIN", path, method)).status, 404);
      }
      const legacy = await Notification.create({
        recipientId: citizen,
        title: "Incident resolved",
        message: `Incident ${alertId} has been marked as resolved and is awaiting Admin review.`,
        eventId: randomUUID(),
        alertId,
        isRead: false,
      });
      const list = (await request(citizen, "CITIZEN")).body.data;
      const display = list.items.find((item) => item._id === legacy.id);
      assert.equal(display.type, "RESOLVED");
      assert.match(display.message, /chờ quản trị viên/);
      assert.equal(display.eventId, legacy.eventId);
      assert.equal(display.alertId, alertId);
      assert.equal(
        (await Notification.findById(legacy.id)).title,
        "Incident resolved",
      );
      assert.equal(
        (await request(citizen, "CITIZEN", `/${legacy.id}/read`, "PATCH")).body
          .data.isRead,
        true,
      );
      const shared = await Notification.create({
        recipientId: "system",
        title: "Unknown legacy",
        message: "IN_PROGRESS",
        isRead: true,
      });
      assert.equal(
        (await request(citizen, "CITIZEN", `/${shared.id}/read`, "PATCH")).body
          .data.isRead,
        true,
      );
      assert.equal(
        (await request(other, "CITIZEN")).body.data.items.find(
          (n) => n._id === shared.id,
        ).isRead,
        false,
      );
      assert.equal(
        (await request(other, "CITIZEN", "/unread-count")).body.data.count,
        1,
      );
      assert.equal(
        (await request(citizen, "CITIZEN", `/${shared.id}`, "DELETE")).status,
        200,
      );
      assert.ok(
        (await request(other, "CITIZEN")).body.data.items.some(
          (n) => n._id === shared.id,
        ),
      );
      assert.equal(
        (await request(other, "CITIZEN", "/mark-all-read", "PATCH")).status,
        200,
      );
      assert.equal(
        (await request(other, "CITIZEN", "/unread-count")).body.data.count,
        0,
      );
      assert.equal(await Notification.countDocuments({ _id: shared.id }), 1);
      const page = (await request(citizen, "CITIZEN", "/?page=1&limit=1")).body
        .data;
      assert.equal(page.items.length, 1);
      assert.ok(page.total >= 2);
      assert.equal(page.limit, 1);
      const resolvedEvent = {
        eventType: EVENTS.ALERT_RESOLVED,
        eventId: randomUUID(),
        data: assignment.data,
      };
      await rabbitMQService.handleEvent(resolvedEvent);
      assert.deepEqual(
        (await Notification.find({ eventId: resolvedEvent.eventId }))
          .map((n) => n.recipientId)
          .sort(),
        [citizen, "admins"].sort(),
      );
      await until(() => adminNotices >= 1);
      const adminReview = await Notification.findOne({
        eventId: resolvedEvent.eventId,
        recipientId: "admins",
      });
      assert.equal(
        (await request(officer, "OFFICER", `/${adminReview.id}/read`, "PATCH"))
          .status,
        404,
      );
      assert.equal(
        (await request(admin, "ADMIN", `/${adminReview.id}/read`, "PATCH")).body
          .data.isRead,
        true,
      );
      assert.equal(
        (await request(other, "ADMIN")).body.data.items.find(
          (n) => n._id === adminReview.id,
        ).isRead,
        false,
      );
      assert.equal(
        (await request(admin, "ADMIN", `/${adminReview.id}`, "DELETE")).status,
        200,
      );
      assert.ok(
        (await request(other, "ADMIN")).body.data.items.some(
          (n) => n._id === adminReview.id,
        ),
      );
      const officerShared = await Notification.create({
        recipientId: "officers",
        title: "Officer Alert: UNCLASSIFIED",
        message: "legacy",
        isRead: false,
      });
      assert.equal(
        (
          await request(
            officer,
            "OFFICER",
            `/${officerShared.id}/read`,
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal(
        (await request(other, "OFFICER")).body.data.items.find(
          (n) => n._id === officerShared.id,
        ).isRead,
        false,
      );
      assert.ok(
        !(await request(admin, "ADMIN")).body.data.items.some(
          (n) => n._id === officerShared.id,
        ),
      );
      const all = await Notification.find({});
      for (const record of all)
        assert.doesNotMatch(
          formatNotificationContent(record).title +
            formatNotificationContent(record).message,
          /[a-f\d]{24}|IN_PROGRESS/,
        );
      assert.equal(otherNotices, 0);
      assert.equal(privateLeaks, 0);
    } finally {
      for (const client of clients) client.disconnect();
      if (channel) await channel.close();
      if (broker) await broker.close();
      await new Promise((resolve) => sockets.close(resolve));
      if (
        mongoose.connection.name !== dbName ||
        !dbName.startsWith("ecoalert-notification-test-")
      )
        throw new Error("Unsafe test database cleanup refused");
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);

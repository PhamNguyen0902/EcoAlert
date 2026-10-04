import { app } from "./app";
import { createLogger } from "@ecoalert/shared";
import { rabbitMQService } from "./services/rabbitmq.service";
import { envConfig } from "./config/env.config";
import { initializeOpenRouter } from "./services/openrouter.service";
import mongoose from "mongoose";

const logger = createLogger("ai-service");
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/ecoalert-ai-db";

const startServer = async () => {
  try {
    initializeOpenRouter();

    // Kết nối MongoDB cho RAG
    await mongoose.connect(MONGO_URI);
    logger.info("Connected to MongoDB for RAG Knowledge Base");

    await rabbitMQService.connect();

    app.listen(envConfig.port, () => {
      logger.info(`AI Service is running on port ${envConfig.port}`);
    });
  } catch (error) {
    logger.error("Failed to start AI Service:", error);
    process.exit(1);
  }
};

startServer();

const shutdown = async () => {
  await mongoose.disconnect();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

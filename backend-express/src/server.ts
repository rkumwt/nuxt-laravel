import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { createContainer } from "./container.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const container = createContainer({ config, prisma, logger });
const app = createApp(container);

const server = app.listen(config.port, () => {
  logger.info(`API listening on ${config.appUrl} (port ${config.port}, ${config.env})`);
});

// Finish in-flight requests, then release the database pool
const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force exit if connections don't drain in time
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

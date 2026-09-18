import { createApp } from "./app";
import { env } from "./config/env";
import { disconnectPrisma } from "./repositories/prismaClient";
import { logger } from "./services/logger";

const app = createApp();

const server = app.listen(env.GQ_PORT, () => {
  logger.info("gq_server_started", { port: env.GQ_PORT, env: env.NODE_ENV });
});

async function shutdown(signal: string): Promise<void> {
  logger.info("gq_server_shutting_down", { signal });
  server.close();
  await disconnectPrisma();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

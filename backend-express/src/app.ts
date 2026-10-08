import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Container } from "./container.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { apiRoutes } from "./routes/api.js";
import { webRoutes } from "./routes/web.js";

// Builds the Express app; no network or process concerns here so tests can use it directly
export const createApp = (container: Container) => {
  const { config, logger } = container;
  const app = express();

  app.set("trust proxy", config.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  if (!config.isTest) {
    app.use(pinoHttp({ logger }));
  }
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use("/api", apiRoutes(container));
  app.use(webRoutes(container));

  app.use(notFoundHandler);
  app.use(errorHandler(logger, !config.isProduction));

  return app;
};

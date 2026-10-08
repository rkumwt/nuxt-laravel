import { Router } from "express";
import type { Container } from "../container.js";

// routes/web.php
export const webRoutes = ({ controllers, prisma, config }: Container) =>
  Router()
    // Health check (Laravel's /up), also verifies the database connection
    .get("/up", async (_req, res) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: "ok" });
      } catch {
        res.status(503).json({ status: "unavailable" });
      }
    })
    .get("/s/:code", controllers.redirect.redirect)
    // The UI lives in the Nuxt/Next frontend
    .get("/", (_req, res) => res.redirect(config.frontendUrl));

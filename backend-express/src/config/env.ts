import "dotenv/config";
import { z } from "zod";

// Empty strings in .env mean "not set"
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8001),
  APP_URL: z.url().default("http://localhost:8001"),
  FRONTEND_URL: z.url().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: optional(z.string()),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  DATABASE_URL: z.string().min(1),

  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  TOKEN_EXPIRATION_MINUTES: optional(z.coerce.number().int().positive()),

  MAIL_MAILER: z.enum(["smtp", "log"]).default("log"),
  MAIL_HOST: optional(z.string()),
  MAIL_PORT: z.coerce.number().int().positive().default(587),
  MAIL_USERNAME: optional(z.string()),
  MAIL_PASSWORD: optional(z.string()),
  MAIL_FROM_ADDRESS: z.email().default("hello@example.com"),
  MAIL_FROM_NAME: z.string().default("UrlShortner"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a misconfigured app should not start
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  port: env.PORT,
  appUrl: env.APP_URL.replace(/\/$/, ""),
  frontendUrl: env.FRONTEND_URL.replace(/\/$/, ""),
  corsOrigins: (env.CORS_ALLOWED_ORIGINS ?? env.FRONTEND_URL).split(",").map((o) => o.trim()),
  trustProxy: env.TRUST_PROXY,
  logLevel: env.LOG_LEVEL,
  databaseUrl: env.DATABASE_URL,
  auth: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    tokenExpirationMinutes: env.TOKEN_EXPIRATION_MINUTES ?? null,
  },
  mail: {
    mailer: env.MAIL_MAILER,
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    username: env.MAIL_USERNAME,
    password: env.MAIL_PASSWORD,
    from: { address: env.MAIL_FROM_ADDRESS, name: env.MAIL_FROM_NAME },
  },
} as const;

export type AppConfig = typeof config;

import type { Prisma, PrismaClient } from "../generated/prisma/client.js";

// Repositories accept either the root client or a transaction client
export type DbClient = PrismaClient | Prisma.TransactionClient;

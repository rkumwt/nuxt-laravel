import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";

// Brings the test database schema up to date once per run
export default function setup() {
  const env = { ...process.env, ...parse(readFileSync(".env.test")) };
  execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
}

import { Prisma } from "@/lib/db-client";

const DATABASE_CONNECTIVITY_ERROR_CODES = new Set(["P1000", "P1001", "P1002"]);
const DATABASE_CONNECTIVITY_MESSAGE_PATTERNS = [
  "Can't reach database server",
  "connect ECONNREFUSED",
  "Connection refused",
  "Timed out fetching a new connection",
];

export class DatabaseUnavailableError extends Error {
  readonly code = "DATABASE_UNAVAILABLE";

  constructor(context: string) {
    const target = resolveDatabaseTarget();
    super(
      `${context}. Database is unavailable at ${target}. Start the database server and verify your DATABASE_URL configuration.`,
    );
    this.name = "DatabaseUnavailableError";
  }
}

function resolveDatabaseTarget() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return "the host configured in DATABASE_URL";
  }

  try {
    const parsed = new URL(databaseUrl);
    const port =
      parsed.port ||
      (parsed.protocol === "mysql:" ? "3306" : parsed.protocol === "postgresql:" ? "5432" : "default");
    return `${parsed.hostname}:${port}`;
  } catch {
    return "the host configured in DATABASE_URL";
  }
}

export function isDatabaseConnectivityError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return DATABASE_CONNECTIVITY_ERROR_CODES.has(error.code);
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === "string" && DATABASE_CONNECTIVITY_ERROR_CODES.has(maybeCode)) {
    return true;
  }

  return DATABASE_CONNECTIVITY_MESSAGE_PATTERNS.some((pattern) => error.message.includes(pattern));
}

export function toPublicDatabaseError(error: unknown, context: string): Error {
  if (isDatabaseConnectivityError(error)) {
    return new DatabaseUnavailableError(context);
  }

  return error instanceof Error ? error : new Error("Unexpected database error.");
}

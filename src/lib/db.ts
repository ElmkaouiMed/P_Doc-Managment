import type { PrismaClient as WebPrismaClient } from "@prisma/client";

import { PrismaClient } from "@/lib/db-client";
import { isDesktopMode } from "@/lib/runtime";

const JSON_FIELD_NAMES = new Set([
  "extraJson",
  "metadataJson",
  "payloadJson",
  "snapshotJson",
  "mappingJson",
  "sourceJson",
  "configJson",
  "variablesJson",
  "extractedJson",
  "normalizedJson",
  "warningJson",
  "valueJson",
  "backupCodesHash",
  "attachmentsJson",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function serializeJsonFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => serializeJsonFields(item));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (JSON_FIELD_NAMES.has(key)) {
      if (entry === undefined) {
        output[key] = entry;
      } else if (entry === null) {
        output[key] = null;
      } else if (typeof entry === "boolean") {
        output[key] = entry;
      } else {
        output[key] = JSON.stringify(entry);
      }
      continue;
    }

    output[key] = serializeJsonFields(entry);
  }
  return output;
}

function parseJsonField(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function deserializeJsonFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deserializeJsonFields(item));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (JSON_FIELD_NAMES.has(key)) {
      output[key] = parseJsonField(entry);
      continue;
    }
    output[key] = deserializeJsonFields(entry);
  }
  return output;
}

const globalForPrisma = globalThis as unknown as {
  prisma: WebPrismaClient | undefined;
};

export const prisma: WebPrismaClient =
  globalForPrisma.prisma ??
  (() => {
    const baseClient = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
    });

    if (!isDesktopMode()) {
      return baseClient as unknown as WebPrismaClient;
    }

    return baseClient.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const nextArgs = serializeJsonFields(args);
            const result = await (query as any)(nextArgs as any);
            return deserializeJsonFields(result);
          },
        },
      },
    }) as unknown as WebPrismaClient;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

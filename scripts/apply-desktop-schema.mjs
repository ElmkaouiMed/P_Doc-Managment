import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webAdminRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(webAdminRoot, "prisma", "schema.desktop.prisma");
const prismaCliPath = path.join(webAdminRoot, "node_modules", "prisma", "build", "index.js");

function getDatabaseUrl() {
  const value = (process.env.DATABASE_URL || "").trim();
  if (!value) {
    throw new Error("Missing DATABASE_URL for desktop schema bootstrap.");
  }
  return value;
}

function resolveDatabaseFilePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Desktop mode requires a SQLite DATABASE_URL that starts with file:.");
  }

  const rawPath = databaseUrl.replace(/^file:/, "");
  if (!rawPath.trim()) {
    throw new Error("SQLite DATABASE_URL is missing the database file path.");
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(webAdminRoot, rawPath);
}

function ensureDatabaseParent(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

function databaseAlreadyInitialized(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }
  try {
    return statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

export function applyDesktopSchema() {
  const databaseUrl = getDatabaseUrl();
  const databaseFilePath = resolveDatabaseFilePath(databaseUrl);
  ensureDatabaseParent(databaseFilePath);

  if (databaseAlreadyInitialized(databaseFilePath)) {
    return;
  }

  const sql = execFileSync(
    process.execPath,
    [prismaCliPath, "migrate", "diff", "--from-empty", "--to-schema-datamodel", schemaPath, "--script"],
    {
      cwd: webAdminRoot,
      env: process.env,
      encoding: "utf8",
    },
  );

  const tempSqlPath = path.join(path.dirname(databaseFilePath), "doc_v1.desktop.bootstrap.sql");
  writeFileSync(tempSqlPath, sql);

  execFileSync(
    process.execPath,
    [prismaCliPath, "db", "execute", "--url", databaseUrl, "--file", tempSqlPath],
    {
      cwd: webAdminRoot,
      env: process.env,
      stdio: "inherit",
    },
  );
}

if (import.meta.url === `file://${__filename.replace(/\\/g, "/")}`) {
  try {
    applyDesktopSchema();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

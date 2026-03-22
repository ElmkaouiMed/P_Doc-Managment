import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const webAdminRoot = process.cwd();
const buildDataDir = path.join(webAdminRoot, ".desktop-build");
const storageDir = path.join(buildDataDir, "storage");

mkdirSync(storageDir, { recursive: true });

const env = {
  ...process.env,
  DESKTOP_MODE: "1",
  NEXT_PUBLIC_DESKTOP_MODE: "1",
  DOC_V1_DATA_DIR: buildDataDir,
  DATABASE_URL: `file:${path.join(buildDataDir, "doc_v1.sqlite")}`,
  DOCUMENT_ENGINE_URL: process.env.DOCUMENT_ENGINE_URL || "http://127.0.0.1:3211",
  DOCUMENT_ENGINE_TOKEN: process.env.DOCUMENT_ENGINE_TOKEN || "desktop-build-token",
  AUTH_SECRET: process.env.AUTH_SECRET || "desktop-build-secret",
  DESKTOP_ADMIN_EMAIL: process.env.DESKTOP_ADMIN_EMAIL || "owner@doc-v1.local",
  DESKTOP_ADMIN_PASSWORD: process.env.DESKTOP_ADMIN_PASSWORD || "Desktop1234!",
  DESKTOP_ADMIN_FULL_NAME: process.env.DESKTOP_ADMIN_FULL_NAME || "Local Admin",
  DESKTOP_COMPANY_NAME: process.env.DESKTOP_COMPANY_NAME || "Local Workspace",
  NEXT_TELEMETRY_DISABLED: "1",
};

const nextBin = path.join(webAdminRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "build"], {
  cwd: webAdminRoot,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

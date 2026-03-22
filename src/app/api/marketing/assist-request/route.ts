import { randomUUID } from "crypto";
import { appendFile, mkdir } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isDesktopMode } from "@/lib/runtime";
import { getStorageRoot } from "@/lib/storage";

export const runtime = "nodejs";

const STORAGE_ROOT = getStorageRoot();
const MARKETING_ROOT = path.resolve(STORAGE_ROOT, "marketing");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const WINDOW_OPTIONS = new Set(["today", "tomorrow", "this_week"]);

type RequestBody = {
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  companyName?: unknown;
  contactWindow?: unknown;
  note?: unknown;
  sourcePath?: unknown;
  sourceSection?: unknown;
  locale?: unknown;
  timezone?: unknown;
  timezoneOffset?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  const raw = typeof value === "string" ? value : "";
  const collapsed = raw.trim().replace(/\s+/g, " ");
  return collapsed.slice(0, maxLength);
}

function toNumberOrNull(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export async function POST(request: Request) {
  if (isDesktopMode()) {
    return NextResponse.json({ ok: false, error: "Unavailable in desktop mode." }, { status: 404 });
  }

  let payload: RequestBody;

  try {
    payload = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  const fullName = cleanText(payload.fullName, 120);
  const phone = cleanText(payload.phone, 40);
  const email = cleanText(payload.email, 140);
  const companyName = cleanText(payload.companyName, 140);
  const contactWindowRaw = cleanText(payload.contactWindow, 30);
  const contactWindow = WINDOW_OPTIONS.has(contactWindowRaw) ? contactWindowRaw : "today";
  const note = cleanText(payload.note, 800);
  const sourcePath = cleanText(payload.sourcePath, 140) || "/";
  const sourceSection = cleanText(payload.sourceSection, 60) || "landing";
  const locale = cleanText(payload.locale, 12) || "fr";
  const timezone = cleanText(payload.timezone, 80) || null;
  const timezoneOffset = toNumberOrNull(payload.timezoneOffset);

  if (fullName.length < 2) {
    return NextResponse.json({ ok: false, error: "Full name is required." }, { status: 400 });
  }
  if (phone.length < 6) {
    return NextResponse.json({ ok: false, error: "Phone is required." }, { status: 400 });
  }
  if (email.length > 0 && !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email format." }, { status: 400 });
  }

  const reqHeaders = await headers();
  const forwardedFor = reqHeaders.get("x-forwarded-for") || "";
  const ipHint = cleanText(forwardedFor.split(",")[0], 64) || null;
  const userAgent = cleanText(reqHeaders.get("user-agent"), 260) || null;

  const now = new Date();
  const monthStamp = now.toISOString().slice(0, 7);
  const requestId = randomUUID();

  const entry = {
    requestId,
    submittedAt: now.toISOString(),
    fullName,
    phone,
    email: email || null,
    companyName: companyName || null,
    contactWindow,
    note: note || null,
    sourcePath,
    sourceSection,
    locale,
    timezone,
    timezoneOffset,
    ipHint,
    userAgent,
  };

  try {
    await mkdir(MARKETING_ROOT, { recursive: true });
    const filePath = path.join(MARKETING_ROOT, `assist-requests-${monthStamp}.ndjson`);
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to save request." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    requestId,
  });
}

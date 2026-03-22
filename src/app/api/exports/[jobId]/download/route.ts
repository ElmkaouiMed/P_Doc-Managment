import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/features/auth/lib/session";
import { prisma } from "@/lib/db";
import { getStorageRoot } from "@/lib/storage";

const STORAGE_ROOT = getStorageRoot();
const OUTPUT_ROOT = path.resolve(STORAGE_ROOT, "document-outputs");

function detectMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (extension === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (extension === ".html" || extension === ".htm") {
    return "text/html; charset=utf-8";
  }
  if (extension === ".pdf") {
    return "application/pdf";
  }
  return "application/octet-stream";
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> | { jobId: string } },
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = "then" in context.params ? await context.params : context.params;
  const jobId = resolvedParams.jobId.trim();
  if (!jobId) {
    return NextResponse.json({ error: "Export job id is required." }, { status: 400 });
  }

  const job = await prisma.exportJob.findFirst({
    where: {
      id: jobId,
      companyId: auth.company.id,
      status: "COMPLETED",
    },
    select: {
      outputPath: true,
    },
  });

  if (!job?.outputPath) {
    return NextResponse.json({ error: "Export file not found." }, { status: 404 });
  }

  const absolutePath = path.resolve(STORAGE_ROOT, job.outputPath);
  if (!absolutePath.startsWith(OUTPUT_ROOT)) {
    return NextResponse.json({ error: "Invalid export path." }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(absolutePath);
  } catch {
    return NextResponse.json({ error: "Export file not found." }, { status: 404 });
  }

  const fileName = path.basename(absolutePath);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": detectMimeType(fileName),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

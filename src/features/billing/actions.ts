"use server";

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { CompanyAccountStatus, MembershipRole, PaymentProofMethod, PaymentProofStatus } from "@/lib/db-client";

import { requireAuthContext } from "@/features/auth/lib/session";
import { trackFunnelEventServer } from "@/features/analytics/lib/funnel-events-server";
import { getCompanyUsageLimitSnapshot } from "@/features/billing/lib/usage-limits";
import { prisma } from "@/lib/db";
import { getStorageRoot } from "@/lib/storage";

type SubmitPaymentProofInput = {
  method: PaymentProofMethod;
  amount?: number | null;
  currency?: string;
  reference?: string;
  proofFilePath?: string;
  note?: string;
  metadataJson?: Record<string, unknown>;
};

type ReviewPaymentProofInput = {
  paymentProofId: string;
  status: PaymentProofStatus;
  reviewNote?: string;
};

type ListPaymentProofsInput = {
  limit?: number;
  mineOnly?: boolean;
};

const STORAGE_ROOT = getStorageRoot();
const PAYMENT_PROOFS_ROOT = path.resolve(STORAGE_ROOT, "payment-proofs");
const MAX_PAYMENT_PROOF_FILE_SIZE = 8 * 1024 * 1024;
const PAYMENT_PROOF_ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);
const PAYMENT_PROOF_EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function cleanText(value: string | undefined | null) {
  const next = (value || "").trim();
  return next.length ? next : null;
}

function parseAmount(value: number | null | undefined) {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Number(parsed.toFixed(2));
}

function normalizeCurrency(value: string | undefined) {
  const normalized = (value || "MAD").trim().toUpperCase();
  return normalized.length ? normalized.slice(0, 10) : "MAD";
}

function canReviewProof(role: MembershipRole) {
  return role === MembershipRole.OWNER || role === MembershipRole.ADMIN;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function toRelativePaymentProofPath(companyId: string, fileName: string) {
  return path.join("payment-proofs", companyId, fileName);
}

function toAbsoluteStoragePath(relativePath: string) {
  return path.resolve(STORAGE_ROOT, relativePath);
}

function resolvePaymentProofExtension(fileName: string, mimeType: string) {
  const fromName = path.extname(fileName).toLowerCase();
  if (PAYMENT_PROOF_ALLOWED_EXTENSIONS.has(fromName)) {
    return fromName;
  }
  const fromMime = PAYMENT_PROOF_EXTENSION_BY_MIME[(mimeType || "").toLowerCase()];
  if (fromMime && PAYMENT_PROOF_ALLOWED_EXTENSIONS.has(fromMime)) {
    return fromMime;
  }
  return null;
}

function normalizeStoragePath(value: string) {
  return value.replace(/\\/g, "/");
}

export async function getCompanyLifecycleAction() {
  const auth = await requireAuthContext();
  const company = await prisma.company.findUnique({
    where: { id: auth.company.id },
    select: {
      id: true,
      accountStatus: true,
      trialStartedAt: true,
      trialEndsAt: true,
      graceEndsAt: true,
      awaitingActivationAt: true,
      activatedAt: true,
      lockedAt: true,
      lockReason: true,
      statusNote: true,
    },
  });

  if (!company) {
    return { ok: false as const, error: "Company not found." };
  }

  return {
    ok: true as const,
    lifecycle: {
      ...company,
      trialStartedAt: company.trialStartedAt?.toISOString() || null,
      trialEndsAt: company.trialEndsAt?.toISOString() || null,
      graceEndsAt: company.graceEndsAt?.toISOString() || null,
      awaitingActivationAt: company.awaitingActivationAt?.toISOString() || null,
      activatedAt: company.activatedAt?.toISOString() || null,
      lockedAt: company.lockedAt?.toISOString() || null,
    },
  };
}

export async function getCompanyUsageLimitsAction() {
  const auth = await requireAuthContext();
  const [documents, exports] = await Promise.all([
    getCompanyUsageLimitSnapshot(auth.company.id, "documents_per_month"),
    getCompanyUsageLimitSnapshot(auth.company.id, "exports_per_month"),
  ]);

  return {
    ok: true as const,
    usage: {
      documents: {
        used: documents.used,
        limit: documents.limit,
        remaining: documents.remaining,
        planCode: documents.planCode,
        periodStart: documents.period.start.toISOString(),
        periodEnd: documents.period.end.toISOString(),
      },
      exports: {
        used: exports.used,
        limit: exports.limit,
        remaining: exports.remaining,
        planCode: exports.planCode,
        periodStart: exports.period.start.toISOString(),
        periodEnd: exports.period.end.toISOString(),
      },
    },
  };
}

export async function listPaymentProofsAction(input: ListPaymentProofsInput = {}) {
  const auth = await requireAuthContext();
  const limitRaw = Number(input.limit || 30);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 30;
  const mineOnly = Boolean(input.mineOnly);
  const canReview = canReviewProof(auth.role);
  const allowAll = canReview && !mineOnly;

  const rows = await prisma.paymentProof.findMany({
    where: {
      companyId: auth.company.id,
      ...(allowAll ? {} : { submittedById: auth.user.id }),
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      currency: true,
      reference: true,
      proofFilePath: true,
      note: true,
      reviewNote: true,
      submittedAt: true,
      reviewedAt: true,
      submittedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  return {
    ok: true as const,
    canReview,
    items: rows.map((row) => ({
      id: row.id,
      method: row.method,
      status: row.status,
      amount: row.amount == null ? null : Number(row.amount),
      currency: row.currency,
      reference: row.reference,
      proofFilePath: row.proofFilePath,
      note: row.note,
      reviewNote: row.reviewNote,
      submittedAt: row.submittedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() || null,
      submittedBy: row.submittedBy,
      reviewedBy: row.reviewedBy,
    })),
  };
}

export async function submitPaymentProofAction(input: SubmitPaymentProofInput) {
  const auth = await requireAuthContext();
  if (!Object.values(PaymentProofMethod).includes(input.method)) {
    return { ok: false as const, error: "Invalid payment method." };
  }

  const now = new Date();
  const amount = parseAmount(input.amount);
  const reference = cleanText(input.reference);
  const proofFilePath = cleanText(input.proofFilePath);
  const note = cleanText(input.note);
  const currency = normalizeCurrency(input.currency);

  const created = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: auth.company.id },
      select: {
        id: true,
        accountStatus: true,
      },
    });

    if (!company) {
      return null;
    }

    const proof = await tx.paymentProof.create({
      data: {
        companyId: auth.company.id,
        submittedById: auth.user.id,
        method: input.method,
        status: PaymentProofStatus.SUBMITTED,
        amount,
        currency,
        reference,
        proofFilePath,
        note,
        metadataJson: (input.metadataJson as any) ?? undefined,
        submittedAt: now,
      },
      select: {
        id: true,
        method: true,
        status: true,
        amount: true,
        currency: true,
        reference: true,
        proofFilePath: true,
        note: true,
        submittedAt: true,
      },
    });

    if (company.accountStatus !== CompanyAccountStatus.ACTIVE_PAID) {
      const nextStatus = CompanyAccountStatus.AWAITING_ACTIVATION;
      if (company.accountStatus !== nextStatus) {
        await tx.company.update({
          where: { id: auth.company.id },
          data: {
            accountStatus: nextStatus,
            awaitingActivationAt: now,
            statusNote: "PAYMENT_PROOF_SUBMITTED",
            lockReason: null,
          },
        });
        await tx.companyAccountStatusEvent.create({
          data: {
            companyId: auth.company.id,
            actorId: auth.user.id,
            fromStatus: company.accountStatus,
            toStatus: nextStatus,
            reason: "PAYMENT_PROOF_SUBMITTED",
          },
        });
      }
    }

    return proof;
  });

  if (!created) {
    return { ok: false as const, error: "Company not found." };
  }

  await trackFunnelEventServer({
    eventName: "payment_proof_submitted",
    sourcePath: "/settings",
    sourceSection: "payment-proof",
    companyId: auth.company.id,
    userId: auth.user.id,
    metadata: {
      paymentProofId: created.id,
      method: created.method,
      currency: created.currency,
      amount: created.amount == null ? null : Number(created.amount),
    },
  });

  return {
    ok: true as const,
    proof: {
      ...created,
      amount: created.amount == null ? null : Number(created.amount),
      submittedAt: created.submittedAt.toISOString(),
    },
  };
}

export async function submitPaymentProofWithFileAction(formData: FormData) {
  const methodValue = String(formData.get("method") ?? "").trim();
  if (!methodValue) {
    return { ok: false as const, error: "Payment method is required." };
  }
  if (!Object.values(PaymentProofMethod).includes(methodValue as PaymentProofMethod)) {
    return { ok: false as const, error: "Invalid payment method." };
  }

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const parsedAmount = amountRaw.length ? Number.parseFloat(amountRaw) : null;
  if (amountRaw.length && (!Number.isFinite(parsedAmount || NaN) || (parsedAmount || 0) <= 0)) {
    return { ok: false as const, error: "Amount must be a positive number." };
  }

  const currency = String(formData.get("currency") ?? "");
  const reference = String(formData.get("reference") ?? "");
  const note = String(formData.get("note") ?? "");
  const proofFileRaw = formData.get("proofFile");

  let storedRelativePath: string | undefined;
  let storedAbsolutePath: string | null = null;

  if (proofFileRaw != null && !(proofFileRaw instanceof File)) {
    return { ok: false as const, error: "Invalid proof file." };
  }

  if (proofFileRaw instanceof File && proofFileRaw.size > 0) {
    if (proofFileRaw.size > MAX_PAYMENT_PROOF_FILE_SIZE) {
      return { ok: false as const, error: "Proof file is too large (max 8 MB)." };
    }

    const safeOriginalName = sanitizeFileName(proofFileRaw.name || "payment-proof");
    const extension = resolvePaymentProofExtension(safeOriginalName, proofFileRaw.type || "");
    if (!extension) {
      return { ok: false as const, error: "Unsupported proof file format. Use PDF, PNG, JPG, JPEG, or WEBP." };
    }

    const auth = await requireAuthContext();
    const baseName = path.basename(safeOriginalName, path.extname(safeOriginalName)) || "payment-proof";
    const finalFileName = `${Date.now()}_${randomUUID().slice(0, 8)}_${baseName}${extension}`;
    const relativePath = toRelativePaymentProofPath(auth.company.id, finalFileName);
    const absolutePath = toAbsoluteStoragePath(relativePath);

    if (!absolutePath.startsWith(PAYMENT_PROOFS_ROOT)) {
      return { ok: false as const, error: "Invalid proof file path." };
    }

    const buffer = Buffer.from(await proofFileRaw.arrayBuffer());
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    storedRelativePath = normalizeStoragePath(relativePath);
    storedAbsolutePath = absolutePath;
  }

  try {
    const result = await submitPaymentProofAction({
      method: methodValue as PaymentProofMethod,
      amount: parsedAmount,
      currency,
      reference,
      note,
      proofFilePath: storedRelativePath,
    });

    if (!result.ok && storedAbsolutePath) {
      await unlink(storedAbsolutePath).catch(() => undefined);
    }

    return result;
  } catch (e) {
    if (storedAbsolutePath) {
      await unlink(storedAbsolutePath).catch(() => undefined);
    }
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Unable to submit payment proof.",
    };
  }
}

export async function reviewPaymentProofAction(input: ReviewPaymentProofInput) {
  const auth = await requireAuthContext();
  if (!canReviewProof(auth.role)) {
    return { ok: false as const, error: "Only owners/admins can review payment proofs." };
  }

  const paymentProofId = (input.paymentProofId || "").trim();
  if (!paymentProofId) {
    return { ok: false as const, error: "Payment proof id is required." };
  }
  if (!Object.values(PaymentProofStatus).includes(input.status)) {
    return { ok: false as const, error: "Invalid payment proof status." };
  }
  if (input.status === PaymentProofStatus.SUBMITTED) {
    return { ok: false as const, error: "Review status must be UNDER_REVIEW, APPROVED, or REJECTED." };
  }

  const now = new Date();
  const reviewNote = cleanText(input.reviewNote);

  const reviewed = await prisma.$transaction(async (tx) => {
    const existing = await tx.paymentProof.findFirst({
      where: {
        id: paymentProofId,
        companyId: auth.company.id,
      },
      select: {
        id: true,
        status: true,
        companyId: true,
      },
    });

    if (!existing) {
      return null;
    }

    const updatedProof = await tx.paymentProof.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        reviewedById: auth.user.id,
        reviewNote,
        reviewedAt: now,
      },
      select: {
        id: true,
        status: true,
        reviewNote: true,
        reviewedAt: true,
      },
    });

    const company = await tx.company.findUnique({
      where: { id: existing.companyId },
      select: {
        accountStatus: true,
        lockedAt: true,
      },
    });
    if (!company) {
      return {
        proof: updatedProof,
        companyStatus: null,
        companyStatusChanged: false,
      };
    }

    let targetStatus = company.accountStatus;
    if (input.status === PaymentProofStatus.APPROVED) {
      targetStatus = CompanyAccountStatus.ACTIVE_PAID;
    } else if (input.status === PaymentProofStatus.REJECTED) {
      targetStatus = CompanyAccountStatus.LOCKED;
    } else if (input.status === PaymentProofStatus.UNDER_REVIEW) {
      targetStatus = CompanyAccountStatus.AWAITING_ACTIVATION;
    }

    const companyStatusChanged = targetStatus !== company.accountStatus;
    if (companyStatusChanged) {
      await tx.company.update({
        where: { id: existing.companyId },
        data: {
          accountStatus: targetStatus,
          activatedAt: targetStatus === CompanyAccountStatus.ACTIVE_PAID ? now : null,
          awaitingActivationAt: targetStatus === CompanyAccountStatus.AWAITING_ACTIVATION ? now : null,
          lockedAt: targetStatus === CompanyAccountStatus.LOCKED ? company.lockedAt || now : null,
          lockReason: targetStatus === CompanyAccountStatus.LOCKED ? "PAYMENT_PROOF_REJECTED" : null,
          statusNote:
            targetStatus === CompanyAccountStatus.ACTIVE_PAID
              ? "PAYMENT_PROOF_APPROVED"
              : targetStatus === CompanyAccountStatus.LOCKED
                ? "PAYMENT_PROOF_REJECTED"
                : "PAYMENT_PROOF_UNDER_REVIEW",
        },
      });

      await tx.companyAccountStatusEvent.create({
        data: {
          companyId: existing.companyId,
          actorId: auth.user.id,
          fromStatus: company.accountStatus,
          toStatus: targetStatus,
          reason:
            targetStatus === CompanyAccountStatus.ACTIVE_PAID
              ? "PAYMENT_PROOF_APPROVED"
              : targetStatus === CompanyAccountStatus.LOCKED
                ? "PAYMENT_PROOF_REJECTED"
                : "PAYMENT_PROOF_UNDER_REVIEW",
        },
      });
    }

    return {
      proof: updatedProof,
      companyStatus: targetStatus,
      companyStatusChanged,
    };
  });

  if (!reviewed) {
    return { ok: false as const, error: "Payment proof not found." };
  }

  if (reviewed.companyStatusChanged && reviewed.companyStatus === CompanyAccountStatus.ACTIVE_PAID) {
    await trackFunnelEventServer({
      eventName: "account_activated",
      sourcePath: "/settings",
      sourceSection: "payment-proof-review",
      companyId: auth.company.id,
      userId: auth.user.id,
      metadata: {
        paymentProofId: reviewed.proof.id,
      },
    });
  }

  return {
    ok: true as const,
    proof: {
      id: reviewed.proof.id,
      status: reviewed.proof.status,
      reviewNote: reviewed.proof.reviewNote,
      reviewedAt: reviewed.proof.reviewedAt?.toISOString() || null,
    },
    companyStatus: reviewed.companyStatus,
  };
}

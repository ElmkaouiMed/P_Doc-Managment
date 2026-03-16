"use server";

import { CompanyAccountStatus, MembershipRole, PaymentProofMethod, PaymentProofStatus, Prisma } from "@prisma/client";

import { requireAuthContext } from "@/features/auth/lib/session";
import { prisma } from "@/lib/db";

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
        metadataJson: input.metadataJson ? (input.metadataJson as Prisma.InputJsonValue) : undefined,
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

  return {
    ok: true as const,
    proof: {
      ...created,
      amount: created.amount == null ? null : Number(created.amount),
      submittedAt: created.submittedAt.toISOString(),
    },
  };
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

    if (targetStatus !== company.accountStatus) {
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
    };
  });

  if (!reviewed) {
    return { ok: false as const, error: "Payment proof not found." };
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

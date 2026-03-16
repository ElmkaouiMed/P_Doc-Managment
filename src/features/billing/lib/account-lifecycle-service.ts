import { CompanyAccountStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { deriveLifecycleStatus, transitionReason } from "@/features/billing/lib/account-lifecycle";

type SyncLifecycleResult = {
  companyId: string;
  status: CompanyAccountStatus;
  updated: boolean;
};

export async function syncCompanyLifecycleStatus(companyId: string, now = new Date()): Promise<SyncLifecycleResult | null> {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        accountStatus: true,
        trialEndsAt: true,
        graceEndsAt: true,
        lockedAt: true,
        lockReason: true,
      },
    });

    if (!company) {
      return null;
    }

    const nextStatus = deriveLifecycleStatus(
      {
        accountStatus: company.accountStatus,
        trialEndsAt: company.trialEndsAt,
        graceEndsAt: company.graceEndsAt,
      },
      now,
    );

    if (nextStatus === company.accountStatus) {
      return {
        companyId: company.id,
        status: company.accountStatus,
        updated: false,
      };
    }

    const updateData: Prisma.CompanyUpdateInput = {
      accountStatus: nextStatus,
      statusNote: transitionReason(company.accountStatus, nextStatus),
    };

    if (nextStatus === CompanyAccountStatus.LOCKED) {
      updateData.lockedAt = company.lockedAt || now;
      updateData.lockReason = company.lockReason || "TRIAL_OR_GRACE_ENDED";
    } else if (company.lockReason === "TRIAL_OR_GRACE_ENDED") {
      updateData.lockReason = null;
      updateData.lockedAt = null;
    }

    await tx.company.update({
      where: { id: company.id },
      data: updateData,
    });

    await tx.companyAccountStatusEvent.create({
      data: {
        companyId: company.id,
        actorId: null,
        fromStatus: company.accountStatus,
        toStatus: nextStatus,
        reason: transitionReason(company.accountStatus, nextStatus),
      },
    });

    return {
      companyId: company.id,
      status: nextStatus,
      updated: true,
    };
  });
}

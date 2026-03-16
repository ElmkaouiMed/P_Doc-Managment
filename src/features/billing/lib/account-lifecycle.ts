import { CompanyAccountStatus } from "@prisma/client";

export const TRIAL_PERIOD_DAYS = 14;
export const DEFAULT_GRACE_PERIOD_DAYS = 5;

type LifecycleSnapshot = {
  accountStatus: CompanyAccountStatus;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
};

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

export function getGracePeriodDays() {
  const parsed = Number(process.env.ACCOUNT_GRACE_DAYS ?? DEFAULT_GRACE_PERIOD_DAYS);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_GRACE_PERIOD_DAYS;
  }
  return Math.max(0, Math.floor(parsed));
}

export function buildTrialLifecycle(now = new Date()) {
  const trialStartedAt = new Date(now);
  const trialEndsAt = addDays(trialStartedAt, TRIAL_PERIOD_DAYS);
  const graceEndsAt = addDays(trialEndsAt, getGracePeriodDays());
  return {
    accountStatus: CompanyAccountStatus.TRIAL_ACTIVE,
    trialStartedAt,
    trialEndsAt,
    graceEndsAt,
    lockReason: null,
    statusNote: null,
    activatedAt: null,
    lockedAt: null,
    awaitingActivationAt: null,
  };
}

export function deriveLifecycleStatus(snapshot: LifecycleSnapshot, now = new Date()): CompanyAccountStatus {
  if (snapshot.accountStatus === CompanyAccountStatus.ACTIVE_PAID) {
    return CompanyAccountStatus.ACTIVE_PAID;
  }
  if (snapshot.accountStatus === CompanyAccountStatus.AWAITING_ACTIVATION) {
    return CompanyAccountStatus.AWAITING_ACTIVATION;
  }
  if (snapshot.accountStatus === CompanyAccountStatus.LOCKED) {
    return CompanyAccountStatus.LOCKED;
  }

  if (snapshot.trialEndsAt && now <= snapshot.trialEndsAt) {
    return CompanyAccountStatus.TRIAL_ACTIVE;
  }

  if (snapshot.graceEndsAt) {
    if (now <= snapshot.graceEndsAt) {
      return CompanyAccountStatus.GRACE;
    }
    return CompanyAccountStatus.LOCKED;
  }

  if (snapshot.trialEndsAt && now > snapshot.trialEndsAt) {
    return CompanyAccountStatus.TRIAL_EXPIRED;
  }

  return snapshot.accountStatus;
}

export function isWriteAccessAllowed(status: CompanyAccountStatus) {
  return status === CompanyAccountStatus.TRIAL_ACTIVE || status === CompanyAccountStatus.ACTIVE_PAID;
}

export function lifecycleAccessError(status: CompanyAccountStatus) {
  if (status === CompanyAccountStatus.GRACE) {
    return "Your trial has expired and the account is in grace period (read-only).";
  }
  if (status === CompanyAccountStatus.TRIAL_EXPIRED) {
    return "Your trial has expired. Complete activation to continue editing.";
  }
  if (status === CompanyAccountStatus.AWAITING_ACTIVATION) {
    return "Your payment proof is under review. The workspace is temporarily read-only.";
  }
  if (status === CompanyAccountStatus.LOCKED) {
    return "Your account is locked. Please complete activation to continue.";
  }
  return "Your account does not currently allow write actions.";
}

export function transitionReason(fromStatus: CompanyAccountStatus, toStatus: CompanyAccountStatus) {
  if (fromStatus === CompanyAccountStatus.TRIAL_ACTIVE && toStatus === CompanyAccountStatus.GRACE) {
    return "TRIAL_ENDED_GRACE_STARTED";
  }
  if (
    (fromStatus === CompanyAccountStatus.TRIAL_ACTIVE ||
      fromStatus === CompanyAccountStatus.GRACE ||
      fromStatus === CompanyAccountStatus.TRIAL_EXPIRED) &&
    toStatus === CompanyAccountStatus.LOCKED
  ) {
    return "GRACE_ENDED_ACCOUNT_LOCKED";
  }
  if (fromStatus === CompanyAccountStatus.TRIAL_ACTIVE && toStatus === CompanyAccountStatus.TRIAL_EXPIRED) {
    return "TRIAL_EXPIRED";
  }
  return "STATUS_UPDATED";
}

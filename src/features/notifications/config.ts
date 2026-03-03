export const NOTIFICATION_CONFIG_KEY = "notification-config-v1";

export type NotificationConfigInput = {
  enabled: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  notifyDueSoon: boolean;
  notifyOverdue: boolean;
  notifyDraftStale: boolean;
  notifyStatusChanges: boolean;
  notifyEmailFailures: boolean;
  notifyExportFailures: boolean;
  dueSoonDays: number;
  overdueDays: number;
  overdueRepeatDays: number;
  draftStaleDays: number;
  reminderTime: string;
  digestEnabled: boolean;
  digestTime: string;
};

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfigInput = {
  enabled: true,
  inAppEnabled: true,
  emailEnabled: false,
  pushEnabled: false,
  notifyDueSoon: true,
  notifyOverdue: true,
  notifyDraftStale: true,
  notifyStatusChanges: true,
  notifyEmailFailures: true,
  notifyExportFailures: true,
  dueSoonDays: 3,
  overdueDays: 1,
  overdueRepeatDays: 1,
  draftStaleDays: 7,
  reminderTime: "09:00",
  digestEnabled: false,
  digestTime: "18:00",
};

function parseObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function parseIntRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function parseTime(value: unknown, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^\d{2}:\d{2}$/.test(raw)) {
    return fallback;
  }
  const [hourRaw, minuteRaw] = raw.split(":");
  const hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return fallback;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function sanitizeNotificationConfig(raw: unknown): NotificationConfigInput {
  const source = parseObject(raw);
  return {
    enabled: parseBoolean(source.enabled, DEFAULT_NOTIFICATION_CONFIG.enabled),
    inAppEnabled: parseBoolean(source.inAppEnabled, DEFAULT_NOTIFICATION_CONFIG.inAppEnabled),
    emailEnabled: parseBoolean(source.emailEnabled, DEFAULT_NOTIFICATION_CONFIG.emailEnabled),
    pushEnabled: parseBoolean(source.pushEnabled, DEFAULT_NOTIFICATION_CONFIG.pushEnabled),
    notifyDueSoon: parseBoolean(source.notifyDueSoon, DEFAULT_NOTIFICATION_CONFIG.notifyDueSoon),
    notifyOverdue: parseBoolean(source.notifyOverdue, DEFAULT_NOTIFICATION_CONFIG.notifyOverdue),
    notifyDraftStale: parseBoolean(source.notifyDraftStale, DEFAULT_NOTIFICATION_CONFIG.notifyDraftStale),
    notifyStatusChanges: parseBoolean(source.notifyStatusChanges, DEFAULT_NOTIFICATION_CONFIG.notifyStatusChanges),
    notifyEmailFailures: parseBoolean(source.notifyEmailFailures, DEFAULT_NOTIFICATION_CONFIG.notifyEmailFailures),
    notifyExportFailures: parseBoolean(source.notifyExportFailures, DEFAULT_NOTIFICATION_CONFIG.notifyExportFailures),
    dueSoonDays: parseIntRange(source.dueSoonDays, DEFAULT_NOTIFICATION_CONFIG.dueSoonDays, 0, 30),
    overdueDays: parseIntRange(source.overdueDays, DEFAULT_NOTIFICATION_CONFIG.overdueDays, 0, 60),
    overdueRepeatDays: parseIntRange(source.overdueRepeatDays, DEFAULT_NOTIFICATION_CONFIG.overdueRepeatDays, 1, 30),
    draftStaleDays: parseIntRange(source.draftStaleDays, DEFAULT_NOTIFICATION_CONFIG.draftStaleDays, 1, 120),
    reminderTime: parseTime(source.reminderTime, DEFAULT_NOTIFICATION_CONFIG.reminderTime),
    digestEnabled: parseBoolean(source.digestEnabled, DEFAULT_NOTIFICATION_CONFIG.digestEnabled),
    digestTime: parseTime(source.digestTime, DEFAULT_NOTIFICATION_CONFIG.digestTime),
  };
}

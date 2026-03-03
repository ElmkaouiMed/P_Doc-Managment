"use server";

import { requireAuthContext } from "@/features/auth/lib/session";
import { NotificationConfigInput } from "@/features/notifications/config";
import {
  getCompanyNotificationConfig,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  refreshDueDocumentNotifications,
  saveCompanyNotificationConfig,
} from "@/features/notifications/service";

type ListUserNotificationsInput = {
  limit?: number;
};

type MarkNotificationReadInput = {
  notificationId: string;
};

export async function getCompanyNotificationConfigAction() {
  const auth = await requireAuthContext();
  const config = await getCompanyNotificationConfig(auth.company.id);
  return { ok: true as const, config };
}

export async function saveCompanyNotificationConfigAction(input: Partial<NotificationConfigInput>) {
  const auth = await requireAuthContext();
  const config = await saveCompanyNotificationConfig(auth.company.id, input);
  return { ok: true as const, config };
}

export async function listUserNotificationsAction(input: ListUserNotificationsInput = {}) {
  const auth = await requireAuthContext();
  await refreshDueDocumentNotifications(auth.company.id);

  const result = await listNotificationsForUser({
    companyId: auth.company.id,
    userId: auth.user.id,
    limit: input.limit,
  });

  return {
    ok: true as const,
    items: result.items,
    unreadCount: result.unreadCount,
  };
}

export async function markNotificationReadAction(input: MarkNotificationReadInput) {
  const auth = await requireAuthContext();
  const notificationId = (input.notificationId || "").trim();
  if (!notificationId) {
    return { ok: false as const, error: "Notification id is required." };
  }

  return markNotificationRead({
    companyId: auth.company.id,
    userId: auth.user.id,
    notificationId,
  });
}

export async function markAllNotificationsReadAction() {
  const auth = await requireAuthContext();
  return markAllNotificationsRead({
    companyId: auth.company.id,
    userId: auth.user.id,
  });
}

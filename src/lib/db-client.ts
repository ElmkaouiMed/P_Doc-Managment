import * as WebPrismaClient from "@prisma/client";
import * as DesktopPrismaClient from "@/generated/desktop-prisma";

import { isDesktopMode } from "@/lib/runtime";

const clientModule = isDesktopMode() ? DesktopPrismaClient : WebPrismaClient;

export const PrismaClient = clientModule.PrismaClient as typeof WebPrismaClient.PrismaClient;
export const Prisma = clientModule.Prisma as typeof WebPrismaClient.Prisma;

export const CompanyAccountStatus = {
  TRIAL_ACTIVE: "TRIAL_ACTIVE",
  TRIAL_EXPIRED: "TRIAL_EXPIRED",
  GRACE: "GRACE",
  AWAITING_ACTIVATION: "AWAITING_ACTIVATION",
  ACTIVE_PAID: "ACTIVE_PAID",
  LOCKED: "LOCKED",
} as const;
export type CompanyAccountStatus = (typeof CompanyAccountStatus)[keyof typeof CompanyAccountStatus];

export const DocumentStatus = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  SENT: "SENT",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DocumentType = {
  DEVIS: "DEVIS",
  FACTURE: "FACTURE",
  FACTURE_PROFORMA: "FACTURE_PROFORMA",
  BON_LIVRAISON: "BON_LIVRAISON",
  BON_COMMANDE: "BON_COMMANDE",
  EXTRACT_DEVIS: "EXTRACT_DEVIS",
  EXTRACT_BON_COMMANDE_PUBLIC: "EXTRACT_BON_COMMANDE_PUBLIC",
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const ExportFormat = {
  PDF: "PDF",
  DOCX: "DOCX",
  XLSX: "XLSX",
} as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const ExportStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type ExportStatus = (typeof ExportStatus)[keyof typeof ExportStatus];

export const ImportType = {
  CAHIER_CHARGES: "CAHIER_CHARGES",
  BON_COMMANDE_PUBLIC: "BON_COMMANDE_PUBLIC",
} as const;
export type ImportType = (typeof ImportType)[keyof typeof ImportType];

export const MembershipRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  ACCOUNTANT: "ACCOUNTANT",
  MEMBER: "MEMBER",
  VIEWER: "VIEWER",
} as const;
export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];

export const NotificationChannel = {
  IN_APP: "IN_APP",
  EMAIL: "EMAIL",
  PUSH: "PUSH",
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const NotificationType = {
  DUE_SOON: "DUE_SOON",
  OVERDUE: "OVERDUE",
  DRAFT_STALE: "DRAFT_STALE",
  STATUS_CHANGED: "STATUS_CHANGED",
  EMAIL_FAILED: "EMAIL_FAILED",
  EXPORT_FAILED: "EXPORT_FAILED",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const PaymentProofMethod = {
  VIREMENT: "VIREMENT",
  WAFACASH: "WAFACASH",
  CASH: "CASH",
  OTHER: "OTHER",
} as const;
export type PaymentProofMethod = (typeof PaymentProofMethod)[keyof typeof PaymentProofMethod];

export const PaymentProofStatus = {
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type PaymentProofStatus = (typeof PaymentProofStatus)[keyof typeof PaymentProofStatus];

export const RelationType = {
  CONVERTED: "CONVERTED",
  EXTRACTED_FROM: "EXTRACTED_FROM",
  DERIVED: "DERIVED",
} as const;
export type RelationType = (typeof RelationType)[keyof typeof RelationType];

export const SubscriptionStatus = {
  TRIAL: "TRIAL",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  SUSPENDED: "SUSPENDED",
  CANCELED: "CANCELED",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const TemplateFormat = {
  DOCX: "DOCX",
  XLSX: "XLSX",
  HTML: "HTML",
} as const;
export type TemplateFormat = (typeof TemplateFormat)[keyof typeof TemplateFormat];

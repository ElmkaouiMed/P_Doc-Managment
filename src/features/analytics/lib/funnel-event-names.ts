export const FUNNEL_EVENT_NAMES = [
  "landing_view",
  "signup_start",
  "signup_complete",
  "trial_start",
  "first_document_created",
  "payment_proof_submitted",
  "account_activated",
  "assist_modal_open",
  "assist_request_submitted",
  "education_banner_view",
  "education_video_click",
  "education_help_click",
] as const;

export const CORE_FUNNEL_SEQUENCE = [
  "landing_view",
  "signup_start",
  "signup_complete",
  "trial_start",
  "first_document_created",
  "payment_proof_submitted",
  "account_activated",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number];

const FUNNEL_EVENT_NAME_SET = new Set<string>(FUNNEL_EVENT_NAMES);

export function isFunnelEventName(value: string): value is FunnelEventName {
  return FUNNEL_EVENT_NAME_SET.has(value);
}

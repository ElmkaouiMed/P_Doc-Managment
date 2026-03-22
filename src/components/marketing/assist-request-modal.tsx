"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@/i18n/messages";

import { trackFunnelEventClient } from "@/features/analytics/lib/funnel-events-client";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { UiButton } from "@/components/ui/ui-button";

type AssistRequestModalProps = {
  locale: AppLocale;
  sourceSection: string;
  triggerLabel: string;
  triggerClassName?: string;
};

type ContactWindowOption = {
  value: string;
  label: string;
};

type ModalCopy = {
  title: string;
  subtitle: string;
  fullName: string;
  phone: string;
  email: string;
  companyName: string;
  contactWindow: string;
  message: string;
  submit: string;
  cancel: string;
  sending: string;
  successTitle: string;
  successDescription: string;
  errorTitle: string;
  errorDescription: string;
  options: ContactWindowOption[];
};

type AssistFormState = {
  fullName: string;
  phone: string;
  email: string;
  companyName: string;
  contactWindow: string;
  message: string;
};

const MODAL_COPY: Record<AppLocale, ModalCopy> = {
  fr: {
    title: "Parler a notre equipe",
    subtitle: "Laissez vos coordonnees. Nous revenons vers vous sous 24h.",
    fullName: "Nom complet",
    phone: "Telephone",
    email: "Email (optionnel)",
    companyName: "Entreprise (optionnel)",
    contactWindow: "Plage de contact",
    message: "Contexte / besoin (optionnel)",
    submit: "Envoyer la demande",
    cancel: "Annuler",
    sending: "Envoi...",
    successTitle: "Demande envoyee",
    successDescription: "Notre equipe vous contactera rapidement.",
    errorTitle: "Echec de l'envoi",
    errorDescription: "Impossible d'envoyer votre demande pour le moment.",
    options: [
      { value: "today", label: "Aujourd'hui" },
      { value: "tomorrow", label: "Demain" },
      { value: "this_week", label: "Cette semaine" },
    ],
  },
  en: {
    title: "Talk to our team",
    subtitle: "Share your details and we will contact you within 24h.",
    fullName: "Full name",
    phone: "Phone number",
    email: "Email (optional)",
    companyName: "Company (optional)",
    contactWindow: "Preferred contact time",
    message: "Context / needs (optional)",
    submit: "Send request",
    cancel: "Cancel",
    sending: "Sending...",
    successTitle: "Request sent",
    successDescription: "Our team will contact you soon.",
    errorTitle: "Request failed",
    errorDescription: "Unable to submit your request right now.",
    options: [
      { value: "today", label: "Today" },
      { value: "tomorrow", label: "Tomorrow" },
      { value: "this_week", label: "This week" },
    ],
  },
  ar: {
    title: "تحدث مع فريقنا",
    subtitle: "شارك بياناتك وسنتواصل معك خلال 24 ساعة.",
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني (اختياري)",
    companyName: "الشركة (اختياري)",
    contactWindow: "وقت التواصل المفضل",
    message: "سياق / احتياج (اختياري)",
    submit: "إرسال الطلب",
    cancel: "إلغاء",
    sending: "جاري الإرسال...",
    successTitle: "تم إرسال الطلب",
    successDescription: "سيتم التواصل معك قريبا.",
    errorTitle: "فشل الإرسال",
    errorDescription: "تعذر إرسال الطلب حاليا.",
    options: [
      { value: "today", label: "اليوم" },
      { value: "tomorrow", label: "غدا" },
      { value: "this_week", label: "هذا الأسبوع" },
    ],
  },
};

function buildInitialForm(options: ContactWindowOption[]): AssistFormState {
  return {
    fullName: "",
    phone: "",
    email: "",
    companyName: "",
    contactWindow: options[0]?.value || "today",
    message: "",
  };
}

export function AssistRequestModal({ locale, sourceSection, triggerLabel, triggerClassName }: AssistRequestModalProps) {
  const copy = MODAL_COPY[locale];
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<AssistFormState>(() => buildInitialForm(copy.options));
  const { success, error } = useToast();

  const resetForm = useMemo(() => () => setForm(buildInitialForm(copy.options)), [copy.options]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const closeModal = () => {
    if (isSubmitting) return;
    setIsOpen(false);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/marketing/assist-request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          companyName: form.companyName,
          contactWindow: form.contactWindow,
          note: form.message,
          sourcePath: window.location.pathname,
          sourceSection,
          locale,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
          timezoneOffset: new Date().getTimezoneOffset(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; requestId?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || copy.errorDescription);
      }

      trackFunnelEventClient({
        eventName: "assist_request_submitted",
        sourceSection,
        metadata: {
          requestId: payload.requestId || null,
          hasEmail: Boolean(form.email.trim()),
          hasCompanyName: Boolean(form.companyName.trim()),
          contactWindow: form.contactWindow,
        },
      });
      success(copy.successTitle, copy.successDescription);
      resetForm();
      setIsOpen(false);
    } catch (submitError) {
      error(copy.errorTitle, submitError instanceof Error ? submitError.message : copy.errorDescription);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          trackFunnelEventClient({
            eventName: "assist_modal_open",
            sourceSection,
          });
          setIsOpen(true);
        }}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" onClick={closeModal} aria-label={copy.cancel} />
          <div className="relative z-[131] w-full max-w-xl rounded-xl border border-border bg-card p-4 shadow-[0_24px_70px_-42px_rgba(16,185,129,0.65)] sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{copy.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{copy.subtitle}</p>
              </div>
              <UiButton type="button" size="xs" iconOnly iconName="close" label={copy.cancel} onClick={closeModal} disabled={isSubmitting} />
            </div>

            <form className="grid gap-3" onSubmit={onSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  label={copy.fullName}
                  value={form.fullName}
                  onChange={(value) => setForm((current) => ({ ...current, fullName: value }))}
                  placeholder={copy.fullName}
                  required
                />
                <FormField
                  label={copy.phone}
                  value={form.phone}
                  onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
                  placeholder={copy.phone}
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  type="email"
                  label={copy.email}
                  value={form.email}
                  onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                  placeholder="name@email.com"
                />
                <FormField
                  label={copy.companyName}
                  value={form.companyName}
                  onChange={(value) => setForm((current) => ({ ...current, companyName: value }))}
                  placeholder={copy.companyName}
                />
              </div>

              <FormField
                type="select"
                label={copy.contactWindow}
                value={form.contactWindow}
                onChange={(value) => setForm((current) => ({ ...current, contactWindow: value }))}
                options={copy.options}
              />

              <label className="grid gap-1 text-xs">
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{copy.message}</span>
                <textarea
                  value={form.message}
                  onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                  className="min-h-[96px] rounded-md border border-border bg-background/60 px-2 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/40 focus:outline-none transition"
                  placeholder={copy.message}
                />
              </label>

              <div className="mt-1 flex flex-wrap justify-end gap-2">
                <UiButton type="button" variant="outline" size="sm" onClick={closeModal} disabled={isSubmitting}>
                  {copy.cancel}
                </UiButton>
                <UiButton type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? copy.sending : copy.submit}
                </UiButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/provider";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const DATABASE_UNAVAILABLE_PATTERNS = [
  "Database is unavailable at",
  "Can't reach database server",
  "PrismaClientInitializationError",
  "P1001",
];

export default function AuthRouteError({ error, reset }: RouteErrorProps) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDatabaseUnavailable = DATABASE_UNAVAILABLE_PATTERNS.some((pattern) =>
    error.message.includes(pattern),
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-4 rounded-md border border-border bg-card/80 p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {isDatabaseUnavailable ? t("errors.auth.title.dbUnavailable") : t("errors.auth.title.generic")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isDatabaseUnavailable
            ? t("errors.auth.description.dbUnavailable")
            : t("errors.auth.description.generic")}
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:border-primary hover:text-primary-foreground"
        >
          {t("common.retry")}
        </button>
      </div>
    </div>
  );
}

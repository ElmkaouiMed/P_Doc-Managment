"use client";

import { useEffect } from "react";

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

export default function AppRouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDatabaseUnavailable = DATABASE_UNAVAILABLE_PATTERNS.some((pattern) =>
    error.message.includes(pattern),
  );

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl space-y-4 rounded-md border border-border bg-card/80 p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {isDatabaseUnavailable ? "Database connection problem" : "Something went wrong"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isDatabaseUnavailable
            ? `${error.message} Once the database is back online, retry this page.`
            : "An unexpected error happened while loading this page."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:border-primary hover:text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

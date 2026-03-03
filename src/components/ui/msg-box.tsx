"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { UiButton } from "@/components/ui/ui-button";

type ConfirmInput = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

type MsgBoxContextValue = {
  confirm: (input: ConfirmInput) => Promise<boolean>;
};

type PendingConfirm = ConfirmInput & {
  resolve: (value: boolean) => void;
};

const MsgBoxContext = createContext<MsgBoxContextValue | null>(null);

export function MsgBoxProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const close = useCallback((result: boolean) => {
    setPending((current) => {
      if (current) {
        current.resolve(result);
      }
      return null;
    });
  }, []);

  const confirm = useCallback((input: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      setPending((current) => {
        if (current) {
          current.resolve(false);
        }
        return { ...input, resolve };
      });
    });
  }, []);

  useEffect(() => {
    if (!pending) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, pending]);

  useEffect(() => {
    return () => {
      if (pending) {
        pending.resolve(false);
      }
    };
  }, [pending]);

  const value = useMemo<MsgBoxContextValue>(() => ({ confirm }), [confirm]);

  return (
    <MsgBoxContext.Provider value={value}>
      {children}
      {pending ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-md border border-border bg-card/95 p-4 shadow-2xl shadow-black/50">
            <h3 className="text-sm font-semibold text-foreground">{pending.title}</h3>
            {pending.description ? <p className="mt-2 text-xs text-muted-foreground">{pending.description}</p> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <UiButton type="button" size="sm" variant="ghost" onClick={() => close(false)}>
                {pending.cancelLabel || "Cancel"}
              </UiButton>
              <UiButton type="button" size="sm" variant={pending.variant === "danger" ? "danger" : "primary"} onClick={() => close(true)}>
                {pending.confirmLabel || "Confirm"}
              </UiButton>
            </div>
          </div>
        </div>
      ) : null}
    </MsgBoxContext.Provider>
  );
}

export function useMsgBox() {
  const context = useContext(MsgBoxContext);
  if (!context) {
    throw new Error("useMsgBox must be used within MsgBoxProvider.");
  }
  return context;
}

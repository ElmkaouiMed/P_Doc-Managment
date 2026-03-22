import { cache } from "react";

import { isDesktopMode } from "@/lib/runtime";

export type DocumentEngineCapabilities = {
  status: "ok" | "degraded" | "offline";
  version: string | null;
  adapters: string[];
  pdf: {
    supported: boolean;
    message: string | null;
    methods: string[];
  };
};

export function getDocumentEngineUrl() {
  return (process.env.DOCUMENT_ENGINE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

export function getDocumentEngineToken() {
  return (process.env.DOCUMENT_ENGINE_TOKEN || "").trim();
}

export const getDocumentEngineCapabilities = cache(async (): Promise<DocumentEngineCapabilities> => {
  const headers: HeadersInit = {};
  const token = getDocumentEngineToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${getDocumentEngineUrl()}/capabilities`, {
      headers,
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as Partial<DocumentEngineCapabilities>;
      return {
        status: data.status === "offline" || data.status === "degraded" ? data.status : "ok",
        version: typeof data.version === "string" ? data.version : null,
        adapters: Array.isArray(data.adapters) ? data.adapters.filter((item): item is string => typeof item === "string") : [],
        pdf: {
          supported: Boolean(data.pdf?.supported),
          message: typeof data.pdf?.message === "string" ? data.pdf.message : null,
          methods: Array.isArray(data.pdf?.methods) ? data.pdf.methods.filter((item): item is string => typeof item === "string") : [],
        },
      };
    }
  } catch {
    // Fall through to degraded defaults.
  }

  return {
    status: isDesktopMode() ? "offline" : "degraded",
    version: null,
    adapters: [],
    pdf: {
      supported: !isDesktopMode(),
      message: isDesktopMode() ? "Document engine is unavailable." : null,
      methods: [],
    },
  };
});

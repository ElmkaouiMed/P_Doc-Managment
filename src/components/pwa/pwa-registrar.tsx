"use client";

import { useEffect } from "react";

function isSecureHost() {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return window.isSecureContext || host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !isSecureHost()) {
      return;
    }

    const clearServiceWorkersAndCaches = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      } catch {
        // Ignore cleanup errors in dev.
      }
    };

    if (process.env.NODE_ENV !== "production") {
      void clearServiceWorkersAndCaches();
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Ignore registration errors to avoid breaking app boot.
      }
    };

    if (document.readyState === "complete") {
      void register();
      return;
    }

    const onLoad = () => {
      void register();
    };
    window.addEventListener("load", onLoad, { once: true });
    return () => {
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}

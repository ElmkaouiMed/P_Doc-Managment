import type { Metadata, Viewport } from "next";
import { Cairo, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { PwaRegistrar } from "@/components/pwa/pwa-registrar";
import { AppProviders } from "@/components/providers/app-providers";
import { getServerI18n } from "@/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "DOC_v1 Admin",
  description: "Documents-first multi-tenant platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DOC_v1",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/favicon.ico" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f7fb",
  colorScheme: "light dark",
};

const EXTENSION_ATTRS_GUARD = `
(() => {
  const knownAttrs = ["bis_skin_checked", "bis_register"];
  const isInjectedAttr = (name) => name.startsWith("bis_") || knownAttrs.includes(name);
  const stripInjectedAttrs = (el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (isInjectedAttr(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
  };

  const cleanupNode = (node) => {
    if (!node || node.nodeType !== 1) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode;
    while (current) {
      stripInjectedAttrs(current);
      current = walker.nextNode();
    }
  };

  const cleanupDocument = () => cleanupNode(document.documentElement);
  cleanupDocument();

  // Sweep for a short period on animation frames to catch extension writes
  // that happen between parse and hydration in development.
  let rafRuns = 0;
  const rafSweep = () => {
    cleanupDocument();
    rafRuns += 1;
    if (rafRuns < 180) {
      window.requestAnimationFrame(rafSweep);
    }
  };
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(rafSweep);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName && isInjectedAttr(mutation.attributeName)) {
        mutation.target.removeAttribute(mutation.attributeName);
      }
      mutation.addedNodes.forEach((node) => cleanupNode(node));
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
  });

  window.addEventListener("beforeunload", () => observer.disconnect(), { once: true });
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, direction } = await getServerI18n();
  const fontVariables = `${geistSans.variable} ${geistMono.variable} ${cairo.variable}`;

  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="extension-attrs-guard" strategy="beforeInteractive">
          {EXTENSION_ATTRS_GUARD}
        </Script>
        <PwaRegistrar />
        <AppProviders fontVariables={fontVariables} initialLocale={locale}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}

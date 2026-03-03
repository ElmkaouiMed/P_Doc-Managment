import type { Metadata } from "next";
import { Cairo, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

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
};

const EXTENSION_ATTRS_GUARD = `
(() => {
  const attrs = ["bis_skin_checked"];

  const cleanupNode = (node) => {
    if (!node || node.nodeType !== 1) return;
    for (const attr of attrs) {
      if (node.hasAttribute(attr)) {
        node.removeAttribute(attr);
      }
      node.querySelectorAll("[" + attr + "]").forEach((el) => el.removeAttribute(attr));
    }
  };

  cleanupNode(document.documentElement);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName && attrs.includes(mutation.attributeName)) {
        mutation.target.removeAttribute(mutation.attributeName);
      }
      mutation.addedNodes.forEach((node) => cleanupNode(node));
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: attrs,
  });

  window.addEventListener("load", () => observer.disconnect(), { once: true });
  setTimeout(() => observer.disconnect(), 5000);
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
    <html lang={locale} dir={direction} className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="extension-attrs-guard" strategy="beforeInteractive">
          {EXTENSION_ATTRS_GUARD}
        </Script>
        <AppProviders fontVariables={fontVariables} initialLocale={locale}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}

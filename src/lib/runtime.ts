import path from "path";

const DESKTOP_FLAG = process.env.DESKTOP_MODE === "1" || process.env.NEXT_PUBLIC_DESKTOP_MODE === "1";

export function isDesktopMode() {
  return DESKTOP_FLAG;
}

export function isDesktopBrowserMode() {
  return process.env.NEXT_PUBLIC_DESKTOP_MODE === "1";
}

export function getDocV1DataDir() {
  const configured = (process.env.DOC_V1_DATA_DIR || "").trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(process.cwd(), "..");
}

export function getDesktopAdminDefaults() {
  return {
    email: (process.env.DESKTOP_ADMIN_EMAIL || "owner@doc-v1.local").trim().toLowerCase(),
    password: (process.env.DESKTOP_ADMIN_PASSWORD || "Desktop1234!").trim(),
    fullName: (process.env.DESKTOP_ADMIN_FULL_NAME || "Local Admin").trim(),
    companyName: (process.env.DESKTOP_COMPANY_NAME || "Local Workspace").trim(),
  };
}

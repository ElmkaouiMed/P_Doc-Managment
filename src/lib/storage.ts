import path from "path";

import { getDocV1DataDir, isDesktopMode } from "@/lib/runtime";

function resolveRepoStorageRoot() {
  return path.resolve(process.cwd(), "..", "storage");
}

export function getStorageRoot() {
  if (isDesktopMode()) {
    return path.resolve(getDocV1DataDir(), "storage");
  }
  return resolveRepoStorageRoot();
}

export function resolveStoragePath(...segments: string[]) {
  return path.resolve(getStorageRoot(), ...segments);
}

export function resolveStorageRelativePath(relativePath: string) {
  return path.resolve(getStorageRoot(), relativePath);
}

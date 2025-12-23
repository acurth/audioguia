import type { Page } from "@sveltejs/kit";

export function getAppBase(page: Page): string {
  const rawPath = page.url.pathname;
  const normalized = rawPath === "/" ? "" : rawPath.replace(/\/$/, "");

  if (!page.route?.id || page.route.id === "/") {
    return normalized;
  }

  if (!normalized) {
    return "";
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length <= 1) {
    return "";
  }

  return `/${segments.slice(0, -1).join("/")}`;
}

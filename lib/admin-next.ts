export function safeAdminNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/admin") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) return "/admin";
  try {
    const parsed = new URL(value, "https://admin.local");
    if (parsed.origin !== "https://admin.local" || (parsed.pathname !== "/admin" && !parsed.pathname.startsWith("/admin/"))) return "/admin";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch { return "/admin"; }
}

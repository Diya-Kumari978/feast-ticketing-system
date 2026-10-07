import { headers } from "next/headers";
import { getAdmin } from "@/lib/auth";
import Logout from "@/components/logout";
import AdminSidebar from "@/components/admin-sidebar";
import EVENT_CONFIG from "@/lib/event-config";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const requestPath = requestHeaders.get("x-invoke-path") || requestHeaders.get("next-url") || "";
  if (requestPath.startsWith("/admin/login")) return children;
  const user = await getAdmin();
  if (!user) return children;
  return <div className="admin-layout">
    <AdminSidebar path={requestPath}/>
    <main className="admin-main"><div className="admin-head"><b>{EVENT_CONFIG.name} · Admin</b><Logout/></div>{children}</main>
  </div>;
}

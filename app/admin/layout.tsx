import { headers } from "next/headers";
import { getAdmin } from "@/lib/auth";
import Logout from "@/components/logout";
import AdminSidebar from "@/components/admin-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdmin();
  if (!user) return children;
  const path = (await headers()).get("x-invoke-path") || "";
  return (
    <div className="admin-layout">
            <AdminSidebar path={path} />
      <main className="admin-main"><div className="admin-head"><a href="/admin" aria-label="Back" className="btn light small">←</a><b>Feast Admin Panel</b><Logout /></div>{children}</main>
    </div>
  );
}

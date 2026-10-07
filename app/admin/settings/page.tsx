import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { adminAccounts } from "@/lib/admin-accounts";
import AdminProfiles from "@/components/admin-profiles";

const profileEmails = new Set(["ch.zubair2006@gmail.com", "shahnawazaliperhiar@gmail.com"]);

export default async function Settings() {
  const session = await getAdmin();
  if (!session) redirect(`/admin/login?next=${encodeURIComponent("/admin/settings")}`);
  const accounts = adminAccounts().filter(account => profileEmails.has(account.email.trim().toLowerCase()))
    .map(({ name, email }) => ({ name, email: email.trim().toLowerCase(), isCurrent: email.trim().toLowerCase() === session.email.toLowerCase() }));

  return <>
    <div className="eyebrow">Access and security</div><h1>Admin profiles</h1>
    <p className="muted" style={{ maxWidth: 720 }}>Manage the two Feast administrators. Passwords are never displayed; password changes are stored as salted hashes.</p>
    <AdminProfiles accounts={accounts}/>
  </>;
}

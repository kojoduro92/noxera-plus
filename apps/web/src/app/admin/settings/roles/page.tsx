import { redirect } from "next/navigation";

export default function AdminSettingsRolesPage() {
  redirect("/admin/settings?tab=roles");
}

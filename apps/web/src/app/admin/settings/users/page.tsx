import { redirect } from "next/navigation";

export default function AdminSettingsUsersPage() {
  redirect("/admin/settings?tab=users");
}

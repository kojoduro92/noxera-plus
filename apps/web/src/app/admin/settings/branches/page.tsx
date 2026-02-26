import { redirect } from "next/navigation";

export default function AdminSettingsBranchesPage() {
  redirect("/admin/settings?tab=branches");
}

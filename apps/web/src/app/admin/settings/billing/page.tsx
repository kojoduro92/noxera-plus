import { redirect } from "next/navigation";

export default function AdminSettingsBillingPage() {
  redirect("/admin/settings?tab=billing");
}

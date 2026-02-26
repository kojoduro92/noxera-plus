import { redirect } from "next/navigation";

export default function AdminSettingsIntegrationsPage() {
  redirect("/admin/settings?tab=integrations");
}

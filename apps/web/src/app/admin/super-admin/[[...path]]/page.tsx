import { redirect } from "next/navigation";

export default async function LegacySuperAdminRedirect({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const suffix = path.length ? `/${path.join("/")}` : "";
  redirect(`/super-admin${suffix}`);
}

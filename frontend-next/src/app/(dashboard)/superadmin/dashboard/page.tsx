import type { Metadata } from "next";
import AuthGuard from "@/components/auth/AuthGuard";
import Clients from "@/components/superadmin/Clients";

export const metadata: Metadata = { title: "Clients" };

export default function SuperadminDashboardPage() {
  return (
    <AuthGuard allowedUserType={["superadmin"]}>
      <Clients />
    </AuthGuard>
  );
}

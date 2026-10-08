import type { Metadata } from "next";
import AuthGuard from "@/components/auth/AuthGuard";
import ShortUrls from "@/components/admin/ShortUrls";

export const metadata: Metadata = { title: "Short URLs" };

export default function AdminDashboardPage() {
  return (
    <AuthGuard allowedUserType={["admin", "member"]}>
      <ShortUrls />
    </AuthGuard>
  );
}

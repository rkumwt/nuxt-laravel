import type { Metadata } from "next";
import AuthGuard from "@/components/auth/AuthGuard";
import ShortUrls from "@/components/superadmin/ShortUrls";

export const metadata: Metadata = { title: "Short URLs" };

export default function SuperadminUrlsPage() {
  return (
    <AuthGuard allowedUserType={["superadmin"]}>
      <ShortUrls />
    </AuthGuard>
  );
}

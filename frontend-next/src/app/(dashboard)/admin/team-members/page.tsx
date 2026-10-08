import type { Metadata } from "next";
import AuthGuard from "@/components/auth/AuthGuard";
import TeamMembers from "@/components/admin/TeamMembers";

export const metadata: Metadata = { title: "Team Members" };

export default function TeamMembersPage() {
  return (
    <AuthGuard allowedUserType={["admin"]}>
      <TeamMembers />
    </AuthGuard>
  );
}

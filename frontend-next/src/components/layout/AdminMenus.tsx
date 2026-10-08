"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth";

export default function AdminMenus() {
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <Link href="/admin/dashboard" className="menu-link">
        Dashboard
      </Link>
      {user?.type === "admin" && (
        <Link href="/admin/team-members" className="menu-link">
          Team Members
        </Link>
      )}
    </>
  );
}

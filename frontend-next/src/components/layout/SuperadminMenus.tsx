import Link from "next/link";

export default function SuperadminMenus() {
  return (
    <>
      <Link href="/superadmin/dashboard" className="menu-link">
        Dashboard
      </Link>
      <Link href="/superadmin/urls" className="menu-link">
        Short URLs
      </Link>
    </>
  );
}

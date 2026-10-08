export type UserType = "superadmin" | "admin" | "member";

export interface AuthUser {
  id: number;
  name: string;
  type: UserType;
  status: string;
  company_id: number;
  company?: { id: number; name: string };
}

// Landing page for a user after login
export const homeRouteFor = (user?: AuthUser | null) =>
  user?.type === "superadmin" ? "/superadmin/dashboard" : "/admin/dashboard";

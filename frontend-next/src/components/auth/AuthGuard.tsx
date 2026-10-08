"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flex, Spin } from "antd";
import { useAuthStore } from "@/stores/auth";
import { homeRouteFor, type UserType } from "@/lib/homeRoute";

interface AuthGuardProps {
  requireAuth?: boolean;
  requireUnauth?: boolean;
  allowedUserType?: UserType[];
  children: React.ReactNode;
}

// Client-side route guard: the token lives in localStorage, which only the
// browser can read, so this can't be done in proxy.ts
export default function AuthGuard({ requireAuth, requireUnauth, allowedUserType, children }: AuthGuardProps) {
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => !!s.authToken);

  let redirectTo: string | null = null;
  if (ready) {
    if (requireAuth && !isLoggedIn) {
      redirectTo = "/";
    } else if (requireUnauth && isLoggedIn) {
      redirectTo = homeRouteFor(user);
    } else if (allowedUserType && user && !allowedUserType.includes(user.type)) {
      redirectTo = homeRouteFor(user);
    }
  }

  useEffect(() => {
    if (redirectTo) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router]);

  if (!ready || redirectTo) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: "60vh" }}>
        <Spin />
      </Flex>
    );
  }

  return <>{children}</>;
}

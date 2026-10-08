"use client";

import { useRouter } from "next/navigation";
import { App, Button } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";

export default function Logout() {
  const router = useRouter();
  const { modal } = App.useApp();
  const logoutAction = useAuthStore((s) => s.logoutAction);

  const logout = () => {
    modal.confirm({
      title: "Logout?",
      icon: <ExclamationCircleOutlined />,
      content: "Are you sure you want to logout?",
      async onOk() {
        await logoutAction();
        router.replace("/");
      },
    });
  };

  return (
    <Button type="link" onClick={logout}>
      Logout
    </Button>
  );
}

"use client";

import { useEffect } from "react";
import { App, ConfigProvider } from "antd";
import { setMessageApi } from "@/lib/notify";
import { useAuthStore } from "@/stores/auth";

// Hands antd's context-aware message API to non-React code
function AntdStaticHolder() {
  const { message } = App.useApp();

  useEffect(() => {
    setMessageApi(message);
  }, [message]);

  return null;
}

// Reads the token and loads the user once, on first client render
function AuthBootstrap() {
  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider>
      <App>
        <AntdStaticHolder />
        <AuthBootstrap />
        {children}
      </App>
    </ConfigProvider>
  );
}

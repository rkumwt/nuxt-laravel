"use client";

import { Col, Layout, Row } from "antd";
import { useAuthStore } from "@/stores/auth";
import AdminMenus from "./AdminMenus";
import SuperadminMenus from "./SuperadminMenus";
import Logout from "./Logout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  return (
    <Layout>
      <Layout.Header style={{ background: "#fff", padding: "0 50px" }}>
        <Row>
          <Col span={12}>
            <Row>
              <Col span={6}>
                <span style={{ fontWeight: "bolder" }}>{user?.company?.name}</span>
              </Col>
              <Col span={18}>
                {user?.type === "superadmin" && <SuperadminMenus />}
                {(user?.type === "admin" || user?.type === "member") && <AdminMenus />}
              </Col>
            </Row>
          </Col>
          <Col span={12} style={{ textAlign: "right" }}>
            <Logout />
          </Col>
        </Row>
      </Layout.Header>
      <Layout.Content style={{ padding: "0 50px", minHeight: "100vh" }}>{children}</Layout.Content>
    </Layout>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Col, Form, Input, Row } from "antd";
import { fieldError, useApiRequest } from "@/hooks/useApiRequest";
import { homeRouteFor, type AuthUser } from "@/lib/homeRoute";
import { useAuthStore } from "@/stores/auth";

export default function LoginForm() {
  const router = useRouter();
  const { updateAuthToken, updateUser } = useAuthStore();
  const { loading, rules, apiRequest } = useApiRequest();
  const [formData, setFormData] = useState({ email: "", password: "" });

  const onSubmit = () => {
    apiRequest<{ user: AuthUser; token: string }>({
      url: "login",
      data: formData,
      success: (res) => {
        const user = res.data.user;
        updateAuthToken(res.data.token);
        updateUser(user);

        router.replace(homeRouteFor(user));
      },
    });
  };

  return (
    <div className="center-screen">
      <Row justify="center" align="middle" style={{ width: "50%" }}>
        <Col xs={22} sm={20} md={16} lg={12} xl={10} style={{ minWidth: 360 }}>
          <Card>
            <h2 style={{ textAlign: "center", marginBottom: 24 }}>Login</h2>
            <Form layout="vertical">
              <Form.Item label="Email" required {...fieldError(rules, "email")}>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Please Enter Your Email"
                  onPressEnter={onSubmit}
                />
              </Form.Item>

              <Form.Item label="Password" required {...fieldError(rules, "password")}>
                <Input.Password
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Please Enter Your Password"
                  onPressEnter={onSubmit}
                />
              </Form.Item>

              <Form.Item>
                <Button onClick={onSubmit} loading={loading} type="primary" block>
                  Submit
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

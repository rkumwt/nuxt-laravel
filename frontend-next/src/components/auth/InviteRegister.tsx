"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Col, Form, Input, Result, Row, Skeleton } from "antd";
import { api, ApiError, type ApiResponse } from "@/lib/api";
import { fieldError, useApiRequest } from "@/hooks/useApiRequest";

interface Invitation {
  name: string;
  email: string;
  company: { id: number; name: string; is_global: number };
}

export default function InviteRegister({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const { loading, rules, apiRequest } = useApiRequest();
  const [pageLoading, setPageLoading] = useState(true);
  const [company, setCompany] = useState<Invitation["company"] | null>(null);
  const [invitationMessageType, setInvitationMessageType] = useState<"warning" | "success">("warning");
  const [invitationMessage, setInvitationMessage] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    company_name: "",
    password: "",
    password_confirmation: "",
  });

  useEffect(() => {
    api<ApiResponse<{ data: Invitation }>>(`invitation/${inviteCode}`)
      .then((res) => {
        const response = res.data.data;
        setCompany(response.company);
        setFormData((prev) => ({ ...prev, name: response.name, email: response.email }));
      })
      .catch((err) => {
        setInvitationMessage(
          (err instanceof ApiError && err.data?.message) || "Invitation code not exists.",
        );
      })
      .finally(() => setPageLoading(false));
  }, [inviteCode]);

  const onSubmit = () => {
    apiRequest({
      url: `invitation/${inviteCode}/register`,
      data: formData,
      success: (res) => {
        setInvitationMessageType("success");
        setInvitationMessage(res.message);
      },
    });
  };

  const set = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [field]: e.target.value });

  return (
    <div className="center-screen">
      <Row justify="center" align="middle" style={{ width: "50%" }}>
        <Col xs={22} sm={20} md={16} lg={12} xl={10} style={{ minWidth: 360 }}>
          {pageLoading ? (
            <Skeleton active />
          ) : invitationMessage !== "" ? (
            <Card>
              <Result
                status={invitationMessageType}
                title={invitationMessage}
                extra={
                  <Button type="primary" onClick={() => router.push("/")} block>
                    Login
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card>
              <h2 style={{ textAlign: "center", marginBottom: 8 }}>Complete Registration</h2>
              <p style={{ textAlign: "center", marginBottom: 24, color: "#8c8c8c" }}>
                You&apos;ve been invited to join {company?.name}
              </p>

              <Form layout="vertical">
                <Form.Item label="Your Name" required {...fieldError(rules, "name")}>
                  <Input value={formData.name} placeholder="Enter your name" disabled />
                </Form.Item>

                <Form.Item label="Your Email" required {...fieldError(rules, "email")}>
                  <Input value={formData.email} disabled />
                </Form.Item>

                {company?.is_global ? (
                  <Form.Item label="Company Name" required {...fieldError(rules, "company_name")}>
                    <Input
                      value={formData.company_name}
                      onChange={set("company_name")}
                      placeholder="Enter your company name"
                      onPressEnter={onSubmit}
                    />
                  </Form.Item>
                ) : null}

                <Form.Item label="Password" required {...fieldError(rules, "password")}>
                  <Input.Password
                    value={formData.password}
                    onChange={set("password")}
                    placeholder="Enter your password"
                    onPressEnter={onSubmit}
                  />
                </Form.Item>

                <Form.Item label="Confirm Password" required {...fieldError(rules, "password_confirmation")}>
                  <Input.Password
                    value={formData.password_confirmation}
                    onChange={set("password_confirmation")}
                    placeholder="Confirm your password"
                    onPressEnter={onSubmit}
                  />
                </Form.Item>

                <Form.Item>
                  <Button onClick={onSubmit} loading={loading} type="primary" block>
                    Complete Registration
                  </Button>
                </Form.Item>

                <div style={{ textAlign: "center" }}>
                  <Button type="link" onClick={() => router.push("/")} block>
                    Already have an account? Login
                  </Button>
                </div>
              </Form>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}

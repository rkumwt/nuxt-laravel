"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal } from "antd";
import { fieldError, useApiRequest } from "@/hooks/useApiRequest";

const emptyForm = { name: "", email: "" };

export default function ClientInvite() {
  const { message } = App.useApp();
  const { loading, rules, apiRequest } = useApiRequest();
  const [formData, setFormData] = useState(emptyForm);
  const [open, setOpen] = useState(false);

  const onSubmit = () => {
    apiRequest({
      url: "superadmin/clients/invite",
      data: formData,
      success: () => {
        setOpen(false);
        setFormData(emptyForm);

        message.success("Invitation send successfully.");
      },
    });
  };

  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)}>
        Invite
      </Button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title="Invite New Client"
        footer={null}
        styles={{ body: { marginTop: 40 } }}
      >
        <Form layout="vertical">
          <Form.Item label="Name" required {...fieldError(rules, "name")}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Client Name"
              onPressEnter={onSubmit}
            />
          </Form.Item>

          <Form.Item label="Email" required {...fieldError(rules, "email")}>
            <Input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter Client Email"
              onPressEnter={onSubmit}
            />
          </Form.Item>

          <Form.Item>
            <Button onClick={onSubmit} loading={loading} type="primary" block>
              Send Invitation
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

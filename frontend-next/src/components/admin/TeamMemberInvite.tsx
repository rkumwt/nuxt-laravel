"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal, Select } from "antd";
import { fieldError, useApiRequest } from "@/hooks/useApiRequest";

const emptyForm = { name: "", email: "", role: "member" };

export default function TeamMemberInvite() {
  const { message } = App.useApp();
  const { loading, rules, apiRequest } = useApiRequest();
  const [formData, setFormData] = useState(emptyForm);
  const [open, setOpen] = useState(false);

  const onSubmit = () => {
    apiRequest({
      url: "admin/team-members/invite",
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
        title="Invite Team Member"
        footer={null}
        styles={{ body: { marginTop: 40 } }}
      >
        <Form layout="vertical">
          <Form.Item label="Name" required {...fieldError(rules, "name")}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Team Member Name"
              onPressEnter={onSubmit}
            />
          </Form.Item>

          <Form.Item label="Email" required {...fieldError(rules, "email")}>
            <Input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter Team Member Email"
              onPressEnter={onSubmit}
            />
          </Form.Item>

          <Form.Item label="Role" required {...fieldError(rules, "role")}>
            <Select
              value={formData.role}
              onChange={(role) => setFormData({ ...formData, role })}
              placeholder="Select Role"
              options={[
                { value: "admin", label: "Admin" },
                { value: "member", label: "Member" },
              ]}
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

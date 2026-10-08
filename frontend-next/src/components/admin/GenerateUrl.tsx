"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal } from "antd";
import { fieldError, useApiRequest } from "@/hooks/useApiRequest";

export default function GenerateUrl({ onSuccess }: { onSuccess?: () => void }) {
  const { message } = App.useApp();
  const { loading, rules, apiRequest } = useApiRequest();
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);

  const onSubmit = () => {
    apiRequest({
      url: "admin/urls/generate",
      data: { url },
      success: (res) => {
        setOpen(false);
        setUrl("");

        onSuccess?.();

        message.success(res.message);
      },
    });
  };

  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)}>
        Generate
      </Button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title="Generate Short URL"
        footer={null}
        styles={{ body: { marginTop: 40 } }}
      >
        <Form layout="vertical">
          <Form.Item label="Long URL" required {...fieldError(rules, "url")}>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter long URL to generate short url"
              onPressEnter={onSubmit}
            />
          </Form.Item>

          <Form.Item>
            <Button onClick={onSubmit} loading={loading} type="primary" block>
              Generate
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

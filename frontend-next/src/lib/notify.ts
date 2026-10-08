import type { MessageInstance } from "antd/es/message/interface";

// Lets non-React code (the api client) show antd messages that respect the
// app's ConfigProvider theme. Filled in by <AntdStaticHolder /> on mount.
let messageApi: MessageInstance | null = null;

export const setMessageApi = (api: MessageInstance) => {
  messageApi = api;
};

export const notifyError = (text: string) => {
  messageApi?.error(text);
};

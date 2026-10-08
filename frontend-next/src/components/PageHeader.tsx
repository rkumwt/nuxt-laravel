import { Flex, Space, Typography } from "antd";

interface PageHeaderProps {
  title: string;
  subTitle?: React.ReactNode;
  extra?: React.ReactNode;
}

// antd v5+ dropped PageHeader; this is the small subset the app uses
export default function PageHeader({ title, subTitle, extra }: PageHeaderProps) {
  return (
    <Flex justify="space-between" align="center" style={{ padding: "25px 0" }} wrap gap={12}>
      <Space size="middle">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subTitle}
      </Space>
      {extra && <Space>{extra}</Space>}
    </Flex>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Button, DatePicker, Table, type TableColumnsType } from "antd";
import PageHeader from "@/components/PageHeader";
import { useDatatable } from "@/hooks/useDatatable";
import { useDownload } from "@/hooks/useDownload";
import { rangePresets } from "@/lib/rangePresets";

interface ShortUrl {
  id: number;
  url: string;
  short_url: string;
  hits: number;
  client: string;
  client_id: number;
  created_at: string;
}

const columns: TableColumnsType<ShortUrl> = [
  {
    title: "Short URL",
    dataIndex: "short_url",
    render: (value: string) => (
      <a href={value} target="_blank" rel="noreferrer">
        {value}
      </a>
    ),
  },
  { title: "Long URL", dataIndex: "url" },
  { title: "Hits", dataIndex: "hits" },
  {
    title: "Client",
    dataIndex: "client",
    render: (_, record) => <Link href={`/superadmin/urls/${record.client_id}`}>{record.client}</Link>,
  },
  {
    title: "Created On",
    dataIndex: "created_at",
    render: (value: string) => dayjs(value).format("DD MMM YYYY"),
  },
];

export default function ShortUrls({ clientId }: { clientId?: string }) {
  const [dateRange, setDateRange] = useState<{ start_date?: string; end_date?: string }>({});
  const params = { ...dateRange, ...(clientId ? { company_id: clientId } : {}) };

  const { downloading, download } = useDownload();
  const { data, loading, tablePagination, handleTableChange } = useDatatable<ShortUrl>("superadmin/urls", params);

  return (
    <div>
      <PageHeader
        title="Short URLs"
        extra={
          <>
            <DatePicker.RangePicker
              presets={rangePresets()}
              onChange={(dates, dateStrings) =>
                setDateRange(dates ? { start_date: dateStrings[0], end_date: dateStrings[1] } : {})
              }
            />
            <Button
              type="primary"
              loading={downloading}
              onClick={() => download("superadmin/urls/download", params, "urls.csv")}
            >
              Download
            </Button>
          </>
        }
      />

      <Table
        columns={columns}
        dataSource={data}
        pagination={tablePagination}
        loading={loading}
        rowKey="id"
        onChange={handleTableChange}
        size="middle"
      />
    </div>
  );
}

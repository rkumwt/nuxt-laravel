"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Button, DatePicker, Table, type TableColumnsType } from "antd";
import PageHeader from "@/components/PageHeader";
import { useDatatable } from "@/hooks/useDatatable";
import { useDownload } from "@/hooks/useDownload";
import { rangePresets } from "@/lib/rangePresets";
import GenerateUrl from "./GenerateUrl";

interface ShortUrl {
  id: number;
  url: string;
  short_url: string;
  hits: number;
  user: string;
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
  { title: "User", dataIndex: "user" },
  {
    title: "Created On",
    dataIndex: "created_at",
    render: (value: string) => dayjs(value).format("DD MMM YYYY"),
  },
];

export default function ShortUrls() {
  const [params, setParams] = useState<{ start_date?: string; end_date?: string }>({});

  const { downloading, download } = useDownload();
  const { data, loading, tablePagination, handleTableChange, reload } = useDatatable<ShortUrl>("admin/urls", params);

  return (
    <div>
      <PageHeader
        title="Short URLs"
        subTitle={<GenerateUrl onSuccess={reload} />}
        extra={
          <>
            <DatePicker.RangePicker
              presets={rangePresets()}
              onChange={(dates, dateStrings) =>
                setParams(dates ? { start_date: dateStrings[0], end_date: dateStrings[1] } : {})
              }
            />
            <Button
              type="primary"
              loading={downloading}
              onClick={() => download("admin/urls/download", params, "urls.csv")}
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

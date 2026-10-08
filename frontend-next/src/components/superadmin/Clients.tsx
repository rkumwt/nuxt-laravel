"use client";

import Link from "next/link";
import { Table, type TableColumnsType } from "antd";
import PageHeader from "@/components/PageHeader";
import { useDatatable } from "@/hooks/useDatatable";
import ClientInvite from "./ClientInvite";

interface Client {
  id: number;
  name: string;
  email: string;
  total_users: number;
  total_urls: number;
  total_url_hits: number;
}

const columns: TableColumnsType<Client> = [
  {
    title: "Client name",
    dataIndex: "name",
    render: (_, record) => (
      <>
        <Link href={`/superadmin/urls/${record.id}`}>{record.name}</Link>
        <br />
        {record.email}
      </>
    ),
  },
  { title: "Users", dataIndex: "total_users" },
  { title: "Total Generated URLs", dataIndex: "total_urls" },
  { title: "Total URL Hits", dataIndex: "total_url_hits" },
];

export default function Clients() {
  const { data, loading, tablePagination, handleTableChange } = useDatatable<Client>("superadmin/clients");

  return (
    <div>
      <PageHeader title="Clients" extra={<ClientInvite />} />

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

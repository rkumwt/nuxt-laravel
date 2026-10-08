"use client";

import { Table, type TableColumnsType } from "antd";
import PageHeader from "@/components/PageHeader";
import { useDatatable } from "@/hooks/useDatatable";
import TeamMemberInvite from "./TeamMemberInvite";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  type: "admin" | "member";
  total_urls: number;
  total_url_hits: number;
}

const columns: TableColumnsType<TeamMember> = [
  { title: "Name", dataIndex: "name" },
  { title: "Email", dataIndex: "email" },
  {
    title: "Role",
    dataIndex: "type",
    render: (type: string) => (type === "admin" ? "Admin" : "Member"),
  },
  { title: "Total Generated URLs", dataIndex: "total_urls" },
  { title: "Total URL Hits", dataIndex: "total_url_hits" },
];

export default function TeamMembers() {
  const { data, loading, tablePagination, handleTableChange } = useDatatable<TeamMember>("admin/team-members");

  return (
    <div>
      <PageHeader title="Team Members" extra={<TeamMemberInvite />} />

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

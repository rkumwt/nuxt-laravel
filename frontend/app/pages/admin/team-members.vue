<template>
    <div>
        <a-page-header style="padding: 25px 0px" title="Team Members">
            <template #extra>
                <AdminTeamMemberInvite />
            </template>
        </a-page-header>

        <a-table
            :columns="columns"
            :data-source="data"
            :pagination="tablePagination"
            :loading="loading"
            row-key="id"
            @change="handleTableChange"
            size="middle"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'role'">
                    {{ record.type === "admin" ? "Admin" : "Member" }}
                </template>
            </template>
        </a-table>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    requireAuth: true,
    allowedUserType: ["admin"],
});

const columns = [
    { title: "Name", dataIndex: "name" },
    { title: "Email", dataIndex: "email" },
    { title: "Role", dataIndex: "role" },
    { title: "Total Generated URLs", dataIndex: "total_urls" },
    { title: "Total URL Hits", dataIndex: "total_url_hits" },
];

const { url, data, loading, tablePagination, fetchData, handleTableChange } = useDatatable();

onMounted(() => {
    url.value = "admin/team-members";
    fetchData();
});
</script>

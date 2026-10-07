<template>
    <div>
        <a-page-header style="padding: 25px 0px" title="Clients">
            <template #extra>
                <SuperadminClientInvite />
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
                <template v-if="column.dataIndex === 'name'">
                    <NuxtLink :to="`/superadmin/urls/${record.id}`">
                        {{ record.name }}
                    </NuxtLink>
                    <br />
                    {{ record.email }}
                </template>
            </template>
        </a-table>
    </div>
</template>

<script setup lang="ts">
const columns = [
    { title: "Client name", dataIndex: "name" },
    { title: "Users", dataIndex: "total_users" },
    { title: "Total Generated URLs", dataIndex: "total_urls" },
    { title: "Total URL Hits", dataIndex: "total_url_hits" },
];

const { url, data, loading, tablePagination, fetchData, handleTableChange } = useDatatable();

onMounted(() => {
    url.value = "superadmin/clients";
    fetchData();
});
</script>

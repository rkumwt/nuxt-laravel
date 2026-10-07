<template>
    <div>
        <a-page-header style="padding: 25px 0px" title="Short URLs">
            <template #subTitle>
                <AdminGenerateUrl @success="reload" />
            </template>
            <template #extra>
                <a-range-picker
                    :presets="rangePresets"
                    value-format="YYYY-MM-DD"
                    @change="onRangeChange"
                />
                <a-button
                    type="primary"
                    @click="download('admin/urls/download', { ...params }, 'urls.csv')"
                    :loading="downloading"
                >
                    Download
                </a-button>
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
                <template v-if="column.dataIndex === 'short_url'">
                    <a :href="record.short_url" target="_blank">{{ record.short_url }}</a>
                </template>
                <template v-if="column.dataIndex === 'created_at'">
                    {{ dayjs(record.created_at).format("DD MMM YYYY") }}
                </template>
            </template>
        </a-table>
    </div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";

const columns = [
    { title: "Short URL", dataIndex: "short_url" },
    { title: "Long URL", dataIndex: "url" },
    { title: "Hits", dataIndex: "hits" },
    { title: "User", dataIndex: "user" },
    { title: "Created On", dataIndex: "created_at" },
];
const rangePresets = useRangePresets();
const { downloading, download } = useDownload();
const { url, data, params, loading, tablePagination, fetchData, reload, handleTableChange } = useDatatable();

onMounted(() => {
    url.value = "admin/urls";
    fetchData();
});

const onRangeChange = (dates: [string, string] | null) => {
    if (dates) {
        params.value.start_date = dates[0];
        params.value.end_date = dates[1];
    } else {
        delete params.value.start_date;
        delete params.value.end_date;
    }
    reload();
};
</script>

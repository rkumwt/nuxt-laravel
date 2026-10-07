<template>
    <div>
        <a-page-header style="padding: 25px 0px" title="Short URLs">
            <template #extra>
                <a-range-picker
                    :presets="rangePresets"
                    value-format="YYYY-MM-DD"
                    @change="onRangeChange"
                />
                <a-button
                    type="primary"
                    @click="download('superadmin/urls/download', { ...params }, 'urls.csv')"
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
                <template v-if="column.dataIndex === 'client'">
                    <NuxtLink :to="`/superadmin/urls/${record.client_id}`">
                        {{ record.client }}
                    </NuxtLink>
                </template>
            </template>
        </a-table>
    </div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";

const props = defineProps<{ clientId?: string }>();

const columns = [
    { title: "Short URL", dataIndex: "short_url" },
    { title: "Long URL", dataIndex: "url" },
    { title: "Hits", dataIndex: "hits" },
    { title: "Client", dataIndex: "client" },
    { title: "Created On", dataIndex: "created_at" },
];
const rangePresets = useRangePresets();
const { downloading, download } = useDownload();
const { url, data, params, loading, tablePagination, fetchData, reload, handleTableChange } = useDatatable();

const loadData = () => {
    if (props.clientId) {
        params.value.company_id = props.clientId;
    } else {
        delete params.value.company_id;
    }

    url.value = "superadmin/urls";
    reload();
};

onMounted(loadData);

watch(() => props.clientId, loadData);

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

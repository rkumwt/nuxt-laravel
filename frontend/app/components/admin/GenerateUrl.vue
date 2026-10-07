<template>
    <span>
        <a-button type="primary" @click="showModal">Generate</a-button>
        <a-modal
            v-model:open="open"
            title="Generate Short URL"
            :footer="null"
            :bodyStyle="{ marginTop: '40px' }"
        >
            <a-row>
                <a-col :span="24">
                    <a-form layout="vertical">
                        <a-form-item
                            label="Long URL"
                            name="url"
                            :help="rules.url ? rules.url[0] : undefined"
                            :validateStatus="rules.url ? 'error' : undefined"
                            class="required"
                        >
                            <a-input
                                v-model:value="formData.url"
                                placeholder="Enter long URL to generate short url"
                                @pressEnter="onSubmit"
                            />
                        </a-form-item>

                        <a-form-item>
                            <a-button
                                @click="onSubmit"
                                :loading="loading"
                                type="primary"
                                block
                            >
                                Generate
                            </a-button>
                        </a-form-item>
                    </a-form>
                </a-col>
            </a-row>
        </a-modal>
    </span>
</template>

<script setup lang="ts">
import { message } from "ant-design-vue";

const emit = defineEmits(["success"]);
const { loading, rules, apiRequest } = useApiRequest();

const formData = ref({
    url: "",
});
const open = ref(false);

const showModal = () => {
    open.value = true;
};

const onSubmit = () => {
    apiRequest({
        url: "admin/urls/generate",
        data: formData.value,
        success: (res) => {
            open.value = false;
            formData.value = { url: "" };

            emit("success");

            message.success(res.message);
        },
    });
};
</script>

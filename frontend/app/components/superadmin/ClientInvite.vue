<template>
    <span>
        <a-button type="primary" @click="showModal">Invite</a-button>
        <a-modal
            v-model:open="open"
            title="Invite New Client"
            :footer="null"
            :bodyStyle="{ marginTop: '40px' }"
        >
            <a-row>
                <a-col :span="24">
                    <a-form layout="vertical">
                        <a-form-item
                            label="Name"
                            name="name"
                            :help="rules.name ? rules.name[0] : undefined"
                            :validateStatus="rules.name ? 'error' : undefined"
                            class="required"
                        >
                            <a-input
                                v-model:value="formData.name"
                                placeholder="Client Name"
                                @pressEnter="onSubmit"
                            />
                        </a-form-item>

                        <a-form-item
                            label="Email"
                            name="email"
                            :help="rules.email ? rules.email[0] : undefined"
                            :validateStatus="rules.email ? 'error' : undefined"
                            class="required"
                        >
                            <a-input
                                v-model:value="formData.email"
                                placeholder="Enter Client Email"
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
                                Send Invitation
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

const { loading, rules, apiRequest } = useApiRequest();

const formData = ref({
    name: "",
    email: "",
});
const open = ref(false);

const showModal = () => {
    open.value = true;
};

const onSubmit = () => {
    apiRequest({
        url: "superadmin/clients/invite",
        data: formData.value,
        success: () => {
            open.value = false;
            formData.value = { name: "", email: "" };

            message.success("Invitation send successfully.");
        },
    });
};
</script>

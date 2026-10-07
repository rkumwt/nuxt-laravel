<template>
    <a-button type="link" @click="logout">Logout</a-button>
</template>

<script setup lang="ts">
import { ExclamationCircleOutlined } from "@ant-design/icons-vue";
import { Modal } from "ant-design-vue";
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();

const logout = () => {
    Modal.confirm({
        title: "Logout?",
        icon: h(ExclamationCircleOutlined),
        content: "Are you sure you want to logout?",
        onOk() {
            return authStore.logoutAction();
        },
    });
};
</script>

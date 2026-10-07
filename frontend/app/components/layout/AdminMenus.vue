<template>
    <span>
        <a-button type="link" @click="navigateTo('/admin/dashboard')">
            Dashboard
        </a-button>
        <a-button
            v-if="authStore.user?.type === 'admin'"
            type="link"
            @click="navigateTo('/admin/team-members')"
        >
            Team Members
        </a-button>
    </span>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();
</script>

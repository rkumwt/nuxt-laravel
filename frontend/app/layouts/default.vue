<template>
    <a-layout class="layout">
        <a-layout-header :style="{ background: '#fff', padding: '0 50px' }">
            <a-row>
                <a-col :span="12">
                    <a-row>
                        <a-col :span="6">
                            <span style="font-weight: bolder">
                                {{ authStore.user?.company?.name }}
                            </span>
                        </a-col>
                        <a-col :span="18">
                            <LayoutSuperadminMenus
                                v-if="authStore.user?.type === 'superadmin'"
                            />
                            <LayoutAdminMenus
                                v-if="['admin', 'member'].includes(authStore.user?.type ?? '')"
                            />
                        </a-col>
                    </a-row>
                </a-col>
                <a-col :span="12" :style="{ textAlign: 'right' }">
                    <LayoutLogout />
                </a-col>
            </a-row>
        </a-layout-header>
        <a-layout-content style="padding: 0 50px; min-height: 100vh">
            <slot />
        </a-layout-content>
    </a-layout>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();
</script>

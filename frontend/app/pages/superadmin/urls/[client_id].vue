<template>
    <SuperadminShortUrls :client-id="(route.params.client_id as string)" />
</template>

<script setup lang="ts">
definePageMeta({
    requireAuth: true,
    allowedUserType: ["superadmin"],
});

const route = useRoute();
</script>

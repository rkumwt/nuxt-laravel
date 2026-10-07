<template>
    <SuperadminClients />
</template>

<script setup lang="ts">
definePageMeta({
    requireAuth: true,
    allowedUserType: ["superadmin"],
});
</script>

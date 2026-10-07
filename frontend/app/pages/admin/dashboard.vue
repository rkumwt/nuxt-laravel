<template>
    <AdminShortUrls />
</template>

<script setup lang="ts">
definePageMeta({
    requireAuth: true,
    allowedUserType: ["admin", "member"],
});
</script>

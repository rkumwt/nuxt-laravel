<template>
    <div class="login-container">
        <a-row justify="center" align="middle" style="height: 100%; width: 50%">
            <a-col :xs="22" :sm="20" :md="16" :lg="12" :xl="10">
                <a-card>
                    <h2 style="text-align: center; margin-bottom: 24px">Login</h2>
                    <a-form layout="vertical">
                        <a-form-item
                            label="Email"
                            name="email"
                            :help="rules.email ? rules.email[0] : undefined"
                            :validateStatus="rules.email ? 'error' : undefined"
                            class="required"
                        >
                            <a-input
                                v-model:value="formData.email"
                                placeholder="Please Enter Your Email"
                                @pressEnter="onSubmit"
                            />
                        </a-form-item>

                        <a-form-item
                            label="Password"
                            name="password"
                            :help="rules.password ? rules.password[0] : undefined"
                            :validateStatus="rules.password ? 'error' : undefined"
                            class="required"
                        >
                            <a-input-password
                                v-model:value="formData.password"
                                placeholder="Please Enter Your Password"
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
                                Submit
                            </a-button>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>
    </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
import { homeRouteFor } from "~/utils/homeRoute";

definePageMeta({
    layout: "blank",
    requireUnauth: true,
});

const authStore = useAuthStore();
const { loading, rules, apiRequest } = useApiRequest();
const formData = ref({
    email: "",
    password: "",
});

const onSubmit = () => {
    apiRequest({
        url: "login",
        data: formData.value,
        success: (res) => {
            const user = res.data.user;
            authStore.updateAuthToken(res.data.token);
            authStore.updateUser(user);

            navigateTo(homeRouteFor(user));
        },
    });
};
</script>

<style scoped>
.login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>

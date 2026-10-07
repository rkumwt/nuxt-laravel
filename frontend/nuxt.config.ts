// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },

	// Auth token lives in localStorage, so the app runs as a client-side SPA
	ssr: false,

	modules: ["@pinia/nuxt"],

	css: ["ant-design-vue/dist/reset.css", "~/assets/css/main.css"],

	app: {
		head: {
			title: "URL Shortner",
		},
	},

	runtimeConfig: {
		public: {
			// Override with NUXT_PUBLIC_API_BASE
			apiBase: "http://localhost:8000/api",
		},
	},
});

"use client";

import { useState } from "react";
import { api, ApiError, type ApiErrorBody, type ApiResponse } from "@/lib/api";

interface ApiRequestConfig<T> {
  url: string;
  data?: Record<string, unknown>;
  success?: (res: ApiResponse<T>) => void;
  error?: (err: { status?: number; data?: ApiErrorBody | null }) => void;
}

// Form submit helper: tracks loading and exposes Laravel validation errors as `rules`
export function useApiRequest() {
  const [rules, setRules] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const apiRequest = async <T = unknown>(config: ApiRequestConfig<T>) => {
    setLoading(true);
    setRules({});

    try {
      const res = await api<ApiResponse<T>>(config.url, { body: config.data ?? {} });
      setLoading(false);

      config.success?.(res);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      const data = err instanceof ApiError ? err.data : undefined;

      setRules(data?.errors ?? {});
      setLoading(false);

      config.error?.({ status, data });
    }
  };

  return { rules, loading, apiRequest };
}

// Props for an antd <Form.Item> showing the first server error for `field`
export const fieldError = (rules: Record<string, string[]>, field: string) =>
  rules[field]
    ? { help: rules[field][0], validateStatus: "error" as const }
    : {};

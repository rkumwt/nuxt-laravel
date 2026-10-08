import { AUTH_TOKEN } from "./storageKeys";
import { notifyError } from "./notify";

export interface ApiResponse<T = unknown> {
  status: boolean;
  message: string;
  data: T;
}

// Laravel error body: { message, errors: { field: [messages] } }
export interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: ApiErrorBody | null,
  ) {
    super(data?.message ?? `Request failed with status ${status}`);
  }
}

interface ApiOptions {
  body?: Record<string, unknown>;
  responseType?: "json" | "blob";
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

// POST to the Laravel API: adds the bearer token and handles 401/403
export async function api<T = ApiResponse>(url: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  const token = localStorage.getItem(AUTH_TOKEN);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/${url.replace(/^\//, "")}`, {
    method: "POST",
    headers,
    body: JSON.stringify(options.body ?? {}),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      localStorage.clear();
      // Full reload resets the store and lands on login (outside React, so no router)
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } else if (response.status === 403) {
      notifyError(data?.message || "Forbidden");
    }

    throw new ApiError(response.status, data);
  }

  return (options.responseType === "blob" ? response.blob() : response.json()) as Promise<T>;
}

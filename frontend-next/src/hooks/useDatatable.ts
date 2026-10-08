"use client";

import { useCallback, useEffect, useState } from "react";
import type { TablePaginationConfig } from "antd";
import { api, type ApiResponse } from "@/lib/api";

interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

// Paginated list backed by a Laravel endpoint. Refetches whenever `url`,
// `params`, page or page size change.
export function useDatatable<T>(url: string, params: Record<string, unknown> = {}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  // Bumped to force a refetch with unchanged inputs (e.g. after creating a row)
  const [version, setVersion] = useState(0);

  // Stable dependency for the params object
  const paramsKey = JSON.stringify(params);

  // Filter changes start again from the first page
  const [prevKey, setPrevKey] = useState(url + paramsKey);
  if (prevKey !== url + paramsKey) {
    setPrevKey(url + paramsKey);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await api<ApiResponse<Paginated<T>>>(url, {
          body: { per_page: pageSize, page, ...JSON.parse(paramsKey) },
        });
        if (!cancelled) {
          setData(res.data.data);
          setTotal(res.data.meta.total);
        }
      } catch {
        // Errors are surfaced by the api client
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [url, paramsKey, page, pageSize, version]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1);
    setPageSize(pagination.pageSize ?? 10);
  };

  const reload = useCallback(() => {
    setPage(1);
    setVersion((v) => v + 1);
  }, []);

  const tablePagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
  };

  return { data, loading, tablePagination, handleTableChange, reload };
}

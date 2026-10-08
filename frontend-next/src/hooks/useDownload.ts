"use client";

import { useState } from "react";
import { api } from "@/lib/api";

// POSTs to a download endpoint and saves the returned file
export function useDownload() {
  const [downloading, setDownloading] = useState(false);

  const download = async (url: string, payload: Record<string, unknown>, fileName: string, docType = "text/csv") => {
    setDownloading(true);

    try {
      const response = await api<Blob>(url, { body: payload, responseType: "blob" });

      const blob = new Blob([response], { type: docType });
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      // Errors are surfaced by the api client
    } finally {
      setDownloading(false);
    }
  };

  return { downloading, download };
}

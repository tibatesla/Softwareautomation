"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadReport, ReportFormat, ReportResource } from "@/lib/reports";
import { ApiError } from "@/lib/api";

const FORMAT_LABEL: Record<ReportFormat, string> = {
  csv: "Download as CSV",
  xlsx: "Download as Excel",
  pdf: "Download as PDF",
};

export function ReportDownloadMenu({ resource, query }: { resource: ReportResource; query?: Record<string, string> }) {
  const [pending, setPending] = useState<ReportFormat | null>(null);

  const handleDownload = async (format: ReportFormat) => {
    setPending(format);
    try {
      await downloadReport(resource, format, query);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to generate report";
      toast.error(message);
    } finally {
      setPending(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={pending !== null} />}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Reports
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(FORMAT_LABEL) as ReportFormat[]).map((format) => (
          <DropdownMenuItem key={format} onClick={() => handleDownload(format)} disabled={pending !== null}>
            {FORMAT_LABEL[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

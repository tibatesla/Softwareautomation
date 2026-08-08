"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton({ fallbackHref }: { fallbackHref?: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-fit gap-1 px-2 text-muted-foreground hover:text-foreground"
      onClick={() => (fallbackHref ? router.push(fallbackHref) : router.back())}
    >
      <ArrowLeft className="size-4" />
      Back
    </Button>
  );
}

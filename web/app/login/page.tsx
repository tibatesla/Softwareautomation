"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { LineChart, Contact, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setServerError(data?.error ?? "Login failed");
      return;
    }

    const next = searchParams.get("next") ?? "/dashboard";
    router.push(next);
    router.refresh();
  };

  return (
    <Card className="w-full max-w-sm border-t-4 border-t-primary">
      <CardHeader>
        <div className="mb-2 flex size-12 items-center justify-center rounded-lg bg-white ring-1 ring-border lg:hidden">
          <Image src="/logo.jpg" alt="Chestone Properties" width={40} height={40} className="rounded-sm object-contain" />
        </div>
        <CardTitle>Chestone Properties</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-linear-to-br from-[#001c3d] via-[#002b5b] to-[#003d7a] p-10 text-white lg:flex">
      <div className="absolute -top-24 -right-24 size-72 rounded-full bg-[#C5A059]/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-[#C5A059]/10 blur-3xl" />

      <div className="relative flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white p-1">
          <Image src="/logo.jpg" alt="Chestone Properties" width={36} height={36} className="rounded-sm object-contain" />
        </div>
        <span className="text-lg font-semibold">Chestone Properties</span>
      </div>

      <div className="relative flex flex-col gap-6">
        <h1 className="text-3xl font-semibold leading-tight text-balance">
          A unified platform for property management, sales, and advertising performance.
        </h1>
        <div className="flex flex-col gap-3 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <Contact className="size-4" /> Centralized lead management, from first contact to closed deal
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4" /> Streamlined site-visit scheduling and payment tracking
          </div>
          <div className="flex items-center gap-2">
            <LineChart className="size-4" /> Consolidated advertising performance across Meta, Google, and TikTok
          </div>
        </div>
      </div>

      <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Chestone Properties Ltd.</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-1">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center bg-muted/40 p-4">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

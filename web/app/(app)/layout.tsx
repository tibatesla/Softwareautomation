import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AuthProvider } from "@/components/layout/auth-context";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  // Defense in depth -- proxy.ts already redirects unauthenticated requests
  // before they reach here, based on the same cookie.
  if (!user) {
    redirect("/login");
  }

  return (
    <AuthProvider user={user}>
      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}

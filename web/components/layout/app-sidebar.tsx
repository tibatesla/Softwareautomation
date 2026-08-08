"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { hasRole, type AuthUser } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function AppSidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  // Icon components can't cross the server->client prop boundary, so
  // NAV_ITEMS (which holds Lucide component references) is imported and
  // role-filtered here on the client, rather than passed down from the
  // server layout as a prop.
  const navItems = NAV_ITEMS.filter((item) => hasRole(user, item.roles));

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white p-1">
            <Image src="/logo.jpg" alt="Chestone Properties" width={32} height={32} className="rounded-sm object-contain" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-sidebar-foreground">Chestone</span>
            <span className="text-xs text-sidebar-foreground/60">Properties CRM</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} />} isActive={isActive}>
                      <Icon className={cn("size-4", !isActive && item.iconClassName)} />
                      {item.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

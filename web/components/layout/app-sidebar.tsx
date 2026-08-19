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
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import { hasRole, type AuthUser } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/nav-items";
import { cn } from "@/lib/utils";
import { useLeadNotifications } from "@/hooks/use-lead-notifications";

export function AppSidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  // Mounted here (not the leads page) so unread notifications fire and the
  // badge stays current no matter which page is open -- see the hook for
  // why bot activity never counts toward "unread".
  const { totalUnread } = useLeadNotifications();
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
                    <SidebarMenuButton
                      render={<Link href={item.href} onClick={() => isMobile && setOpenMobile(false)} />}
                      isActive={isActive}
                    >
                      <Icon className={cn("size-4", !isActive && item.iconClassName)} />
                      {item.label}
                      {item.href === "/leads" && totalUnread > 0 && (
                        <Badge variant="destructive" className="ml-auto">
                          {totalUnread}
                        </Badge>
                      )}
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

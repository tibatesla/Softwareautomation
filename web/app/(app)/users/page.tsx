"use client";

import { toast } from "sonner";
import { useUpdateUser, useUsers } from "@/lib/queries/users";
import { UserDialog } from "@/components/users/user-dialog";
import { UserEditDialog } from "@/components/users/user-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import { MANAGEABLE_USER_ROLE_VALUES } from "@/lib/types";
import type { User, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_TRIGGER_CLASS: Record<UserRole, string> = {
  owner: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  admin: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  agent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

function UserRow({ user }: { user: User }) {
  const updateUser = useUpdateUser(user.id);

  // The Owner account is protected from this UI entirely -- no role change,
  // no deactivation, no edit. There must always be exactly one Owner, and
  // it can't be created, promoted to, or modified through the Users page.
  const isOwner = user.role === "owner";

  const handleRoleChange = async (role: string | null) => {
    if (!role) return;
    try {
      await updateUser.mutateAsync({ role: role as UserRole });
      toast.success("Role updated");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update role";
      toast.error(message);
    }
  };

  const handleToggleActive = async () => {
    try {
      await updateUser.mutateAsync({ isActive: !user.isActive });
      toast.success(user.isActive ? "User deactivated" : "User reactivated");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update user";
      toast.error(message);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{user.fullName}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        {isOwner ? (
          <Badge variant="purple">owner</Badge>
        ) : (
          <Select value={user.role} onValueChange={handleRoleChange}>
            <SelectTrigger className={cn("w-28", ROLE_TRIGGER_CLASS[user.role])}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANAGEABLE_USER_ROLE_VALUES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={user.isActive ? "success" : "rose"}
          className={isOwner ? undefined : "cursor-pointer"}
          onClick={isOwner ? undefined : handleToggleActive}
        >
          {user.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</TableCell>
      <TableCell>{!isOwner && <UserEditDialog user={user} />}</TableCell>
    </TableRow>
  );
}

export default function UsersPage() {
  const { data: users, isLoading, error } = useUsers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <UserDialog />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading users...</p>}
      {error && <p className="text-destructive">Failed to load users.</p>}

      {users && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

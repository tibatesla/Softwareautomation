"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useUpdateUser } from "@/lib/queries/users";
import { ApiError } from "@/lib/api";
import { MANAGEABLE_USER_ROLE_VALUES } from "@/lib/types";
import type { User } from "@/lib/types";

const editFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  role: z.enum(["admin", "agent"]),
  password: z.union([z.string().min(8, "Password must be at least 8 characters"), z.literal("")]).optional(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

export function UserEditDialog({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const updateUser = useUpdateUser(user.id);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: { fullName: user.fullName, role: user.role === "owner" ? "admin" : user.role, password: "" },
  });

  const onSubmit = async (values: EditFormValues) => {
    try {
      await updateUser.mutateAsync({
        fullName: values.fullName,
        role: values.role,
        password: values.password || undefined,
      });
      toast.success("User updated");
      reset({ ...values, password: "" });
      setOpen(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update user";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="icon-sm" />}>
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.fullName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-fullName">Full name</Label>
            <Input id="edit-fullName" {...register("fullName")} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={Object.fromEntries(MANAGEABLE_USER_ROLE_VALUES.map((role) => [role, role]))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANAGEABLE_USER_ROLE_VALUES.map((role) => (
                      <SelectItem key={role} value={role} label={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-password">New password</Label>
            <PasswordInput id="edit-password" placeholder="Leave blank to keep unchanged" {...register("password")} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

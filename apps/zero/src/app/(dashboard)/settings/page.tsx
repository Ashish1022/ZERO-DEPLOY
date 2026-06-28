"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@zero-deploy/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@zero-deploy/ui/components/button";
import { Input } from "@zero-deploy/ui/components/input";
import { Label } from "@zero-deploy/ui/components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zero-deploy/ui/components/card";
import { Separator } from "@zero-deploy/ui/components/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@zero-deploy/ui/components/alert-dialog";

export default function AccountSettingsPage() {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: sessionData } = useQuery(trpc.auth.session.queryOptions());
  const user = sessionData?.user;

  // Profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const updateProfileMutation = useMutation(
    trpc.auth.updateProfile.mutationOptions({
      onSuccess() {
        toast.success("Profile updated");
        qc.invalidateQueries(trpc.auth.session.queryOptions());
        setFirstName("");
        setLastName("");
      },
      onError(err) { toast.error(err.message); },
    })
  );

  // Change password
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const pwMismatch = pwForm.confirm.length > 0 && pwForm.next !== pwForm.confirm;

  const changePasswordMutation = useMutation(
    trpc.auth.changePassword.mutationOptions({
      onSuccess() {
        toast.success("Password changed");
        setPwForm({ current: "", next: "", confirm: "" });
      },
      onError(err) { toast.error(err.message); },
    })
  );

  // Delete account
  const [deletePassword, setDeletePassword] = useState("");

  const deleteAccountMutation = useMutation(
    trpc.auth.deleteAccount.mutationOptions({
      onSuccess() {
        toast.success("Account deleted");
        router.push("/login");
      },
      onError(err) { toast.error(err.message); },
    })
  );

  return (
    <div className="flex flex-col flex-1">
      <div className="border-b border-border">
        <div className="max-w-2xl mx-auto w-full px-6 py-5">
          <h1 className="text-lg font-semibold tracking-tight">Account</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your profile and security settings.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-6 py-6 space-y-6 flex-1">

        {/* Profile */}
        <Card className="shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Update your display name.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateProfileMutation.mutate({ firstName: firstName || undefined, lastName: lastName || undefined });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    placeholder={user?.firstName ?? ""}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    placeholder={user?.lastName ?? ""}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={updateProfileMutation.isPending || (!firstName && !lastName)}
              >
                {updateProfileMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Change password</CardTitle>
            <CardDescription>Use a strong, unique password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pwForm.next !== pwForm.confirm) {
                  toast.error("Passwords do not match");
                  return;
                }
                changePasswordMutation.mutate({
                  currentPassword: pwForm.current,
                  newPassword: pwForm.next,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="current-pw">Current password</Label>
                <Input
                  id="current-pw"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={pwForm.current}
                  onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">New password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  placeholder="Min. 8 characters with a number"
                  required
                  value={pwForm.next}
                  onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw">Confirm new password</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  placeholder="Repeat new password"
                  required
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  className={pwMismatch ? "border-destructive" : ""}
                />
                {pwMismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
              </div>
              <Button type="submit" size="sm" disabled={changePasswordMutation.isPending || pwMismatch}>
                {changePasswordMutation.isPending ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Danger zone */}
        <Card className="shadow-none border-destructive/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deleting your account is permanent. All projects, deployments, and data will be removed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">Delete my account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All your projects and deployments will be permanently deleted. Enter your password to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-2">
                  <Input
                    type="password"
                    placeholder="Your current password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoFocus
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeletePassword("")}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={() => deleteAccountMutation.mutate({ password: deletePassword })}
                    disabled={!deletePassword || deleteAccountMutation.isPending}
                  >
                    {deleteAccountMutation.isPending ? "Deleting…" : "Delete account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Check, Loader2, Pencil, Shield, User } from "lucide-react";
import { ChangePasswordForm } from "./change-password-form";

export default function ProfilePage() {
  const { data: session, isPending } = authClient.useSession();
  const [hasCredentialAccount, setHasCredentialAccount] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Profile editing state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoadingAccounts(false);
      return;
    }
    setLoadingAccounts(true);
    authClient
      .listAccounts()
      .then((res) => {
        if (res.data) {
          setHasCredentialAccount(
            res.data.some(
              (a: { providerId: string }) => a.providerId === "credential"
            )
          );
        }
      })
      .catch((err) => {
      console.error("Failed to load accounts:", err);
    })
      .finally(() => setLoadingAccounts(false));
  }, [session?.user?.id]);

  const router = useRouter();

  if (isPending) {
    return (
      <div className="mesh-gradient min-h-full">
        <div className="space-y-8 pt-6 lg:pt-8">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center gap-4 pt-6">
                <Skeleton className="size-24 rounded-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
            <Card className="glass-card lg:col-span-2">
              <CardContent className="space-y-6 pt-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    router.push("/login");
    return null;
  }

  const { name, email, image, role, createdAt } = session.user;

  const formattedDate = createdAt
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(createdAt))
    : null;

  async function handleSaveName() {
    const trimmed = nameValue.trim();
    const currentName = session?.user?.name;
    if (!trimmed || trimmed === currentName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      const result = await authClient.updateUser({ name: trimmed });
      if (result.error) {
        setNameError("Failed to update name.");
      } else {
        setEditingName(false);
      }
    } catch {
      setNameError("An unexpected error occurred.");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="mesh-gradient min-h-full">
      <div className="space-y-8 pt-6 lg:pt-8">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {/* Left column — Avatar & Password */}
          <div className="space-y-6">
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center gap-4 pt-6">
                <Avatar className="size-24">
                  {image && <AvatarImage src={image} alt={name ?? ""} />}
                  <AvatarFallback className="text-2xl">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <p className="text-lg font-semibold">{name}</p>
                  <p className="text-sm text-muted-foreground">{email}</p>
                </div>
                {role && (
                  <Badge variant={role === "admin" ? "default" : "secondary"}>
                    {role}
                  </Badge>
                )}
              </CardContent>
            </Card>

            {loadingAccounts ? (
              <Card className="glass-card">
                <CardContent className="space-y-3 pt-6">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ) : (
              hasCredentialAccount && <ChangePasswordForm />
            )}
          </div>

          {/* Right column — Profile Information */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="size-4" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Name
                </label>
                {nameError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
                    {nameError}
                  </div>
                )}
                {editingName ? (
                  <div className="flex gap-2">
                    <Input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      disabled={savingName}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      disabled={savingName}
                    >
                      {savingName ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                    <span className="text-sm">{name}</span>
                    <button
                      type="button"
                      aria-label="Edit name"
                      onClick={() => {
                        setNameValue(name ?? "");
                        setEditingName(true);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                  <span className="text-sm">{email}</span>
                </div>
              </div>

              <Separator />

              {/* Role */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Role
                </label>
                <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                  <Shield className="size-3.5 text-muted-foreground" />
                  <span className="text-sm capitalize">{role}</span>
                </div>
              </div>

              <Separator />

              {/* Member since */}
              {formattedDate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Member since
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span className="text-sm">{formattedDate}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

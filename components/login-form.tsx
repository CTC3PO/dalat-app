"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to dalat.app</CardTitle>
          <CardDescription>
            Sign in to discover events in Da Lat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OAuthButtons />
        </CardContent>
      </Card>
    </div>
  );
}

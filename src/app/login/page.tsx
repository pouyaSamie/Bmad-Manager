import { Suspense } from "react";
import { LoginForm } from "./login-form";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Suspense>
        <LoginForm
          githubEnabled={
            !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET
          }
          registrationEnabled={process.env.ALLOW_REGISTRATION === "true"}
        />
      </Suspense>
    </main>
  );
}

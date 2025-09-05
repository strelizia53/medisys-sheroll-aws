"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";

type RequireGroupProps = {
  allow: readonly string[]; // e.g. ['ClinicUser'] or ['HealthcareTeam','Admin']
  redirectTo?: string; // default '/'
  children: React.ReactNode;
};

export default function RequireGroup({
  allow,
  redirectTo = "/",
  children,
}: RequireGroupProps) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  const checkAccess = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;
      if (!idToken) {
        setOk(false);
        router.replace(redirectTo);
        return;
      }

      const groups =
        (idToken.payload["cognito:groups"] as string[] | undefined) ?? [];

      const allowed = groups.some((g) => allow.includes(g));
      setOk(allowed);

      if (!allowed) {
        router.replace(redirectTo);
      }
    } catch {
      setOk(false);
      router.replace(redirectTo);
    }
  }, [allow, redirectTo, router]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  if (ok === null) {
    // 👇 Optional loading state while checking
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        Checking permissions…
      </div>
    );
  }

  return ok ? <>{children}</> : null;
}

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

  // ✅ Memoized function captures the right deps; effect depends on this
  const routeByGroup = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const authed = !!session.tokens?.idToken;
      const groups =
        (session.tokens?.idToken?.payload["cognito:groups"] as
          | string[]
          | undefined) ?? [];

      const allowed = authed && groups.some((g) => allow.includes(g));
      setOk(allowed);

      if (!allowed) {
        router.replace(redirectTo);
      }
    } catch {
      setOk(false);
      router.replace(redirectTo);
    }
  }, [allow, redirectTo, router]); // 👈 fixes "missing dependency: 'allow'"

  useEffect(() => {
    routeByGroup();
  }, [routeByGroup]); // 👈 no complex expression in deps

  if (ok === null) return null; // or a spinner
  return <>{children}</>;
}

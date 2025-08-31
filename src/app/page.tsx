"use client";

import React, { useEffect, useState } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { useRouter } from "next/navigation";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";

// Small helper that redirects based on Cognito group membership
function RoleRedirect() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const session = await fetchAuthSession(); // tokens + payloads
        const groups =
          (session.tokens?.idToken?.payload["cognito:groups"] as
            | string[]
            | undefined) ?? [];

        if (!mounted || groups.length === 0) return;

        if (groups.includes("ClinicUser")) router.replace("/upload");
        else if (groups.includes("HealthcareTeam")) router.replace("/reports");
        else if (groups.includes("Admin")) router.replace("/admin");
      } catch {
        // no active session yet → Authenticator will show sign-in
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return null;
}

function UserEmail() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const attrs = await fetchUserAttributes();
        setEmail(attrs.email ?? null);
      } catch {
        setEmail(null);
      }
    })();
  }, []);

  return <p>Email: {email ?? "—"}</p>;
}

export default function Home() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ padding: "2rem" }}>
          <RoleRedirect />
          <h1>Welcome {user?.username}</h1>
          <UserEmail />
          <button onClick={() => signOut?.()}>Sign out</button>
        </main>
      )}
    </Authenticator>
  );
}

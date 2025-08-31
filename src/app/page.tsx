"use client";

import { Authenticator, SelectField } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

function RoleRedirect() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const routeByGroup = async () => {
      try {
        const session = await fetchAuthSession();
        const groups =
          (session.tokens?.idToken?.payload["cognito:groups"] as
            | string[]
            | undefined) ?? [];
        if (!mounted || groups.length === 0) return;

        if (groups.includes("ClinicUser")) router.replace("/upload");
        else if (groups.includes("HealthcareTeam")) router.replace("/reports");
        else if (groups.includes("Admin")) router.replace("/admin");
      } catch {
        /* not signed in yet */
      }
    };

    // run on load
    routeByGroup();

    // run after sign-in / token refresh / sign-out
    const unlisten = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedIn" || payload.event === "tokenRefresh") {
        routeByGroup();
      }
      if (payload.event === "signedOut") {
        router.replace("/");
      }
    });

    return () => {
      mounted = false;
      unlisten();
    };
  }, [router]);

  return null;
}

export default function Home() {
  return (
    <div className="auth-wrap">
      <Authenticator
        components={{
          Header() {
            return (
              <div style={{ padding: "12px 16px 0" }}>
                <h3 style={{ margin: 0 }}>Welcome to MediSys</h3>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
                  Please sign in or create an account
                </p>
              </div>
            );
          },
          SignUp: {
            FormFields() {
              return (
                <>
                  <Authenticator.SignUp.FormFields />
                  <SelectField
                    label="User Type"
                    name="custom:userType"
                    descriptiveText="Choose your role"
                    isRequired
                  >
                    <option value="ClinicUser">Clinic</option>
                    <option value="HealthcareTeam">Healthcare Team</option>
                  </SelectField>
                </>
              );
            },
          },
          Footer() {
            return (
              <div
                style={{
                  padding: 12,
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: 12,
                }}
              >
                © {new Date().getFullYear()} MediSys
              </div>
            );
          },
        }}
      >
        {({ signOut, user }) => (
          <main style={{ padding: 24 }}>
            <RoleRedirect />
            <h1 style={{ marginBottom: 8 }}>Welcome {user?.username}</h1>
            <button onClick={() => signOut?.()}>Sign out</button>
          </main>
        )}
      </Authenticator>
    </div>
  );
}

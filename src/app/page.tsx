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

    // Run on mount
    routeByGroup();

    // 🔹 Listen only for sign-in events here
    const unlisten = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedIn" || payload.event === "tokenRefresh") {
        routeByGroup();
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
        formFields={{
          signIn: {
            username: {
              label: "Email",
              placeholder: "Enter your email",
              type: "email",
            },
          },
          signUp: {
            username: {
              label: "Email",
              placeholder: "Enter your email",
              type: "email",
            },
          },
        }}
        components={{
          Header() {
            return (
              <div className="mb-4 text-center">
                <h3 className="text-lg font-semibold">Welcome to MediSys</h3>
                <p className="text-sm text-slate-400">
                  Please sign in or create an account
                </p>
              </div>
            );
          },
          SignUp: {
            FormFields() {
              return (
                <>
                  {/* Default fields (with Email override from formFields) */}
                  <Authenticator.SignUp.FormFields />
                  {/* Extra field for role selection */}
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
              <div className="pt-4 text-center text-xs text-slate-500">
                © {new Date().getFullYear()} MediSys
              </div>
            );
          },
        }}
      >
        {({ signOut, user }) => (
          <main className="page-shell space-y-4">
            <RoleRedirect />
            <h1 className="text-2xl font-semibold">Welcome {user?.username}</h1>
            <button
              className="self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              onClick={() => signOut?.()}
            >
              Sign out
            </button>
          </main>
        )}
      </Authenticator>
    </div>
  );
}

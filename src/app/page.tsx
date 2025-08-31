"use client";

import { Authenticator, SelectField } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";

function RoleRedirect() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
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
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  return null;
}

export default function Home() {
  return (
    <Authenticator
      components={{
        SignUp: {
          FormFields() {
            return (
              <>
                {/* default fields (username/email/password/confirm) */}
                <Authenticator.SignUp.FormFields />

                {/* custom attribute mapped to your pool's custom:userType */}
                <SelectField
                  label="User Type"
                  name="custom:userType"
                  descriptiveText="Choose your role"
                  isRequired
                >
                  <option value="ClinicUser">Clinic</option>
                  <option value="HealthcareTeam">Healthcare Team</option>
                  {/* add Admin here only if you want users to self-select it */}
                </SelectField>
              </>
            );
          },
        },
      }}
    >
      {({ signOut, user }) => (
        <main style={{ padding: 24 }}>
          <RoleRedirect />
          <h1>Welcome {user?.username}</h1>
          <button onClick={() => signOut?.()}>Sign out</button>
        </main>
      )}
    </Authenticator>
  );
}

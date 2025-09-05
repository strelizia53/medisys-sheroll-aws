"use client";

import { Authenticator } from "@aws-amplify/ui-react";
import { Hub } from "aws-amplify/utils";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    // 🔹 Listen for auth events globally
    const unlisten = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedOut") {
        router.replace("/"); // ✅ Always redirect to root on logout
      }
    });

    return () => {
      unlisten();
    };
  }, [router]);

  return <Authenticator.Provider>{children}</Authenticator.Provider>;
}

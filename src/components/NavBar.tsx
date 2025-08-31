"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";

export default function NavBar() {
  const router = useRouter();

  // Re-render on auth changes (Amplify listens to Hub under the hood)
  const { authStatus, user, signOut } = useAuthenticator((ctx) => [
    ctx.authStatus,
    ctx.user,
  ]);

  const isAuthed = authStatus === "authenticated";
  const username =
    (user?.username as string | undefined) ??
    (user?.signInDetails?.loginId as string | undefined) ??
    null;

  const handleLogout = async () => {
    try {
      await signOut(); // Amplify v6 signOut
    } finally {
      router.replace("/");
    }
  };

  // Optional: avoid brief flicker while Amplify initializes
  if (authStatus === "configuring") return null;

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 2rem",
        borderBottom: "1px solid #e5e7eb",
        background: "linear-gradient(90deg, #f8fafc 0%, #e0e7ff 100%)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <Link
        href="/"
        style={{
          textDecoration: "none",
          color: "#3730a3",
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 1,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          style={{ marginRight: 6 }}
        >
          <rect width="24" height="24" rx="6" fill="#6366f1" />
          <path
            d="M12 7v10M7 12h10"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        MediSys
      </Link>

      <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
        {isAuthed ? (
          <>
            <span
              style={{
                fontSize: 15,
                color: "#6366f1",
                background: "#eef2ff",
                padding: "0.3rem 0.8rem",
                borderRadius: 20,
                fontWeight: 500,
                letterSpacing: 0.2,
              }}
            >
              {username ? `Hi, ${username}` : "Signed in"}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: "0.45rem 1.1rem",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(99,102,241,0.08)",
                transition: "background 0.2s",
              }}
              onMouseOver={(e) =>
                ((e.target as HTMLButtonElement).style.background =
                  "linear-gradient(90deg, #818cf8 0%, #6366f1 100%)")
              }
              onMouseOut={(e) =>
                ((e.target as HTMLButtonElement).style.background =
                  "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)")
              }
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/"
            style={{
              padding: "0.45rem 1.1rem",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
              boxShadow: "0 1px 4px rgba(99,102,241,0.08)",
              transition: "background 0.2s",
              display: "inline-block",
            }}
            onMouseOver={(e) =>
              ((e.target as HTMLAnchorElement).style.background =
                "linear-gradient(90deg, #818cf8 0%, #6366f1 100%)")
            }
            onMouseOut={(e) =>
              ((e.target as HTMLAnchorElement).style.background =
                "linear-gradient(90deg, #6366f1 0%, #818cf8 100%)")
            }
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

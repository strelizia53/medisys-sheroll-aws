"use client";
import RequireGroup from "@/components/RequireGroup";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();

  const handleLogout = () => {
    // Clear auth tokens or session here if needed
    router.push("/logout"); // Or your actual logout route
  };

  return (
    <RequireGroup allow={["ClinicUser"]}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Clinic Upload Dashboard</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>
      {/* upload UI goes here */}
    </RequireGroup>
  );
}

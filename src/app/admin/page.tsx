"use client";
import RequireGroup from "@/components/RequireGroup";

export default function AdminPage() {
  return (
    <RequireGroup allow={["Admin"]}>
      <h2>Admin Console</h2>
      {/* admin UI */}
    </RequireGroup>
  );
}

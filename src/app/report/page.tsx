"use client";
import RequireGroup from "@/components/RequireGroup";

export default function ReportsPage() {
  return (
    <RequireGroup allow={["HealthcareTeam", "Admin"]}>
      <h2>Healthcare Team Reports</h2>
      {/* reports UI */}
    </RequireGroup>
  );
}

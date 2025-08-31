import "./globals.css";
import type { Metadata } from "next";
import ConfigureAmplifyClientSide from "../components/ConfigureAmplifyClientSide";

// (optional) SEO
export const metadata: Metadata = {
  title: "MediSys",
  description: "Diagnostic report portal",
};

// ✅ Add a proper type for children (fixes “implicitly has any type”)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ConfigureAmplifyClientSide />
        {children}
      </body>
    </html>
  );
}

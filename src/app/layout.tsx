import "./globals.css";
import type { Metadata } from "next";
import ConfigureAmplifyClientSide from "../components/ConfigureAmplifyClientSide";
import AmplifyThemeProvider from "../components/AmplifyThemeProvider";
import NavBar from "../components/NavBar";

export const metadata: Metadata = {
  title: "MediSys",
  description: "Diagnostic report portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ConfigureAmplifyClientSide />
        <AmplifyThemeProvider>
          <NavBar />
          <div className="page-shell">{children}</div>
        </AmplifyThemeProvider>
      </body>
    </html>
  );
}

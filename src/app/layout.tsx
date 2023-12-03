import type { Metadata } from "next";
import "./globals.css";
import { Roboto } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "StrafeChat",
  description: "A chatting application",
};

const roboto = Roboto({
  weight: "400",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={roboto.className}>
      <body>
        <AuthProvider>
          <div id="app-root">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}

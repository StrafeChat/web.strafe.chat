import type { Metadata } from "next";
import "./globals.scss";
import { Roboto } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Layout from "@/components/Layout";

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
          <div id="app-root">
            <Layout>
              <>{children}</>
            </Layout>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

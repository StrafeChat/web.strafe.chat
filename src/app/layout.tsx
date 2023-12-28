import AppLayout from '@/components/app/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import UIProvider from '@/providers/UIProvider';
import type { Metadata } from 'next';
import './globals.css';
import "./shadcn.css";

export const metadata: Metadata = {
  title: 'Strafe',
  description: 'A chatting application.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="en">
      <head></head>
      <body>
        <UIProvider>
          <AppLayout>{children}</AppLayout>
        </UIProvider>
        <Toaster />
      </body>
    </html>
  )
}

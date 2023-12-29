import AppLayout from '@/components/app/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import UIProvider from '@/providers/UIProvider';
import type { Metadata } from 'next';
import './globals.css';
import "./shadcn.css";
import ModalController from '@/controllers/modals/ModalController';

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
        <ModalController>
          <UIProvider>
            <AppLayout>{children}</AppLayout>
          </UIProvider>
        </ModalController>
        <Toaster />
      </body>
    </html>
  )
}

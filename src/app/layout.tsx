import AppLayout from '@/components/app/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import UIProvider, { useUI } from '@/providers/UIProvider';
import type { Metadata } from 'next';
import './globals.css';
import "./shadcn.css";
import ModalController from '@/controllers/modals/ModalController';
import ClientController from '@/controllers/client/ClientController';

export const metadata: Metadata = {
  title: 'Strafe Chat',
  description: 'Make your censorship worries go down the drain with Straf Chat',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="en">
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

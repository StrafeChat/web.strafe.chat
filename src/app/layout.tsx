"use client";
import AppLayout from '@/components/app/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import ClientController from '@/controllers/client/ClientController';
import ModalController from '@/controllers/modals/ModalController';
import UIProvider from '@/providers/UIProvider';
import '../styles/globals.css';
import "../styles/shadcn.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="en">
      <head>
        <title>Strafe Chat</title>
        <meta name='description' content='Make your censorship worries go down the drain with Straf Chat' />
      </head>
      <body>
        <ClientController>
          <ModalController>
            <UIProvider>
              <AppLayout>{children}</AppLayout>
            </UIProvider>
          </ModalController>
        </ClientController>
        <Toaster />
      </body>
    </html>
  )
}
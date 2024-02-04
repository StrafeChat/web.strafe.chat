"use client";
import { AppLayout } from '@/components/shared';
import { Toaster } from '@/components/ui/toaster';
import ClientController from '@/controllers/client/ClientController';
import ModalController from '@/controllers/modals/ModalController';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
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
        <I18nextProvider i18n={i18n}>
          <ClientController>
            <ModalController>
              <UIProvider>
                <AppLayout>{children}</AppLayout>
              </UIProvider>
            </ModalController>
          </ClientController>
        </I18nextProvider>
        <Toaster />
      </body>
    </html>
  )
}
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import "./shadcn.css";
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
        <>{children}</>
        <Toaster />
      </body>
    </html>
  )
}

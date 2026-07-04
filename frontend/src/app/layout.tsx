import type { Metadata } from 'next'
import { Nunito, Spectral } from 'next/font/google'
import './globals.css'
import { SmoothScrollProvider } from '@/components/SmoothScrollProvider'
import { LanguageProvider } from '@/lib/i18n'
import { Providers } from './providers'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
})

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-spectral',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EduNexus',
  description: 'Plateforme de gestion scolaire multi-établissement',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EduNexus',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${nunito.variable} ${spectral.variable}`} suppressHydrationWarning>
      <body className="font-nunito antialiased">
        <Providers><LanguageProvider><SmoothScrollProvider>{children}</SmoothScrollProvider></LanguageProvider></Providers>
      </body>
    </html>
  )
}

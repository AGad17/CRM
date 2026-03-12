import './globals.css'
import { Providers } from './providers'
import { Mulish, Plus_Jakarta_Sans } from 'next/font/google'

const mulish = Mulish({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-mulish',
  display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata = {
  title: 'ShopBrain CRM',
  description: 'Revenue & KPI Management System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${mulish.variable} ${plusJakarta.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

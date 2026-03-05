import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'ShopBrain CRM',
  description: 'Revenue & KPI Management System',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

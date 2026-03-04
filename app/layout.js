export const metadata = {
  title: 'Gadagido CRM',
  description: 'CRM Application',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

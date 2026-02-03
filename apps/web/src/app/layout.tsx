import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '../components/theme-provider'
import { VConsole } from './components/VConsole'
import { ErrorBoundary } from './components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'MiniChat - Video Chat Platform',
  description: 'Real-time video chat platform with WebRTC',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <VConsole />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}

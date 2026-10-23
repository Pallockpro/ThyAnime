import './globals.css'
import AuthProvider from '../components/AuthProvider'
import AppShell from '../components/AppShell'
import { THEME_BOOT } from '../lib/theme'

export const metadata = {
  title: 'ThyAnime — watch anime online',
  description: 'Search and stream anime. Powered by AniList with Kitsu, YumeList and Jikan (MyAnimeList) backups.',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👑</text></svg>" },
}
export const viewport = { themeColor: '#060e1a' } // Slime theme; lib/theme.js swaps it for the OG theme

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="slime" suppressHydrationWarning>
      <body className="min-h-screen bg-ink text-zinc-100 antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <div className="aurora" aria-hidden />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}

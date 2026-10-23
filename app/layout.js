import './globals.css'
import AuthProvider from '../components/AuthProvider'
import AppShell from '../components/AppShell'
import { THEME_BOOT } from '../lib/theme'
import { FAVICONS } from '../lib/logo-data'

export const metadata = {
  title: 'ThyAnime — watch anime online',
  description: 'Search and stream anime. Powered by AniList with Kitsu, YumeList and Jikan (MyAnimeList) backups.',
  // tab icon = the ThyAnime logo (Slime colours; lib/theme.js swaps it for the OG theme). The iPhone home-screen icon is app/apple-icon.png.
  icons: { icon: [{ url: FAVICONS.slime.svg, type: 'image/svg+xml' }, { url: FAVICONS.slime.png, type: 'image/png', sizes: '64x64' }] },
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

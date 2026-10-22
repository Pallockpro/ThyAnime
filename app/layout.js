import './globals.css'
import Navbar from '../components/Navbar'
import Petals from '../components/Petals'
import Footer from '../components/Footer'

export const metadata = {
  title: 'ThyAnime — watch anime online',
  description: 'Search and stream anime. Powered by AniList with Kitsu, YumeList and Jikan (MyAnimeList) backups.',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👑</text></svg>" },
}
export const viewport = { themeColor: '#0b0710' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-zinc-100 antialiased">
        <div className="aurora" aria-hidden />
        <Petals />
        <Navbar />
        <main className="relative z-10 min-h-[70vh]">{children}</main>
        <Footer />
      </body>
    </html>
  )
}

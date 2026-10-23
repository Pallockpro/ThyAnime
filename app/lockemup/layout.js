// Hidden meme page — not linked anywhere on the site and kept out of search engines.
export const metadata = {
  title: 'lock em up',
  robots: { index: false, follow: false },
}
export default function Layout({ children }) { return children }

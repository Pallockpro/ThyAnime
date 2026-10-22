import { API } from '../lib/api'

export default function Footer() {
  return (
    <footer className="relative z-10 mt-20 border-t border-white/5 py-10 text-center text-sm text-zinc-500">
      <p className="text-grad text-base font-semibold">ThyAnime</p>
      <p className="mt-2">Metadata from AniList · backups Kitsu, YumeList &amp; MyAnimeList</p>
      <p className="mt-3 space-x-4">
        <a className="hover:text-blossom-400 transition-colors" href={API + "/docs"}>API docs</a>
        <a className="hover:text-blossom-400 transition-colors" href={API + "/downloads"}>Library</a>
        <a className="hover:text-blossom-400 transition-colors" href={API + "/status"}>Status</a>
      </p>
    </footer>
  )
}

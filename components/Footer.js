export default function Footer() {
  return (
    <footer className="relative z-10 mt-20 border-t border-white/5 py-10 text-center text-sm text-zinc-500">
      <p className="text-grad text-base font-semibold">ThyAnime</p>
      <p className="mt-2">Metadata from AniList · backups Kitsu, YumeList &amp; Jikan (MyAnimeList)</p>
      <p className="mt-1 text-xs text-zinc-600">ThyAnime hosts no video files. Players are provided by third-party servers.</p>
      <p className="mt-3 space-x-4">
        <a className="hover:text-blossom-400 transition-colors" href="https://anilist.co" target="_blank" rel="noreferrer">AniList</a>
        <a className="hover:text-blossom-400 transition-colors" href="https://kitsu.app" target="_blank" rel="noreferrer">Kitsu</a>
        <a className="hover:text-blossom-400 transition-colors" href="https://jikan.moe" target="_blank" rel="noreferrer">Jikan</a>
      </p>
    </footer>
  )
}

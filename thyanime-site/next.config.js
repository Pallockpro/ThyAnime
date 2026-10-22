/** Static export → ./out (upload anywhere). Set NEXT_PUBLIC_BASE_PATH=/repo-name for GitHub Pages project sites. */
module.exports = {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
}

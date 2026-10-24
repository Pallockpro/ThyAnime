'use client'
import { avatarOf } from '../lib/profiles'

/** Round/rounded avatar: an emoji on a colour (profiles) or the Google photo (plain accounts). */
export default function Avatar({ avatar, photo, name = '', size = 40, rounded = 'rounded-full', className = '' }) {
  const noAvatar = avatar === null || avatar === undefined || avatar === ''
  if (photo && noAvatar) {
    return <img src={photo} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size }} className={'shrink-0 object-cover ' + rounded + ' ' + className} />
  }
  if (noAvatar) {
    return (
      <span style={{ width: size, height: size, fontSize: size * 0.45 }} className={'flex shrink-0 items-center justify-center bg-blossom-500 font-bold text-white ' + rounded + ' ' + className}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </span>
    )
  }
  const [emoji, color] = avatarOf(avatar)
  return (
    <span aria-hidden style={{ width: size, height: size, fontSize: size * 0.52, backgroundColor: color }}
      className={'flex shrink-0 items-center justify-center bg-gradient-to-br from-white/30 to-black/20 leading-none ' + rounded + ' ' + className}>
      {emoji}
    </span>
  )
}

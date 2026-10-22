'use client'
import { Wrench } from 'lucide-react'
import Navbar from './Navbar'
import Petals from './Petals'
import Footer from './Footer'
import Maintenance from './Maintenance'
import { useAuth } from './AuthProvider'

function Splash() {
  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center">
      <span className="h-9 w-9 animate-spin rounded-full border-4 border-blossom-500 border-t-transparent" />
    </div>
  )
}

export default function AppShell({ children }) {
  const { maintenance, maintenanceReady, authReady, isAdmin } = useAuth()

  // Wait (max ~1.5 s, usually instant thanks to the cache) so visitors never see the site flash before the maintenance page.
  if (!maintenanceReady) return <Splash />
  if (maintenance.enabled && !authReady) return <Splash />
  if (maintenance.enabled && !isAdmin) return (<><Petals /><Maintenance /></>)

  return (
    <>
      <Petals />
      <Navbar />
      <main className="relative z-10 min-h-[70vh]">{children}</main>
      <Footer />
      {maintenance.enabled ? (
        <div className="glass fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-amber-300 shadow-xl">
          <Wrench size={13} /> Maintenance mode is ON — only admins can see the site
        </div>
      ) : null}
    </>
  )
}

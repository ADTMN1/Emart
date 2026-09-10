import * as React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

const ChatWidget = React.lazy(() => import('@/components/ai/ChatWidget'))

const Layout: React.FC = () => {
  const location = useLocation()
  const [chatReady, setChatReady] = React.useState(false)

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  React.useEffect(() => {
    const scheduleChat = () => {
      if ('requestIdleCallback' in window) {
        const idleWindow = window as typeof window & {
          requestIdleCallback?: (cb: IdleRequestCallback) => number
        }

        idleWindow.requestIdleCallback?.(() => setChatReady(true))
        return
      }

      const timer = setTimeout(() => setChatReady(true), 350)
      return () => clearTimeout(timer)
    }

    scheduleChat()
  }, [])

  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/register'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!isAuthPage && <TopBar />}
      {!isAuthPage && <Navbar />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
      {!isAuthPage && chatReady && (
        <React.Suspense fallback={null}>
          <ChatWidget />
        </React.Suspense>
      )}
    </div>
  )
}

export default Layout

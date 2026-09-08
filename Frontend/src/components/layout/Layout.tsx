import * as React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { ToastProvider } from '@/components/ui/Toast'
import ChatWidget from '@/components/ai/ChatWidget'

const Layout: React.FC = () => {
  const location = useLocation()

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/register'

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-background">
        {!isAuthPage && <TopBar />}
        {!isAuthPage && <Navbar />}
        <main className="flex-1">
          <Outlet />
        </main>
        {!isAuthPage && <Footer />}
        {!isAuthPage && <ChatWidget />}
      </div>
    </ToastProvider>
  )
}

export default Layout

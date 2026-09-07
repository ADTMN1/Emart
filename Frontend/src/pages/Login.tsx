import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Globe2,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [show, setShow] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    toast({ variant: 'success', title: 'Signed in successfully', description: 'Welcome back to EMART!' })
    setTimeout(() => navigate('/'), 500)
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary to-primary-800">
        <div className="absolute inset-0 bg-hero-pattern opacity-10" />
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl" />

        <div className="relative p-10 xl:p-16 text-white flex flex-col justify-between w-full">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white text-primary shadow-lg">
              <span className="font-display font-extrabold text-xl">E</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-xl font-extrabold tracking-tight">EMART</span>
              <span className="text-[10px] font-semibold text-primary-200 tracking-widest uppercase">Global Proxy Shopping</span>
            </div>
          </Link>

          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-secondary" />
                <span className="text-xs font-bold text-white">TRUSTED BY 250K+ SHOPPERS</span>
              </div>
              <h1 className="font-display text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight text-balance">
                Start shopping the best of global markets today.
              </h1>
            </div>

            <ul className="space-y-3.5">
              {[
                'Millions of authentic products',
                'Free 45-day warehouse storage',
                '100% Buyer Protection guarantee',
                'Ship to 180+ countries worldwide',
              ].map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-primary-100/90">{s}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-6 pt-4 text-primary-200">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldCheck className="h-4 w-4 text-secondary" />
                SSL Secured
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Globe2 className="h-4 w-4 text-secondary" />
                Global Support
              </div>
            </div>
          </div>

          <p className="text-xs text-primary-300/80">
            © {new Date().getFullYear()} EMART Co., Ltd. All rights reserved.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 xl:p-16">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary text-white">
              <span className="font-display font-extrabold text-lg">E</span>
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight">EMART</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to your EMART account to continue shopping and track your orders.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-7">
            <button className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-border hover:bg-muted transition-all hover:border-border/80 hover:shadow-sm font-semibold text-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              <span className="hidden sm:inline">Google</span>
            </button>
            <button className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-border hover:bg-muted transition-all hover:border-border/80 hover:shadow-sm font-semibold text-sm sm:px-4">
              <span>🅿️</span>
              <span className="hidden sm:inline">PayPal</span>
            </button>
            <button className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-border hover:bg-muted transition-all hover:border-border/80 hover:shadow-sm font-semibold text-sm sm:px-4">
              <span>🍎</span>
              <span className="hidden sm:inline">Apple</span>
            </button>
          </div>

          <div className="flex items-center gap-3 mb-7">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Or with email
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Email Address
              </label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="you@email.com"
                  leftIcon={<Mail className="h-4 w-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="!h-12 transition-all focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Password
                </label>
                <a href="#forgot" className="text-xs font-bold text-primary hover:underline transition-colors">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Input
                  type={show ? 'text' : 'password'}
                  placeholder="Enter your password"
                  leftIcon={<Lock className="h-4 w-4" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="!h-12 transition-all focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer pt-1 group">
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0" />
              <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">Remember me on this device</span>
            </label>

            <Button size="xl" className="w-full shadow-lg shadow-primary/25 mt-6 group-hover:shadow-primary/30 transition-all">
              <span className="relative">
                Sign In
                <ArrowRight className="h-4 w-4 ml-1.5 inline-block group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </form>

          <div className="mt-8 p-5 rounded-xl bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100 text-xs">
            <span className="font-semibold text-foreground">New to EMART?</span>{' '}
            <Link to="/register" className="text-primary font-bold hover:underline transition-colors">
              Create a free account →
            </Link>
          </div>

          <p className="mt-6 text-[11px] text-center text-muted-foreground leading-relaxed">
            By signing in, you agree to our <a href="#terms" className="text-primary hover:underline">Terms</a> &{' '}
            <a href="#privacy" className="text-primary hover:underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login

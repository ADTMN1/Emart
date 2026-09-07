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
  User,
  Gift,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'

const Register: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [show, setShow] = React.useState(false)
  const [firstName, setFirstName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    toast({ variant: 'success', title: 'Account created!', description: 'Welcome to EMART. Start exploring global markets.' })
    setTimeout(() => navigate('/'), 600)
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-secondary" />
              <span className="text-xs font-bold text-white">GET $10 OFF YOUR FIRST ORDER</span>
            </div>
            <h1 className="font-display text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight text-balance">
              Create your account & start exploring global markets.
            </h1>

            <ul className="space-y-3.5">
              {[
                'Free to join, no monthly fees',
                '$10 welcome credit',
                'Transparent pricing always',
                '24/7 multi-language support',
              ].map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-success/15 text-success flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-primary-100/90">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-primary-300/80">
            © {new Date().getFullYear()} EMART Co., Ltd. All rights reserved.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 xl:p-16">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary text-white">
              <span className="font-display font-extrabold text-lg">E</span>
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight">EMART</span>
          </Link>

          <div className="mb-8">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Create account</h1>
            <p className="mt-2 text-muted-foreground">
              Join 250,000+ shoppers enjoying authentic products from global marketplaces.
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">First Name</label>
                <Input type="text" placeholder="John" leftIcon={<User className="h-4 w-4" />} value={firstName} onChange={(e) => setFirstName(e.target.value)} className="!h-12 transition-all focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Last Name</label>
                <Input type="text" placeholder="Doe" leftIcon={<User className="h-4 w-4" />} className="!h-12 transition-all focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Email Address</label>
              <Input type="email" placeholder="you@email.com" leftIcon={<Mail className="h-4 w-4" />} value={email} onChange={(e) => setEmail(e.target.value)} className="!h-12 transition-all focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Country</label>
              <Select className="!h-12 transition-all focus:ring-2 focus:ring-primary/20">
                <option>🇺🇸 United States</option>
                <option>🇬🇧 United Kingdom</option>
                <option>🇨🇦 Canada</option>
                <option>🇦🇺 Australia</option>
                <option>🇩🇪 Germany</option>
                <option>🇫🇷 France</option>
                <option>🇸🇬 Singapore</option>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Password</label>
                <span className="text-[10px] text-muted-foreground">Min 8 characters</span>
              </div>
              <div className="relative">
                <Input type={show ? 'text' : 'password'} placeholder="Create a strong password" leftIcon={<Lock className="h-4 w-4" />} value={password} onChange={(e) => setPassword(e.target.value)} className="!h-12 transition-all focus:ring-2 focus:ring-primary/20" />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2.5 flex gap-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= 3 ? 'bg-success' : 'bg-border'}`} />
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-success font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                Good password strength
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer pt-1 group">
              <input type="checkbox" className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 mt-0.5" />
              <span className="text-xs text-foreground/80 leading-relaxed group-hover:text-foreground transition-colors">
                I agree to the <a href="#terms" className="text-primary font-medium hover:underline transition-colors">Terms of Service</a> &{' '}
                <a href="#privacy" className="text-primary font-medium hover:underline transition-colors">Privacy Policy</a>. I want to receive occasional shopping deals emails.
              </span>
            </label>

            <Button size="xl" className="w-full shadow-lg shadow-primary/25 mt-6 group-hover:shadow-primary/30 transition-all">
              <span className="relative">
                Create Account
                <ArrowRight className="h-4 w-4 ml-1.5 inline-block group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </form>

          <div className="mt-8 p-5 rounded-xl bg-gradient-to-r from-primary-50 to-secondary-50 border border-primary-100 text-xs">
            <span className="font-semibold text-foreground">Already have an account?</span>{' '}
            <Link to="/login" className="text-primary font-bold hover:underline transition-colors">
              Sign in instead →
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              SSL Secured
            </div>
            <div className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Globe2 className="h-3.5 w-3.5 text-primary" />
              Private & Safe
            </div>
            <div className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Spam Free
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register

import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Truck,
  ShieldCheck,
  Warehouse,
  Globe2,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const footerSections = [
  {
    title: 'Shop',
    links: [
      { label: 'All Products', to: '/marketplace' },
      { label: 'Browse Categories', to: '/categories' },
      { label: 'Shop Global', to: '/marketplace?source=mercari' },
      { label: 'New Arrivals', to: '/marketplace?sort=new' },
      { label: 'Best Sellers', to: '/marketplace?sort=popular' },
    ],
  },
  {
    title: 'Services',
    links: [
      { label: 'How Proxy Shopping Works', to: '#how' },
      { label: 'International Shipping', to: '#shipping' },
      { label: 'Warehouse Storage', to: '/warehouse' },
      { label: 'Buyer Protection', to: '#trust' },
      { label: 'Item Consolidation', to: '#shipping' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', to: '#help' },
      { label: 'Track Your Order', to: '/orders' },
      { label: 'Track Shipment', to: '/shipping' },
      { label: 'Contact Us', to: '#contact' },
      { label: 'FAQ', to: '#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About EMART', to: '#about' },
      { label: 'Fees & Pricing', to: '#fees' },
      { label: 'Shipping Rates', to: '#rates' },
      { label: 'Terms of Service', to: '#terms' },
      { label: 'Privacy Policy', to: '#privacy' },
    ],
  },
]


export const Footer: React.FC = () => {
  const [email, setEmail] = React.useState('')

  return (
    <footer className="bg-primary-900 text-primary-100 mt-20">
      <div className="bg-primary-800 border-b border-white/5">
        <div className="container-page py-8 lg:py-12 grid lg:grid-cols-2 gap-8 items-center">
          <div className="max-w-xl">
            <h3 className="font-display text-2xl font-bold text-white mb-2">
              Get exclusive deals
            </h3>
            <p className="text-primary-200 text-sm leading-relaxed">
              Subscribe to our newsletter for weekly curated finds, exclusive discounts, and insider shopping tips from global marketplaces.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg lg:ml-auto w-full">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="!h-12 !bg-white/95 !text-primary-900 !placeholder:text-primary-700/50 !border-white/10 focus:!ring-white/20 flex-1"
              wrapperClassName="flex-1"
            />
            <Button size="lg" variant="secondary" className="shrink-0">
              Subscribe
            </Button>
          </div>
        </div>
      </div>

      <div className="container-page py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-6">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white text-primary shadow-lg">
                <span className="font-display font-extrabold text-xl">E</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display text-xl font-extrabold tracking-tight text-white">
                  EMART
                </span>
                <span className="text-[10px] font-semibold text-primary-300 tracking-widest uppercase">
                  Global Proxy Shopping
                </span>
              </div>
            </Link>

            <p className="text-sm text-primary-200 leading-relaxed mb-6 max-w-sm">
              Your trusted partner for buying authentic products from global marketplaces. We handle everything from purchase to international delivery with complete transparency.
            </p>

            <div className="flex flex-col gap-3 text-sm text-primary-200">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-white/5">
                  <Mail className="h-4 w-4 text-secondary" />
                </div>
                support@emart.com
              </div>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-white/5">
                  <Phone className="h-4 w-4 text-secondary" />
                </div>
                +1 800-123-4567
              </div>
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-white/5 mt-0.5">
                  <MapPin className="h-4 w-4 text-secondary" />
                </div>
                <span>123 Market Street, San Francisco, CA, USA</span>
              </div>
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="font-bold text-white mb-4 text-sm tracking-wide uppercase">
                {section.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-primary-200 hover:text-white transition-colors inline-flex items-center gap-1 group"
                    >
                      <span className="w-0 group-hover:w-3 h-px bg-secondary transition-all duration-300" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>

      <div className="border-t border-white/10 bg-primary-950/50">
        <div className="container-page py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-primary-300">
          <div>
            © {new Date().getFullYear()} EMART Co., Ltd. All rights reserved. Made with care.
          </div>
          <div className="flex items-center gap-5">
            <a href="#terms" className="hover:text-white transition-colors">Terms</a>
            <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="#cookies" className="hover:text-white transition-colors">Cookies</a>
            <a href="#sitemap" className="hover:text-white transition-colors">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

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
import { useLanguage } from '@/contexts/LanguageContext'

export const Footer: React.FC = () => {
  const { t } = useLanguage()
  const [email, setEmail] = React.useState('')

  const footerSections = [
    {
      title: t('footer.shop'),
      links: [
        { label: t('footer.allProducts'), to: '/marketplace' },
        { label: t('footer.browseCategories'), to: '/categories' },
        { label: t('footer.shopGlobal'), to: '/marketplace' },
        { label: t('footer.newArrivals'), to: '/marketplace?sort=new' },
        { label: t('footer.bestSellers'), to: '/marketplace?sort=popular' },
      ],
    },
    {
      title: t('footer.services'),
      links: [
        { label: t('footer.howProxyWorks'), to: '#how' },
        { label: t('footer.internationalShipping'), to: '#shipping' },
        { label: t('footer.warehouseStorage'), to: '/warehouse' },
        { label: t('footer.buyerProtection'), to: '#trust' },
        { label: t('footer.itemConsolidation'), to: '#shipping' },
      ],
    },
    {
      title: t('footer.support'),
      links: [
        { label: t('footer.helpCenter'), to: '#help' },
        { label: t('footer.trackOrder'), to: '/orders' },
        { label: t('footer.trackShipment'), to: '/shipping' },
        { label: t('footer.contactUs'), to: '#contact' },
        { label: t('footer.faq'), to: '#faq' },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { label: t('footer.aboutEmart'), to: '#about' },
        { label: t('footer.feesPricing'), to: '#fees' },
        { label: t('footer.shippingRates'), to: '#rates' },
        { label: t('footer.termsOfService'), to: '#terms' },
        { label: t('footer.privacyPolicy'), to: '#privacy' },
      ],
    },
  ]

  return (
    <footer className="bg-primary-900 text-primary-100 mt-20">
      <div className="bg-primary-800 border-b border-white/5">
        <div className="container-page py-8 lg:py-12 grid lg:grid-cols-2 gap-8 items-center">
          <div className="max-w-xl">
            <h3 className="font-display text-2xl font-bold text-white mb-2">
              {t('footer.getExclusiveDeals')}
            </h3>
            <p className="text-primary-200 text-sm leading-relaxed">
              {t('footer.newsletterDesc')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg lg:ml-auto w-full">
            <Input
              type="email"
              placeholder={t('footer.enterEmail')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="!h-12 !bg-[#F5F8FC]/95 !text-primary-900 !placeholder:text-primary-700/50 !border-white/10 focus:!ring-white/20 flex-1"
              wrapperClassName="flex-1"
            />
            <Button size="lg" variant="secondary" className="shrink-0">
              {t('footer.subscribe')}
            </Button>
          </div>
        </div>
      </div>

      <div className="container-page py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-6">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#F5F8FC] text-primary shadow-lg">
                <span className="font-display font-extrabold text-xl">E</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display text-xl font-extrabold tracking-tight text-white">
                  EMART
                </span>
                <span className="text-[10px] font-semibold text-primary-300 tracking-widest uppercase">
                  {t('footer.globalProxyShopping')}
                </span>
              </div>
            </Link>

            <p className="text-sm text-primary-200 leading-relaxed mb-6 max-w-sm">
              {t('footer.companyDesc')}
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
            © {new Date().getFullYear()} EMART Co., Ltd. {t('footer.allRightsReserved')}
          </div>
          <div className="flex items-center gap-5">
            <a href="#terms" className="hover:text-white transition-colors">{t('footer.terms')}</a>
            <a href="#privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</a>
            <a href="#cookies" className="hover:text-white transition-colors">{t('footer.cookies')}</a>
            <a href="#sitemap" className="hover:text-white transition-colors">{t('footer.sitemap')}</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

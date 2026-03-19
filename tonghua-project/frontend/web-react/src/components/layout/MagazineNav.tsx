import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useUIStore } from '@/stores/uiStore';
import { useIsMobile } from '@/hooks/useMediaQuery';

const NAV_ITEMS = [
  { key: 'home', path: '/' },
  { key: 'about', path: '/about' },
  { key: 'campaigns', path: '/campaigns' },
  { key: 'stories', path: '/stories' },
  { key: 'donate', path: '/donate' },
  { key: 'shop', path: '/shop' },
  { key: 'traceability', path: '/traceability' },
  { key: 'contact', path: '/contact' },
];

export default function MagazineNav() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { mobileNavOpen, toggleMobileNav, setMobileNavOpen, currentLocale, setLocale } =
    useUIStore();

  const toggleLocale = () => {
    const next = currentLocale === 'en' ? 'zh' : 'en';
    setLocale(next);
    i18n.changeLanguage(next);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-paper/95 backdrop-blur-sm border-b border-warm-gray/30">
      {/* Grain overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-8" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\\'0 0 200 200\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cfilter id=\\'noiseFilter\\'%3E%3CfeTurbulence type=\\'fractalNoise\\' baseFrequency=\\'0.9\\' numOctaves=\\'4\\' stitchTiles=\\'stitch\\'/%3E%3C/filter%3E%3Crect width=\\'100%25\\' height=\\'100%25\\' filter=\\'url(%23noiseFilter)\\'/%3E%3C/svg%3E")'
      }} />

      <div className="relative max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <Link
          to="/"
          className="relative font-display text-ink text-xl md:text-2xl font-bold tracking-tight group"
          onClick={() => setMobileNavOpen(false)}
        >
          <span className="relative z-10">TONGHUA</span>
          <motion.span
            className="absolute inset-0 bg-rust/10 opacity-0 group-hover:opacity-100 transition-opacity"
            initial={false}
            whileHover={{ opacity: 1 }}
          />
        </Link>

        {/* Desktop Navigation - Magazine style numbered items */}
        {!isMobile && (
          <nav className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item, index) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={`
                    relative font-body text-[11px] tracking-wide px-4 py-2.5 transition-all duration-300 overflow-hidden
                    ${isActive ? 'text-rust' : 'text-ink-faded hover:text-ink'}
                  `}
                >
                  {/* Hover background */}
                  <motion.div
                    className="absolute inset-0 bg-rust/5 opacity-0"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />

                  {/* Content */}
                  <div className="relative z-10 flex items-center">
                    <span className="text-[9px] tracking-[0.2em] text-sepia-mid mr-2 font-mono">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="relative">
                      {t(`nav.${item.key}`)}
                      {isActive && (
                        <motion.span
                          layoutId="nav-indicator"
                          className="absolute -bottom-1 left-0 right-0 h-px bg-rust"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLocale}
            className="relative font-body text-[10px] tracking-[0.1em] uppercase text-ink-faded hover:text-ink transition-colors px-3 py-1.5 border border-warm-gray/40 rounded-sm cursor-pointer overflow-hidden group"
            aria-label="Toggle language"
          >
            <span className="relative z-10">{currentLocale === 'en' ? '中文' : 'EN'}</span>
            <motion.div
              className="absolute inset-0 bg-rust/10 opacity-0"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          </button>

          <Link
            to="/login"
            className="hidden md:inline-block relative font-body text-[11px] tracking-[0.05em] text-ink-faded hover:text-ink transition-colors px-4 py-2 border border-warm-gray/40 rounded-sm overflow-hidden group"
          >
            <span className="relative z-10">{t('nav.login')}</span>
            <motion.div
              className="absolute inset-0 bg-rust/10 opacity-0"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          </Link>

          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={toggleMobileNav}
              className="relative flex flex-col gap-1.5 p-3 cursor-pointer overflow-hidden rounded-sm border border-warm-gray/30"
              aria-label="Toggle menu"
              aria-expanded={mobileNavOpen}
            >
              <motion.div
                className="absolute inset-0 bg-rust/10 opacity-0"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                animate={mobileNavOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
                className="relative block w-5 h-px bg-ink"
              />
              <motion.span
                animate={mobileNavOpen ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="relative block w-5 h-px bg-ink"
              />
              <motion.span
                animate={mobileNavOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
                className="relative block w-5 h-px bg-ink"
              />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

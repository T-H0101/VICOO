import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/uiStore';
import { useRef, useEffect } from 'react';

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

export default function MobileNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const { mobileNavOpen, setMobileNavOpen, menuTriggerRef } = useUIStore();

  // ref for the dialog container
  const dialogRef = useRef<HTMLDivElement>(null);
  // ref for the first link to focus when opened
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (mobileNavOpen) {
      // Focus the first link when menu opens
      setTimeout(() => {
        firstLinkRef.current?.focus();
      }, 100);

      // Listen for Escape key to close menu
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setMobileNavOpen(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    } else {
      // Return focus to trigger button when menu closes
      if (menuTriggerRef?.current) {
        menuTriggerRef.current.focus();
      }
    }
  }, [mobileNavOpen, setMobileNavOpen, menuTriggerRef]);

  return (
    <AnimatePresence>
      {mobileNavOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-40 bg-paper/98 backdrop-blur-md flex flex-col justify-center"
          ref={dialogRef}
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <nav className="flex flex-col items-start px-8 gap-0">
            {NAV_ITEMS.map((item, index) => {
              const isActive = location.pathname === item.path;
              return (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="w-full"
                >
                  <Link
                    ref={index === 0 ? firstLinkRef : undefined}
                    to={item.path}
                    onClick={() => setMobileNavOpen(false)}
                    className={`
                      flex items-baseline gap-4 py-4 border-b border-warm-gray/20 w-full
                      transition-colors duration-200
                      ${isActive ? 'text-rust' : 'text-ink hover:text-rust'}
                    `}
                  >
                    <span className="font-body text-caption text-sepia-mid tracking-widest">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="font-display text-h2 md:text-h1">
                      {t(`nav.${item.key}`)}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="px-8 mt-8"
          >
            <Link
              to="/login"
              onClick={() => setMobileNavOpen(false)}
              className="inline-block font-body text-sm text-ink-faded border border-warm-gray/40 px-6 py-3 rounded hover:text-ink transition-colors"
            >
              {t('nav.login')}
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

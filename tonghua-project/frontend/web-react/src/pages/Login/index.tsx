import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionContainer from '@/components/layout/SectionContainer';
import EditorialHero from '@/components/editorial/EditorialHero';
import { VintageInput } from '@/components/editorial/VintageInput';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoggingIn, loginError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    login(
      { email, password },
      {
        onSuccess: () => {
          navigate('/');
        },
      }
    );
  };

  return (
    <PageWrapper>
      <EditorialHero
        number="09"
        title={t('login.title')}
        subtitle={t('login.subtitle')}
      />

      <SectionContainer narrow>
        <form onSubmit={handleSubmit} className="space-y-8">
          <VintageInput
            label={t('login.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <VintageInput
            label={t('login.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="font-body text-xs text-ink-faded">Remember me</span>
            </label>
            <Link
              to="#"
              className="font-body text-xs text-rust hover:text-ink transition-colors"
            >
              {t('login.forgotPassword')}
            </Link>
          </div>

          {loginError && (
            <div className="text-red-600 text-sm text-center mb-4">
              {loginError}
            </div>
          )}

          <motion.button
            type="submit"
            disabled={isLoggingIn}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full font-body text-sm tracking-[0.15em] uppercase bg-ink text-paper px-10 py-4 hover:bg-rust transition-colors duration-300 disabled:opacity-50"
          >
            {isLoggingIn ? '...' : t('login.submit')}
          </motion.button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-gray/30" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-paper px-4 font-body text-xs text-sepia-mid">
                {t('login.orContinueWith')}
              </span>
            </div>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full font-body text-sm tracking-[0.1em] border border-warm-gray/40 text-ink px-10 py-4 hover:border-ink transition-colors duration-300"
          >
            {t('login.wechat')}
          </motion.button>

          <p className="text-center">
            <Link
              to="#"
              className="font-body text-xs text-rust hover:text-ink transition-colors tracking-[0.1em] uppercase"
            >
              {t('login.register')}
            </Link>
          </p>
        </form>
      </SectionContainer>

      <div className="editorial-divider" />
    </PageWrapper>
  );
}

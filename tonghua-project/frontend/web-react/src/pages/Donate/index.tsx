import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import PageWrapper from '@/components/layout/PageWrapper';
import SectionContainer from '@/components/layout/SectionContainer';
import EditorialHero from '@/components/editorial/EditorialHero';
import NumberedSectionHeading from '@/components/editorial/NumberedSectionHeading';
import StoryQuoteBlock from '@/components/editorial/StoryQuoteBlock';
import DonationPanel from '@/components/editorial/DonationPanel';
import ImpactCounter from '@/components/editorial/ImpactCounter';
import { donationsApi } from '@/services/donations';

const IMPACT_AREAS = [
  { key: 'artSupplies', pct: 40 },
  { key: 'production', pct: 30 },
  { key: 'operations', pct: 15 },
  { key: 'community', pct: 15 },
];

export default function Donate() {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDonate = async (data: {
    amount: number;
    frequency: 'once' | 'monthly';
    anonymous: boolean;
    message: string;
  }) => {
    setIsSubmitting(true);
    try {
      await donationsApi.create({
        amount: data.amount,
        currency: 'CNY',
        anonymous: data.anonymous,
        message: data.message,
        frequency: data.frequency,
      });
      console.log('Donation successful');
      // Handle success (e.g., show confirmation, redirect)
    } catch (error) {
      console.error('Donation failed:', error);
      // Handle error (e.g., show error message)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageWrapper>
      <EditorialHero
        number="05"
        title={t('donate.hero.title')}
        subtitle={t('donate.hero.subtitle')}
      />

      {/* Main donation area */}
      <SectionContainer>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16">
          {/* Left: Info */}
          <div className="md:col-span-5">
            <NumberedSectionHeading
              number="01"
              title={t('donate.impact.title')}
            />

            {/* Impact breakdown */}
            <div className="space-y-6 mt-8">
              {IMPACT_AREAS.map((area) => (
                <div key={area.key}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="font-body text-sm text-ink">
                      {t(`donate.impact.${area.key}`)}
                    </span>
                    <span className="font-body text-sm text-sepia-mid">
                      {area.pct}%
                    </span>
                  </div>
                  <div className="h-1 bg-warm-gray/20 rounded-sm overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${area.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: [0, 0, 0.2, 1] }}
                      className="h-full bg-rust/70 rounded-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Impact counters */}
            <div className="grid grid-cols-2 gap-6 mt-12">
              <ImpactCounter value={890000} label="Funds Raised" prefix="¥" />
              <ImpactCounter value={2847} label="Children Helped" />
            </div>
          </div>

          {/* Right: Donation panel */}
          <div className="md:col-span-7">
            <DonationPanel
              onSubmit={handleDonate}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </SectionContainer>

      {/* Transparency */}
      <section className="bg-aged-stock section-spacing">
        <SectionContainer>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-5">
              <h3 className="font-display text-h3 font-bold text-ink mb-4">
                {t('donate.transparency.title')}
              </h3>
              <p className="font-body text-sm text-ink-faded leading-relaxed mb-6">
                {t('donate.transparency.subtitle')}
              </p>
              <button className="font-body text-xs text-rust tracking-[0.15em] uppercase hover:text-ink transition-colors">
                {t('donate.transparency.viewReport')} &rarr;
              </button>
            </div>
            <div className="md:col-span-7">
              <div className="grid grid-cols-2 gap-4">
                {['Q1 2026', 'Q4 2025', 'Q3 2025', 'Q2 2025'].map((quarter) => (
                  <div
                    key={quarter}
                    className="border border-warm-gray/30 p-6 bg-paper hover:border-rust/30 transition-colors cursor-pointer"
                  >
                    <span className="font-body text-caption text-sepia-mid tracking-[0.15em]">
                      FINANCIAL REPORT
                    </span>
                    <h4 className="font-display text-lg font-bold text-ink mt-2">
                      {quarter}
                    </h4>
                    <span className="font-body text-xs text-sepia-mid mt-2 block">
                      PDF &middot; 2.4 MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionContainer>
      </section>

      {/* Quote */}
      <SectionContainer narrow>
        <StoryQuoteBlock
          quote="Transparency isn't a feature. It's a responsibility."
          author="Annual Report 2025"
        />
      </SectionContainer>

      <div className="editorial-divider" />
    </PageWrapper>
  );
}

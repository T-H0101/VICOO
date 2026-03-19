import { motion } from 'framer-motion';
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface StoryQuoteBlockProps {
  quote: string;
  author?: string;
  role?: string;
  className?: string;
}

export default function StoryQuoteBlock({
  quote,
  author,
  role,
  className = '',
}: StoryQuoteBlockProps) {
  const [ref, isVisible] = useScrollReveal<HTMLQuoteElement>();

  return (
    <motion.blockquote
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0, 0, 0.2, 1] }}
      className={`relative py-12 md:py-16 ${className}`}
    >
      {/* Decorative quote mark */}
      <span
        className="absolute top-4 left-0 font-display text-[120px] md:text-[180px] leading-none text-rust/10 select-none pointer-events-none"
        aria-hidden="true"
      >
        &ldquo;
      </span>

      <div className="relative z-10 pl-4 md:pl-8 border-l-2 border-rust/30">
        <p className="font-display text-h3 md:text-h2 italic leading-[1.3] text-ink font-normal">
          {quote}
        </p>

        {(author || role) && (
          <footer className="mt-6 flex items-baseline gap-2">
            {author && (
              <cite className="font-body text-sm text-ink not-italic font-medium">
                {author}
              </cite>
            )}
            {author && role && (
              <span className="font-body text-xs text-sepia-mid">/</span>
            )}
            {role && (
              <span className="font-body text-xs text-sepia-mid tracking-wide">
                {role}
              </span>
            )}
          </footer>
        )}
      </div>
    </motion.blockquote>
  );
}

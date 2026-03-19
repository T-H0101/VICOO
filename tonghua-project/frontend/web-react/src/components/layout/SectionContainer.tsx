import { type ReactNode } from 'react';

interface SectionContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  narrow?: boolean;
  decorativeDivider?: boolean;
}

export default function SectionContainer({
  children,
  className = '',
  noPadding = false,
  narrow = false,
  decorativeDivider = false,
}: SectionContainerProps) {
  return (
    <section
      className={`
        ${noPadding ? '' : 'section-spacing'}
        ${className}
        relative
      `}
    >
      {/* Optional decorative divider at top */}
      {decorativeDivider && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-rust/30" />
      )}

      <div
        className={`
          mx-auto px-6 md:px-10
          ${narrow ? 'max-w-3xl' : 'max-w-[1400px]'}
        `}
      >
        {children}
      </div>
    </section>
  );
}

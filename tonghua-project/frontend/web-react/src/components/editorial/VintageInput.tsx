import { forwardRef, useId } from 'react';
import { motion } from 'framer-motion';

interface VintageInputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  type?: 'text' | 'email' | 'number' | 'textarea';
  helperText?: string;
  error?: string;
  icon?: 'search' | 'email' | 'user' | 'lock';
}

export const VintageInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, VintageInputProps>(
  ({ label, type = 'text', helperText, error, icon, className = '', ...props }, ref) => {
    const id = useId();
    const inputId = `${id}-input`;
    const helperId = `${id}-helper`;
    const errorId = `${id}-error`;

    const baseClasses = `
      w-full font-body text-sm py-3 px-0
      border-b-2 border-warm-gray/60
      bg-transparent
      transition-all duration-300 ease-editorial
      placeholder:text-sepia-mid/50
      focus:outline-none
      focus:border-rust
      ${error ? 'border-archive-brown' : ''}
    `;

    const inputProps = {
      id: inputId,
      ref,
      'aria-describedby': error ? errorId : helperId,
      'aria-invalid': !!error,
      className: baseClasses + ' ' + className,
      ...props,
    };

    const iconSvg = icon === 'search' ? (
      <svg className="w-4 h-4 text-sepia-mid mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ) : icon === 'email' ? (
      <svg className="w-4 h-4 text-sepia-mid mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ) : null;

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="font-body text-[10px] tracking-[0.2em] uppercase text-sepia-mid block"
          >
            {label}
          </label>
        )}

        {type === 'textarea' ? (
          <motion.textarea
            {...inputProps}
            rows={4}
            whileFocus={{ scale: 1.01 }}
          />
        ) : icon ? (
          <div className="flex items-center border-b-2 border-warm-gray/60 focus-within:border-rust transition-colors">
            {iconSvg}
            <motion.input
              {...inputProps}
              type={type}
              whileFocus={{ scale: 1.01 }}
              className={baseClasses + ' ' + className + ' border-none pl-0'}
            />
          </div>
        ) : (
          <motion.input
            {...inputProps}
            type={type}
            whileFocus={{ scale: 1.01 }}
          />
        )}

        {helperText && (
          <p id={helperId} className="font-body text-[10px] text-sepia-mid/70">
            {helperText}
          </p>
        )}

        {error && (
          <motion.p
            id={errorId}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-body text-[10px] text-archive-brown"
          >
            {error}
          </motion.p>
        )}
      </div>
    );
  }
);

VintageInput.displayName = 'VintageInput';

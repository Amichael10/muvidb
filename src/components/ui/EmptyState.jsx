import { Icon } from '@iconify/react';

/**
 * EmptyState: Standardized feedback component for empty lists, search misses, or inactive tabs.
 *
 * @param {Object} props
 * @param {string} [props.icon='solar:box-minimalistic-linear'] - Iconify icon name
 * @param {string} props.title - Short primary message
 * @param {string} [props.description] - Secondary explanatory guidance
 * @param {string} [props.body] - Alias for description
 * @param {import('react').ReactNode} [props.action] - Optional CTA button or link
 * @param {'surface'|'dashed'|'minimal'} [props.variant='surface'] - Container visual treatment
 * @param {string} [props.className=''] - Extra classes
 */
export default function EmptyState({
  icon = 'solar:box-minimalistic-linear',
  title,
  description,
  body,
  action,
  variant = 'surface',
  className = '',
}) {
  const explanation = description || body;

  const containerClasses = {
    surface: 'p-12 text-center rounded-2xl bg-surface border border-border space-y-3',
    dashed: 'rounded-2xl border border-dashed border-white/10 bg-white/[.015] px-6 py-10 text-center space-y-3',
    minimal: 'py-12 text-center space-y-2',
  }[variant] || 'p-12 text-center rounded-2xl bg-surface border border-border space-y-3';

  return (
    <div className={`${containerClasses} ${className}`} role="status">
      {icon && (
        <Icon
          icon={icon}
          className="text-4xl text-text-muted mx-auto opacity-40 shrink-0"
          aria-hidden="true"
        />
      )}
      {title && (
        <p className="text-sm font-semibold text-text-primary">
          {title}
        </p>
      )}
      {explanation && (
        <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
          {explanation}
        </p>
      )}
      {action && (
        <div className="pt-2 flex justify-center">
          {action}
        </div>
      )}
    </div>
  );
}

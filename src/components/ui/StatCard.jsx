import { Icon } from '@iconify/react';
import { Link } from 'react-router';

/**
 * StatCard: Standardized KPI metric card used across tracker and dashboard views.
 *
 * @param {Object} props
 * @param {string} props.label - Small uppercase tracking label
 * @param {import('react').ReactNode} props.value - Primary stat value
 * @param {string} [props.valueColor='text-brand'] - Tailwind text color class for the value
 * @param {string} [props.icon] - Optional Iconify icon to render next to the value
 * @param {string} [props.to] - If provided, renders value as a clickable Link
 * @param {string} [props.title] - Optional title tooltip
 * @param {string} [props.className=''] - Extra classes
 */
export default function StatCard({
  label,
  value,
  valueColor = 'text-brand',
  icon,
  to,
  title,
  className = '',
}) {
  const content = to ? (
    <Link
      to={to}
      className={`text-xs sm:text-sm font-black text-text-primary hover:${valueColor} transition-colors truncate block max-w-[180px]`}
      title={title || (typeof value === 'string' ? value : undefined)}
    >
      {value}
    </Link>
  ) : (
    <span className={`text-lg sm:text-xl font-black ${valueColor} font-heading flex items-center gap-1.5`}>
      {icon && <Icon icon={icon} className="shrink-0" aria-hidden="true" />}
      <span>{value}</span>
    </span>
  );

  return (
    <div
      className={`p-3 sm:p-3.5 rounded-xl bg-surface border border-border min-w-0 sm:min-w-[130px] flex-1 sm:flex-initial ${className}`}
    >
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block truncate">
        {label}
      </span>
      {content}
    </div>
  );
}

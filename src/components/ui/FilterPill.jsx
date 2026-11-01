import { Icon } from '@iconify/react';

/**
 * FilterPill: Standardized pill-shaped filter button used across search, catalogue, and leaderboard pages.
 *
 * @param {Object} props
 * @param {boolean} props.active - Whether this filter is currently selected
 * @param {Function} props.onClick - Click event handler
 * @param {string} props.label - Display label
 * @param {string} [props.icon] - Optional Iconify icon name
 * @param {number|string} [props.count] - Optional count badge
 * @param {'brand'|'purple'|'red'} [props.variant='brand'] - Active background color theme
 * @param {string} [props.className=''] - Extra classes
 */
export default function FilterPill({
  active,
  onClick,
  label,
  icon,
  count,
  variant = 'brand',
  className = '',
}) {
  const activeStyles = {
    brand: 'bg-brand text-white shadow-xs font-bold',
    purple: 'bg-purple-600 text-white shadow-xs font-bold',
    red: 'bg-red-600 text-white shadow-xs font-bold',
  }[variant] || 'bg-brand text-white shadow-xs font-bold';

  const inactiveStyles =
    'bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-2/80 border border-border/40';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
        active ? activeStyles : inactiveStyles
      } ${className}`}
      aria-pressed={active}
    >
      {icon && <Icon icon={icon} className="text-xs shrink-0" aria-hidden="true" />}
      <span>{label}</span>
      {count !== undefined && count !== null && (
        <span
          className={`text-[10px] font-mono px-1 rounded-full ${
            active ? 'bg-black/20 text-white' : 'bg-surface text-text-muted'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

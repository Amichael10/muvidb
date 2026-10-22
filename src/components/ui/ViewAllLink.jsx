import { Icon } from '@iconify/react';
import { Link } from 'react-router';

/**
 * The "view all" affordance for a section that previews part of a list.
 *
 * Every such section on the site follows the same rule: if the preview already
 * contains every item, there is nothing to view, and the link is noise — worse
 * when it advertises a count, because "View all critic reviews (1)" promises a
 * fuller page that doesn't exist. Encoding the rule here means a section can't
 * forget it, and the wording stays consistent across the site.
 *
 * Renders nothing unless `total > shown`.
 *
 * @param {number} total  how many items exist in the full set
 * @param {number} shown  how many the section already renders inline
 * @param {string} [to]       route for a navigation link
 * @param {Function} [onClick] handler instead, when the full set is a tab switch
 * @param {Function|string} [label] text, or (remaining, total) => text
 * @param {'link'|'button'} [variant]
 */
export default function ViewAllLink({
  total,
  shown,
  to,
  onClick,
  label = 'View all',
  icon = null,
  variant = 'link',
  className = '',
}) {
  const totalCount = Number(total) || 0;
  const shownCount = Number(shown) || 0;
  if (totalCount <= shownCount) return null;

  const text = typeof label === 'function' ? label(totalCount - shownCount, totalCount) : label;

  const base =
    variant === 'button'
      ? 'px-6 py-3 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border hover:border-brand/40 text-text-primary text-xs sm:text-sm font-bold transition-all flex items-center gap-2.5 shadow-sm hover:shadow-md cursor-pointer group'
      : 'text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1 transition-colors cursor-pointer';

  const inner = (
    <>
      {icon && (
        <Icon
          icon={icon}
          className={variant === 'button' ? 'text-base text-emerald-400 group-hover:scale-110 transition-transform' : 'text-xs'}
        />
      )}
      <span>{text}</span>
      <Icon
        icon="solar:alt-arrow-right-linear"
        className={
          variant === 'button'
            ? 'text-sm text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all'
            : 'text-xs'
        }
      />
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${base} ${className}`}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${base} ${className}`}>
      {inner}
    </button>
  );
}

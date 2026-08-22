import { useEffect, useRef, useState } from 'react';

/**
 * Mount children only once the placeholder enters (or nears) the viewport.
 * Keeps below-fold homepage rails out of the initial SSR/hydrate DOM and
 * defers their JS + network until the user is close to scrolling there.
 */
export default function DeferredMount({
  children,
  fallback = null,
  rootMargin = '400px 0px',
  minHeight = 280,
  onActivate,
  className = '',
}) {
  const ref = useRef(null);
  const activated = useRef(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (activated.current) return;
    const node = ref.current;
    if (!node) return;

    // No IntersectionObserver (very old browsers): activate on next idle tick.
    if (typeof IntersectionObserver === 'undefined') {
      const idle =
        typeof requestIdleCallback === 'function'
          ? requestIdleCallback(() => {
              activated.current = true;
              setActive(true);
              onActivate?.();
            })
          : null;
      const timeout =
        idle == null
          ? setTimeout(() => {
              activated.current = true;
              setActive(true);
              onActivate?.();
            }, 200)
          : null;
      return () => {
        if (idle != null && typeof cancelIdleCallback === 'function') {
          cancelIdleCallback(idle);
        }
        if (timeout != null) clearTimeout(timeout);
      };
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || activated.current) return;
        activated.current = true;
        setActive(true);
        onActivate?.();
        io.disconnect();
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [onActivate, rootMargin]);

  return (
    <div
      ref={ref}
      className={className}
      style={active ? undefined : { minHeight }}
    >
      {active ? children : fallback}
    </div>
  );
}

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'admin' },
    logout: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAdminNotifications', () => ({
  useAdminNotifications: () => ({
    totalCount: 5,
    cinemaCount: 3,
    claimCount: 2,
    notifications: [],
    loading: false,
  }),
}));

vi.mock('@iconify/react', () => ({ Icon: () => null }));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/admin' }),
  Navigate: () => null,
  Outlet: () => React.createElement('div', null, 'Admin overview'),
  Link: ({ children, to, ...props }) => React.createElement('a', { href: to, ...props }, children),
  NavLink: ({ children, to, className, ...props }) => {
    const state = { isActive: to === '/admin' };
    return React.createElement(
      'a',
      { href: to, className: typeof className === 'function' ? className(state) : className, ...props },
      typeof children === 'function' ? children(state) : children,
    );
  },
}));

globalThis.React = React;
const { default: AdminLayout } = await import('./AdminLayout');

describe('AdminLayout', () => {
  beforeEach(() => {
    const values = new Map();
    globalThis.localStorage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
      clear: () => values.clear(),
    };
  });

  it('renders notification counts without referencing the removed pendingCount variable', () => {
    const html = renderToStaticMarkup(React.createElement(AdminLayout));
    expect(html).toContain('Cinema Films');
    expect(html).toContain('>3<');
    expect(html).toContain('Admin overview');
  });
});

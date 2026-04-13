'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Search, Route, User, Plus } from 'lucide-react';

const navItems = [
  { href: '/map', label: 'Map', icon: Map },
  { href: '/map/sites/search', label: 'Search', icon: Search },
  { href: '/routes/new', label: 'Route', icon: Route },
  { href: '/profile', label: 'Profile', icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: 'var(--surface-raised)',
        borderTop: '1px solid var(--border-default)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.4)',
        height: 56,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        height: '100%',
        gap: 'var(--space-2)',
      }}>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                flex: 1,
                height: '100%',
                position: 'relative',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontSize: 10,
                fontWeight: 500,
                transition: 'color 0.15s',
                borderTop: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
            >
              <Icon style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Floating Add button — accent primary */}
      <Link
        href="/sites/new"
        className="nav-fab"
        style={{
          position: 'absolute',
          top: -12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--accent-primary)',
          color: 'white',
          borderRadius: '50%',
          boxShadow: 'var(--shadow-md)',
          transition: 'transform 0.1s, box-shadow 0.1s',
        }}
      >
        <Plus style={{ width: 22, height: 22 }} />
      </Link>
    </nav>
  );
}
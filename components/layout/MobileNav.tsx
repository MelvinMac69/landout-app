'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Search, Route, User, Plus } from 'lucide-react';

const navItems = [
  { href: '/map', label: 'Map', icon: Map },
  { href: '/sites/search', label: 'Search', icon: Search },
  { href: '/routes/new', label: 'Route', icon: Route },
  { href: '/profile', label: 'Profile', icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: 'var(--landout-charcoal)',
        borderTop: '1px solid #4A5568',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.4)',
        height: 65,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around h-full">
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
                color: isActive ? 'var(--landout-aviation)' : 'var(--text-muted)',
                transition: 'color 0.15s',
              }}
            >
              <Icon style={{ width: 20, height: 20 }} />
              <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Floating Add button — aviation orange */}
      <Link
        href="/sites/new"
        style={{
          position: 'absolute',
          top: -16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--landout-aviation)',
          color: 'white',
          borderRadius: '50%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          transition: 'all 0.15s',
        }}
      >
        <Plus style={{ width: 24, height: 24 }} />
      </Link>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/map', label: 'Map' },
  { href: '/sites/search', label: 'Search Sites' },
  { href: '/routes/new', label: 'Plan Route' },
  { href: '/profile', label: 'Profile' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'var(--landout-charcoal)',
        borderBottom: '1px solid #4A5568',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/map" className="flex items-center gap-2">
            <span className="text-xl">🛩️</span>
            <div className="flex flex-col">
              <span
                className="font-semibold leading-tight"
                style={{ color: 'var(--landout-aviation)', fontSize: 16, fontWeight: 700 }}
              >
                Landout
              </span>
              <span
                className="text-xs leading-tight"
                style={{ color: 'var(--text-muted)', fontSize: 10 }}
              >
                Maps for where the runway ends.
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    transition: 'all 0.15s',
                    background: isActive ? 'var(--landout-charcoal-light)' : 'transparent',
                    color: isActive ? 'var(--landout-aviation)' : 'var(--text-secondary)',
                    border: isActive ? '1px solid var(--landout-aviation)' : '1px solid transparent',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/sites/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--landout-aviation)',
                color: 'white',
                transition: 'all 0.15s',
              }}
            >
              <span>+</span>
              <span>Add Site</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

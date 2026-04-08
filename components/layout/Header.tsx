'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/map', label: 'Map' },
  { href: '/sites/search', label: 'Sites' },
  { href: '/routes/new', label: '+ Route' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="h-14 bg-[#1a1f2e] border-b border-slate-700/50 flex items-center px-4 gap-6 sticky top-0 z-50 hidden md:flex">
      {/* Logo + wordmark */}
      <div className="flex items-center gap-2">
        <Link href="/map" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-base font-bold tracking-tight">Landout</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1">
        {navLinks.map(({ href, label }) => {
          const active = pathname === href || (href !== '/map' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-700/60 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right side: Add Site */}
      <div className="ml-auto">
        <Link
          href="/sites/new"
          className="px-3 py-1.5 rounded-md text-sm font-semibold bg-sky-500 text-white hover:bg-sky-400 transition-colors"
        >
          + Add Site
        </Link>
      </div>
    </header>
  );
}

// Slim mobile-only branding bar — shown above map on mobile, invisible on desktop
export function MobileHeader() {
  return (
    <div className="h-9 bg-[#1a1f2e] flex items-center px-3 gap-3 md:hidden flex-shrink-0">
      <span
        className="text-sm font-black tracking-widest"
        style={{ color: '#D4621A' }}
      >
        LANDOUT
      </span>
      <span
        className="text-xs"
        style={{ color: '#9CA3AF' }}
      >
        maps for where the runway ends
      </span>
    </div>
  );
}

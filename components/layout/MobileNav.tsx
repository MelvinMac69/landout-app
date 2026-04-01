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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center gap-0.5 w-full h-full
                ${isActive ? 'text-slate-900' : 'text-slate-500'}
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Floating Add button */}
      <Link
        href="/sites/new"
        className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center w-12 h-12 bg-slate-900 text-white rounded-full shadow-lg hover:bg-slate-800 transition-colors"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </nav>
  );
}

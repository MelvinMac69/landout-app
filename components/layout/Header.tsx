'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;

  const nav = [
    { href: '/map', label: 'Map' },
    { href: '/sites/search', label: 'Sites' },
    { href: '/routes/new', label: '+ Route' },
  ];

  return (
    <header className="h-14 bg-[#1a1f2e] border-b border-slate-700/50 flex items-center px-4 gap-6 sticky top-0 z-50">
      {/* Logo + wordmark */}
      <div className="flex items-center gap-2">
        <Link href="/map" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-base font-bold tracking-tight">Landout</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1">
        {nav.map(({ href, label }) => {
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

      {/* Right side: user */}
      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            {session?.user?.email && (
              <span className="hidden md:block text-xs text-slate-400 truncate max-w-[140px]">
                {session.user.email}
              </span>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className="text-xs text-slate-400 hover:text-white transition-colors">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

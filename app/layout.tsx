import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Backcountry Map',
  description: 'Backcountry aviation mapping for GA pilots — public land, wilderness, and landing sites',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}

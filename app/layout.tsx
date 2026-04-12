import type { Metadata } from 'next';
import type { Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Backcountry Map',
  description: 'Backcountry aviation mapping for GA pilots — public land, wilderness, and landing sites',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  // NOT setting maximumScale or userScalable — MapLibre handles its own
  // pinch-zoom and pan gestures. Let the browser provide touch events natively.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Global error handler — catches unhandled errors before iOS Safari kills the page */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.onerror = function(msg, src, line, col, err) {
              console.error('[Global] Unhandled error:', { msg, src, line, col, err });
              return true;
            };
            window.addEventListener('unhandledrejection', function(e) {
              console.error('[Global] Unhandled promise rejection:', e.reason);
              e.preventDefault();
            });
          `
        }}
      />
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}

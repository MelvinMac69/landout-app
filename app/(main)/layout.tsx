import { Header, MobileHeader } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <MobileHeader />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}

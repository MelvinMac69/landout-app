/**
 * Map page layout — defines the @overlay parallel route slot.
 * 
 * When navigating to /sites/search or /sites/[id] FROM /map,
 * Next.js intercepts the route and renders the overlay content
 * in the @overlay slot instead of navigating away from the map.
 * 
 * When visiting /sites/search or /sites/[id] directly (deep link),
 * the fallback routes under (map)/sites/ are used instead.
 */
export default function MapPageLayout({
  children,
  overlay,
}: {
  children: React.ReactNode;
  overlay: React.ReactNode;
}) {
  return (
    <>
      {children}
      {overlay}
    </>
  );
}
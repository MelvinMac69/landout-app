'use client';

// Grid overlay for debugging UI layout — press G to toggle
// Shows X/Y grid labels so Trent can say "move to grid position 3,2"

interface MapGridProps {
  visible: boolean;
  cols?: number;
  rows?: number;
}

export function MapGrid({ visible, cols = 10, rows = 8 }: MapGridProps) {
  if (!visible) return null;

  const cells: { col: number; row: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ col: c, row: r });
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9998,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        overflow: 'hidden',
      }}
    >
      {cells.map(({ col, row }) => (
        <div
          key={`${col}-${row}`}
          style={{
            border: '1px solid rgba(59,130,246,0.35)',
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              color: 'rgba(59,130,246,0.9)',
              fontWeight: 700,
              lineHeight: 1,
              padding: '1px 2px',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: 2,
            }}
          >
            {col},{row}
          </span>
        </div>
      ))}
    </div>
  );
}

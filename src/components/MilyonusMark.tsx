/**
 * Self-contained text wordmark — no external image asset, so the brand
 * renders identically on every clone/fork with zero missing-asset risk.
 */
export default function MilyonusMark({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="chrome-text text-lg font-bold leading-none tracking-tight sm:text-xl">
        MILYONUS
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.42em] text-muted-foreground">
        Optic Tracking 2.4
      </div>
    </div>
  );
}

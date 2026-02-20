"use client";
import { toDecimalOdds, toPct, edgeEV } from "@/lib/odds";

type ThreeWay = "home" | "draw" | "away";

export default function ConsensusRow({
  books,
  novig,
}: {
  books: Record<string, { home: number; draw: number; away: number }>;
  novig: { home: number; draw: number; away: number };
}) {
  const keys: ThreeWay[] = ["home", "draw", "away"];

  const best: Record<ThreeWay, number> = keys.reduce((acc, k) => {
    let max = 0;
    for (const b of Object.values(books || {})) max = Math.max(max, Number(b[k]) || 0);
    (acc as any)[k] = max;
    return acc;
  }, {} as Record<ThreeWay, number>);

  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      {keys.map((k) => {
        const p = Number(novig?.[k]) || 0;
        const fairDec = toDecimalOdds(p);
        const bestDec = Number(best[k]) || 0;
        const ev = edgeEV(p, bestDec);

        const evPct = (ev * 100).toFixed(ev > 0.1 ? 0 : 1);
        const evClass = ev >= 0.02
          ? "bg-emerald-600/20 text-emerald-300"
          : ev > 0
          ? "bg-emerald-600/10 text-emerald-200"
          : "bg-slate-600/20 text-slate-300";

        return (
          <div key={k} className="rounded-lg border border-slate-700 p-2 bg-slate-800/50">
            <div className="flex items-center justify-between mb-2">
              <span className="uppercase tracking-wide text-slate-300 text-[10px]">{k}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${evClass}`}>
                EV {ev >= 0 ? "+" : ""}{evPct}%
              </span>
            </div>

            <div className="text-slate-400 text-[10px] mb-1">Consensus</div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-sm font-semibold">{fairDec}</span>
              <span className="text-[10px] text-slate-400">{toPct(p)}</span>
            </div>

            <div className="text-slate-400 text-[10px] mb-1">Best</div>
            <div className="text-sm">{bestDec ? bestDec.toFixed(2) : "—"}</div>
          </div>
        );
      })}
    </div>
  );
}



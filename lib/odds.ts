import Big from "big.js";

// Clamp probability to avoid division-by-zero and 100%
const clampProb = (p: number): number => Math.min(0.999, Math.max(0.001, Number(p) || 0));

/** Convert probability (0-1) to decimal odds as a display string (2dp). */
export function toDecimalOdds(probability: number): string {
  const prob = clampProb(probability);
  const odds = Big(1).div(prob);
  return odds.round(2, 1).toFixed(2); // round-half-up
}

/** Convert probability (0-1) to percentage string with 1dp. */
export function toPct(probability: number): string {
  return (clampProb(probability) * 100).toFixed(1) + "%";
}

/** Convert probability (0-1) to American odds string. */
export function toAmericanOdds(probability: number): string {
  const prob = clampProb(probability);
  const dec = Number(Big(1).div(prob));
  if (dec >= 2) return `+${Math.round((dec - 1) * 100)}`;
  return `${Math.round(-100 / (dec - 1))}`;
}

/** Expected value edge vs offered decimal odds (EV = p*odds - 1). */
export function edgeEV(probability: number, offeredDecimal: number): number {
  if (!offeredDecimal || offeredDecimal <= 1) return -1; // clearly negative EV
  return Number(Big(probability).times(offeredDecimal).minus(1));
}





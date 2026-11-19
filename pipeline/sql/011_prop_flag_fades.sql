-- Paper-track the OPPOSITE side of every prop flag (added 2026-11-18): over the first 65 graded
-- flags the flagged side won 28% vs 45% fair, so the fade won 72%. Small, clustered sample; this
-- records the best opposite-side price at another book in the same pull so the fade can be graded.
-- The fade wins exactly when the flag loses (won = FALSE); pushes / did-not-play stay NULL.
ALTER TABLE multisport_prop_flags ADD COLUMN IF NOT EXISTS fade_book  VARCHAR(64);
ALTER TABLE multisport_prop_flags ADD COLUMN IF NOT EXISTS fade_price NUMERIC(8,3);

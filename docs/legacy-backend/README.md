# Legacy backend docs (BetGeniusAI, retired 2026-11)

The Python/FastAPI prediction backend lived in `onjoroge1/BetGeniusAI` and ran on Replit.
It was shut down for cost in 2026-11 and the repository is archived. The multisport part
(NFL/NBA/NHL odds, features, training, edge math) was ported into this repo as `pipeline/`;
the soccer, parlay, player-prop, CLV-club and Live Edge services were **not** ported and the
frontend routes that proxied them are paused (`lib/backend-config.ts`).

These files are verbatim copies of the backend docs that still explain decisions the frontend
depends on. They describe the old system; where they conflict with `pipeline/README.md` or
`docs/RETURN_TO_SERVICE_PRS.md`, the newer docs win.

| File | Why it is kept |
|---|---|
| `ARCHITECTURE.md` (was `replit.md`) | One-page map of the old backend: models, collectors, endpoints, external APIs |
| `SYSTEM_ARCHITECTURE.md` | Deeper architecture notes |
| `API_DOCS.md` | Shapes of the old `/predict`, `/market`, `/predict-multisport` responses the frontend still types against |
| `MULTISPORT.md` | Original multisport tables + V2 feature list; the pipeline's `sql/001` was reconstructed from this and the code |
| `MULTISPORT_EDGE_PLAN.md` | 2-way edge design decisions (D1–D5) the pipeline's `edge.py` follows |
| `EDGE_PIVOT_PLAN.md`, `FRONTEND_EDGE_MANUAL.md`, `FRONTEND_EDGE_QA.md` | The edge-payload contract (`market/value/clv/model_track_record`) implemented in `lib/edge/*` |
| `LIVE_EDGE_PLAN.md`, `LIVE_BETTING_EDGE_SPEC.md` | In-game model spec; frontend `/live-edge` was built against it (currently paused) |
| `CLV_OPERATIONS_RUNBOOK.md` | Closing-line / CLV methodology mirrored by `pipeline/snapbet_pipeline/ledger.py` |
| `TRAINING_AND_BACKFILL_GUIDE.md` | How the soccer models were trained/backfilled (reference only) |
| `THE_ODDS_API_VALIDATION_RESULTS.md` | 2025-11-18 validation of The Odds API historical endpoint (relevant to PR-4b) |
| `PENDING.md` | The backend's last open-items list at shutdown |

Soccer-specific docs (V1/V2/V3 training, leak fixes, league expansion, WhatsApp, etc.) were
left in the archived repository.

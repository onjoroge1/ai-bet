-- Trained models live in the database so a lost runner or laptop never loses one.
-- One row per training run; predict loads the newest row per sport_key.
-- model_text is LightGBM's text dump (NULL when the market itself is the model,
-- i.e. the anchored trainer chose 0 correction rounds).
CREATE TABLE IF NOT EXISTS multisport_models (
    id          BIGSERIAL PRIMARY KEY,
    sport_key   TEXT        NOT NULL,
    trained_at  TIMESTAMPTZ NOT NULL,
    model_kind  TEXT,
    model_text  TEXT,
    features    JSONB       NOT NULL,
    metadata    JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS multisport_models_sport_trained_idx
    ON multisport_models (sport_key, trained_at DESC);

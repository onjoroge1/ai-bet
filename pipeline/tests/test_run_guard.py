from types import SimpleNamespace as NS

from snapbet_pipeline import cli


class _Cur:
    def __init__(self, v): self.v = v
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def execute(self, *a): pass
    def fetchone(self): return (self.v,)


def _run(monkeypatch, age, close=()):
    calls = []
    monkeypatch.setattr(cli, "_job", lambda conn, name, fn: calls.append(name) or {"status": "ok"})
    monkeypatch.setattr(cli, "sports_needing_close", lambda conn, keys: list(close))
    conn = NS(cursor=lambda: _Cur(age))
    out = cli.cmd_run(conn, NS(sports=["basketball_nba"]), NS(min_collect_gap=50, ignore_season=False))
    return out, calls


def test_run_skips_odds_when_fresh(monkeypatch):
    out, calls = _run(monkeypatch, 12.0)
    assert out["collect"]["status"] == "skipped" and "collect" not in calls and "predict" in calls


def test_run_collects_when_stale_or_empty(monkeypatch):
    assert "collect" in _run(monkeypatch, 75.0)[1]
    assert "collect" in _run(monkeypatch, None)[1]


def test_run_repulls_only_near_close_sports_when_fresh(monkeypatch):
    out, calls = _run(monkeypatch, 12.0, close=["basketball_nba"])
    assert "collect_close" in calls and "collect" not in calls and out["collect"]["mode"] == "close"
    assert "regulation" in calls

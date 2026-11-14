from types import SimpleNamespace as NS

from snapbet_pipeline import cli


class _Cur:
    def __init__(self, v): self.v = v
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def execute(self, *a): pass
    def fetchone(self): return (self.v,)


def _run(monkeypatch, age):
    calls = []
    monkeypatch.setattr(cli, "_job", lambda conn, name, fn: calls.append(name) or {"status": "ok"})
    conn = NS(cursor=lambda: _Cur(age))
    out = cli.cmd_run(conn, NS(), NS(min_collect_gap=50))
    return out, calls


def test_run_skips_odds_when_fresh(monkeypatch):
    out, calls = _run(monkeypatch, 12.0)
    assert out["collect"]["status"] == "skipped" and "collect" not in calls and "predict" in calls


def test_run_collects_when_stale_or_empty(monkeypatch):
    assert "collect" in _run(monkeypatch, 75.0)[1]
    assert "collect" in _run(monkeypatch, None)[1]

from snapbet_pipeline.config import libpq_url, read_env_files, resolve_database_url


def test_libpq_url_drops_prisma_params():
    url = "postgresql://u:p@h-pooler.neon.tech/db?sslmode=require&pgbouncer=true&connection_limit=1"
    assert libpq_url(url) == "postgresql://u:p@h-pooler.neon.tech/db?sslmode=require"
    assert libpq_url("postgresql://h/db") == "postgresql://h/db"


def test_env_files_first_wins_and_quotes(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    a.write_text('# c\nexport ODDS_API_KEY="k1"\n')
    b.write_text("ODDS_API_KEY=k2\nDATABASE_URL='postgresql://x/db?pgbouncer=true'\n")
    files = read_env_files((str(a), str(b), str(tmp_path / "missing")))
    assert files == {"ODDS_API_KEY": "k1", "DATABASE_URL": "postgresql://x/db?pgbouncer=true"}


def test_database_url_precedence(monkeypatch):
    files = {"DATABASE_URL": "postgresql://pooled/db?pgbouncer=true", "DATABASE_URL_UNPOOLED": "postgresql://direct/db"}
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)
    assert resolve_database_url(files) == "postgresql://direct/db"          # file: unpooled preferred
    monkeypatch.setenv("DATABASE_URL", "postgresql://ci/db")
    assert resolve_database_url(files) == "postgresql://ci/db"              # process env beats files
    assert resolve_database_url({"DATABASE_URL": "postgresql://p/db?pgbouncer=true"}) == "postgresql://ci/db"
    monkeypatch.delenv("DATABASE_URL")
    assert resolve_database_url({"DATABASE_URL": "postgresql://p/db?pgbouncer=true"}) == "postgresql://p/db"

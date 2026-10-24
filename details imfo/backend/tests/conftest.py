import pytest


@pytest.fixture(autouse=True)
def isolated_team_db(tmp_path, monkeypatch):
    """Every test gets its own Mission Control SQLite file instead of backend/teampulse.db."""
    monkeypatch.setenv("TEAMPULSE_DB_PATH", str(tmp_path / "teampulse-test.db"))

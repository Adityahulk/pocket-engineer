from pocket_engineer.config import Settings


def test_railway_postgres_url_uses_psycopg_v3():
    settings = Settings(
        database_url="postgresql://postgres:secret@postgres.railway.internal:5432/railway"
    )
    assert (
        settings.database_url
        == "postgresql+psycopg://postgres:secret@postgres.railway.internal:5432/railway"
    )


def test_heroku_style_postgres_url_uses_psycopg_v3():
    settings = Settings(database_url="postgres://pocket:pocket@localhost:5432/pocket")
    assert settings.database_url == "postgresql+psycopg://pocket:pocket@localhost:5432/pocket"


def test_explicit_psycopg_and_sqlite_urls_are_unchanged():
    psycopg = "postgresql+psycopg://pocket:pocket@postgres:5432/pocket_engineer"
    sqlite = "sqlite:///./pocket-engineer.db"
    assert Settings(database_url=psycopg).database_url == psycopg
    assert Settings(database_url=sqlite).database_url == sqlite

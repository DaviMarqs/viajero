from unittest.mock import patch, MagicMock

import pytest

from apps.destinations.services import fetch_wikipedia_thumbnail


def test_returns_originalimage_when_available():
    fake = MagicMock()
    fake.status_code = 200
    fake.json.return_value = {
        "originalimage": {"source": "https://upload.wikimedia.org/orig.jpg"},
        "thumbnail": {"source": "https://upload.wikimedia.org/thumb.jpg"},
    }
    with patch("apps.destinations.services.requests.get", return_value=fake):
        url = fetch_wikipedia_thumbnail("Lisboa")
    assert url == "https://upload.wikimedia.org/orig.jpg"


def test_falls_back_to_thumbnail_when_no_originalimage():
    fake = MagicMock()
    fake.status_code = 200
    fake.json.return_value = {
        "thumbnail": {"source": "https://upload.wikimedia.org/thumb.jpg"},
    }
    with patch("apps.destinations.services.requests.get", return_value=fake):
        url = fetch_wikipedia_thumbnail("Lisboa")
    assert url == "https://upload.wikimedia.org/thumb.jpg"


def test_returns_empty_when_404_in_both_langs():
    fake = MagicMock()
    fake.status_code = 404
    with patch("apps.destinations.services.requests.get", return_value=fake):
        url = fetch_wikipedia_thumbnail("CidadeFantasma")
    assert url == ""


def test_returns_empty_on_network_error():
    import requests
    with patch(
        "apps.destinations.services.requests.get",
        side_effect=requests.ConnectionError("down"),
    ):
        url = fetch_wikipedia_thumbnail("Lisboa")
    assert url == ""


def test_rejects_non_http_url():
    fake = MagicMock()
    fake.status_code = 200
    fake.json.return_value = {"originalimage": {"source": "ftp://bad.jpg"}}
    with patch("apps.destinations.services.requests.get", return_value=fake):
        url = fetch_wikipedia_thumbnail("Lisboa")
    assert url == ""


def test_empty_query_returns_empty():
    assert fetch_wikipedia_thumbnail("") == ""


def test_region_qualified_title_is_tried_first():
    """Com regiao, tenta 'Formiga (Minas Gerais)' antes do nome cru."""
    calls: list[str] = []

    def fake_get(url, **kwargs):
        calls.append(url)
        resp = MagicMock()
        if "Minas_Gerais" in url:
            resp.status_code = 200
            resp.json.return_value = {
                "originalimage": {"source": "https://upload.wikimedia.org/cidade.jpg"},
            }
        else:
            resp.status_code = 404
        return resp

    with patch("apps.destinations.services.requests.get", side_effect=fake_get):
        url = fetch_wikipedia_thumbnail("Formiga", region="Minas Gerais")

    assert url == "https://upload.wikimedia.org/cidade.jpg"
    assert "Formiga_" in calls[0] and "Minas_Gerais" in calls[0]


def test_falls_back_to_bare_name_when_region_title_missing():
    def fake_get(url, **kwargs):
        resp = MagicMock()
        if "(" in url:
            resp.status_code = 404
        else:
            resp.status_code = 200
            resp.json.return_value = {
                "thumbnail": {"source": "https://upload.wikimedia.org/bare.jpg"},
            }
        return resp

    with patch("apps.destinations.services.requests.get", side_effect=fake_get):
        url = fetch_wikipedia_thumbnail("Formiga", region="Minas Gerais")

    assert url == "https://upload.wikimedia.org/bare.jpg"


def test_no_region_keeps_single_title_behavior():
    fake = MagicMock()
    fake.status_code = 200
    fake.json.return_value = {"thumbnail": {"source": "https://upload.wikimedia.org/t.jpg"}}
    with patch("apps.destinations.services.requests.get", return_value=fake):
        url = fetch_wikipedia_thumbnail("Lisboa")
    assert url == "https://upload.wikimedia.org/t.jpg"

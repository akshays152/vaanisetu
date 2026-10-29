from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from backend import app as api


def next_open_date() -> str:
    value = date.today() + timedelta(days=1)
    while value.weekday() == 6:
        value += timedelta(days=1)
    return value.isoformat()


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DB_PATH", tmp_path / "test.sqlite3")
    monkeypatch.setattr(api, "ELEVENLABS_API_KEY", "")
    monkeypatch.setattr(api, "ELEVENLABS_AGENT_ID", "")
    with TestClient(api.app) as test_client:
        yield test_client


def agent_payload():
    return {
        "name": "Test Receptionist",
        "purpose": "Book appointments",
        "language": "Hindi + English",
        "bilingual": True,
        "instructions": "Be concise and helpful.",
        "greeting": "Namaste!",
        "voice": "Riya",
        "context": "Open Monday to Saturday.",
    }


def test_health_reports_provider_configuration_without_secrets(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["elevenLabs"]["configured"] is False


def test_agent_crud_persists_in_test_database(client):
    created = client.post("/agents", json=agent_payload())
    assert created.status_code == 201
    agent_id = created.json()["id"]

    fetched = client.get(f"/agents/{agent_id}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Test Receptionist"

    updated_payload = {**agent_payload(), "name": "Updated Receptionist"}
    updated = client.put(f"/agents/{agent_id}", json=updated_payload)
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Receptionist"

    assert client.get("/agents/missing-agent").status_code == 404


def test_booking_conflict_is_rejected(client):
    requested_date = next_open_date()
    payload = {
        "patientName": "Demo Patient",
        "date": requested_date,
        "time": "10:30 AM",
        "doctor": "Dr. Ananya Mehta",
    }

    first = client.post("/appointments", json=payload)
    assert first.status_code == 201
    assert first.json()["status"] == "confirmed"

    second = client.post("/appointments", json=payload)
    assert second.status_code == 409


def test_live_session_requires_server_configuration(client):
    created = client.post("/agents", json=agent_payload())
    response = client.post(f"/agents/{created.json()['id']}/sessions")
    assert response.status_code == 503

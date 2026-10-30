from datetime import timedelta
from urllib.error import HTTPError

import pytest
from fastapi.testclient import TestClient

import app as api


def next_open_date() -> str:
    value = api.datetime.now(api.CLINIC_TIMEZONE).date() + timedelta(days=1)
    while value.weekday() == 6:
        value += timedelta(days=1)
    return value.isoformat()


@pytest.fixture()
def database(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "DB_PATH", tmp_path / "test.sqlite3")
    monkeypatch.setattr(api, "ELEVENLABS_API_KEY", "")
    monkeypatch.setattr(api, "ELEVENLABS_AGENT_ID", "")
    api.initialize_db()


def agent_payload():
    return api.AgentInput(
        name="Test Receptionist",
        purpose="Book appointments",
        language="Hindi + English",
        bilingual=True,
        instructions="Be concise and helpful.",
        greeting="Namaste!",
        voice="Riya",
        context="Open Monday to Saturday.",
    )


def test_health_reports_provider_configuration_without_secrets(database):
    response = api.health()
    assert response["status"] == "ok"
    assert response["elevenLabs"]["configured"] is False


def test_agent_crud_persists_in_test_database(database):
    created = api.create_agent(agent_payload())
    agent_id = created["id"]

    fetched = api.get_agent(agent_id)
    assert fetched["name"] == "Test Receptionist"

    updated = api.update_agent(agent_id, agent_payload().model_copy(update={"name": "Updated Receptionist"}))
    assert updated["name"] == "Updated Receptionist"

    with pytest.raises(api.HTTPException) as error:
        api.get_agent("missing-agent")
    assert error.value.status_code == 404


def test_http_agent_slots_and_booking_flow(database):
    with TestClient(api.app) as client:
        created = client.post("/agents", json=agent_payload().model_dump())
        assert created.status_code == 201
        agent = created.json()
        assert client.get("/agents").json()[0]["id"] == agent["id"]
        assert client.get(f"/agents/{agent['id']}").json()["name"] == "Test Receptionist"

        day = next_open_date()
        available = client.get("/appointments/slots", params={"date": day})
        assert available.status_code == 200
        slot = available.json()["availableSlots"][0]

        booking = client.post("/appointments", json={
            "patientName": "API Test Patient",
            "date": day,
            "time": slot,
            "doctor": "Dr. Ananya Mehta",
        })
        assert booking.status_code == 201
        assert booking.json()["patientName"] == "API Test Patient"
        assert client.get("/appointments/latest").json()["id"] == booking.json()["id"]
        assert client.post("/appointments", json={
            "patientName": "Another Patient",
            "date": day,
            "time": slot,
            "doctor": "Dr. Ananya Mehta",
        }).status_code == 409


def test_booking_conflict_is_rejected(database):
    payload = api.BookingInput(
        patientName="Demo Patient", date=next_open_date(), time="10:30 AM", doctor="Dr. Ananya Mehta"
    )
    first = api.book_appointment(payload)
    assert first["status"] == "confirmed"

    with pytest.raises(api.HTTPException) as error:
        api.book_appointment(payload)
    assert error.value.status_code == 409


def test_invalid_slot_and_past_date_are_rejected(database):
    invalid_slot = api.BookingInput(patientName="Demo Patient", date=next_open_date(), time="09:00 AM")
    with pytest.raises(api.HTTPException) as slot_error:
        api.book_appointment(invalid_slot)
    assert slot_error.value.status_code == 400

    past_booking = api.BookingInput(
        patientName="Demo Patient", date=(api.datetime.now(api.CLINIC_TIMEZONE).date() - timedelta(days=1)).isoformat(), time="10:30 AM"
    )
    with pytest.raises(api.HTTPException) as date_error:
        api.book_appointment(past_booking)
    assert date_error.value.status_code == 400


def test_live_session_requires_server_configuration(database):
    created = api.create_agent(agent_payload())
    with pytest.raises(api.HTTPException) as error:
        api.start_session(created["id"])
    assert error.value.status_code == 503
    with api.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0


def test_live_session_provider_error_does_not_leave_orphan_session(database, monkeypatch):
    created = api.create_agent(agent_payload())
    monkeypatch.setattr(api, "ELEVENLABS_API_KEY", "server-test-key")
    monkeypatch.setattr(api, "ELEVENLABS_AGENT_ID", "agent_test123")

    def fail_provider():
        raise api.HTTPException(status_code=502, detail="ElevenLabs authorization is unavailable")

    monkeypatch.setattr(api, "get_elevenlabs_signed_url", fail_provider)
    with pytest.raises(api.HTTPException):
        api.start_session(created["id"])
    with api.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0


def test_live_session_provider_failure_is_sanitized(database, monkeypatch):
    monkeypatch.setattr(api, "ELEVENLABS_API_KEY", "server-test-key")
    monkeypatch.setattr(api, "ELEVENLABS_AGENT_ID", "agent_test123")

    def fail_upstream(*args, **kwargs):
        raise HTTPError("https://api.elevenlabs.io", 401, "unauthorized", {}, None)

    monkeypatch.setattr(api, "urlopen", fail_upstream)
    with pytest.raises(api.HTTPException) as error:
        api.get_elevenlabs_signed_url()
    assert error.value.status_code == 502
    assert "API key" not in str(error.value.detail)

"""API tests: ping, fact CRUD with supersede, SSE cursor replay."""

def test_ping(client):
    response = client.get("/api/ping")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_fact_crud_with_supersede(client):
    fact = {"section": "identity", "key": "name", "value": {"text": "Spandan"}}
    created = client.post("/api/profile/facts", json=fact).json()
    assert created["confirmed"] is True

    fact["value"] = {"text": "Span"}
    updated = client.put(f"/api/profile/facts/{created['id']}", json=fact).json()
    assert updated["id"] != created["id"]

    listed = client.get("/api/profile/facts").json()
    assert [f["value"]["text"] for f in listed] == ["Span"]

    assert client.put(
        f"/api/profile/facts/{created['id']}",
        json={"section": "identity", "key": "preferred_name", "value": {"text": "X"}},
    ).status_code == 404


def test_sse_replays_events_after_cursor(client):
    for name in ["a", "b", "c"]:
        client.post(
            "/api/profile/facts",
            json={"section": "identity", "key": name, "value": {"text": name}},
        )
    response = client.get("/api/events?cursor=1&replay_only=true")
    lines = response.text.splitlines()
    received = [int(line[4:]) for line in lines if line.startswith("id: ")]
    assert received == [2, 3]

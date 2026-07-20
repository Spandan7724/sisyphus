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


def test_preference_rule_crud_and_normalization(client):
    body = {
        "strength": "hard",
        "category": "location",
        "operator": "allow_any",
        "values": [" London ", "Remote", "london"],
        "enabled": True,
    }
    created_response = client.post("/api/preferences", json=body)
    assert created_response.status_code == 201
    created = created_response.json()
    assert created["values"] == ["London", "Remote"]

    created["values"] = ["London", "Bristol"]
    updated_response = client.put(
        f"/api/preferences/{created['id']}",
        json={key: created[key] for key in body},
    )
    assert updated_response.status_code == 200
    assert updated_response.json()["values"] == ["London", "Bristol"]

    listed = client.get("/api/preferences").json()
    assert len(listed) == 1
    assert listed[0]["category"] == "location"

    deleted = client.delete(f"/api/preferences/{created['id']}")
    assert deleted.status_code == 200
    assert client.get("/api/preferences").json() == []


def test_preference_rules_reject_invalid_and_duplicate_combinations(client):
    invalid = client.post(
        "/api/preferences",
        json={
            "strength": "soft",
            "category": "technology",
            "operator": "exclude",
            "values": ["COBOL"],
        },
    )
    assert invalid.status_code == 422

    body = {
        "strength": "soft",
        "category": "technology",
        "operator": "prefer",
        "values": ["Python"],
    }
    assert client.post("/api/preferences", json=body).status_code == 201
    assert client.post("/api/preferences", json=body).status_code == 409

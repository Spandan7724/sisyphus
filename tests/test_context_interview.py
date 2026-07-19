"""Tests for the context builder, the interview gap logic, and their APIs."""

from job_appli.candidate.context import build_context
from job_appli.candidate.models import (
    SENSITIVITY_SENSITIVE,
    CandidateFact,
    CandidateStory,
)


def _fact(section, key, text, **kw):
    return CandidateFact(
        section=section,
        key=key,
        value={"text": text},
        source_type="manual",
        **kw,
    )


def test_context_only_confirmed_reusable_nonsensitive(db):
    with db.session() as session:
        session.add(_fact("contact", "email", "a@b.c", confirmed=True))
        session.add(_fact("skills", "python", "expert", confirmed=False))
        session.add(
            _fact(
                "sensitive",
                "gender",
                "x",
                confirmed=True,
                sensitivity=SENSITIVITY_SENSITIVE,
            )
        )
        session.add(
            _fact("writing", "tone", "casual", confirmed=True, reuse_permitted=False)
        )
        session.add(
            CandidateStory(
                title="Story A",
                actions="did things",
                source_type="manual",
                confirmed=True,
            )
        )
        session.add(
            CandidateStory(title="Draft story", source_type="resume", confirmed=False)
        )
    with db.session() as session:
        ctx = build_context(session)
    assert "a@b.c" in ctx.text
    assert "expert" not in ctx.text
    assert "gender" not in ctx.text
    assert "casual" not in ctx.text
    assert "Story A" in ctx.text
    assert "Draft story" not in ctx.text
    assert len(ctx.manifest.fact_ids) == 1
    assert len(ctx.manifest.story_ids) == 1


def test_context_budget_truncates(db):
    with db.session() as session:
        for i in range(50):
            session.add(_fact("skills", f"s{i}", "x" * 200, confirmed=True))
    with db.session() as session:
        ctx = build_context(session, char_budget=1000, include_stories=False)
    assert ctx.manifest.truncated
    assert 0 < len(ctx.manifest.fact_ids) < 50


def test_interview_flow(client):
    first = client.get("/api/onboarding/next?limit=50").json()
    keys = {(q["section"], q["key"]) for q in first}
    assert ("contact", "email") in keys

    res = client.post(
        "/api/onboarding/answer",
        json={"section": "contact", "key": "email", "value": {"text": "a@b.c"}},
    )
    assert res.status_code == 200
    after = client.get("/api/onboarding/next?limit=50").json()
    assert ("contact", "email") not in {(q["section"], q["key"]) for q in after}
    assert len(after) == len(first) - 1

    assert (
        client.post(
            "/api/onboarding/answer",
            json={"section": "contact", "key": "phone", "skip": True},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/onboarding/answer",
            json={"section": "writing", "key": "voice_preferences", "skip": True},
        ).status_code
        == 200
    )


def test_confirm_draft_fact(client, db):
    with db.session() as session:
        session.add(_fact("skills", "python", "3 years", confirmed=False))
        session.flush()
        fact_id = session.query(CandidateFact).first().id
    res = client.post(f"/api/profile/facts/{fact_id}/confirm")
    assert res.status_code == 200
    assert res.json()["confirmed"] is True


class StubInterviewLLM:
    def __init__(self, questions):
        self._questions = questions

    def run(self, task, **kwargs):
        from job_appli.candidate.interview import ProposedQuestions

        assert task == "onboarding_interview"
        assert "## Facts" in kwargs["user_prompt"]
        return ProposedQuestions(questions=self._questions)


def _proposals():
    from job_appli.candidate.interview import ProposedQuestion

    return [
        ProposedQuestion(
            section="employment",
            key="gap_2024",
            question="There is a 2024 gap between roles; how should it be explained?",
            rationale="employment.2 ends 2023, employment.3 starts 2025",
        ),
        ProposedQuestion(
            section="contact",
            key="email",
            question="What is your email?",
            rationale="dup of checklist",
        ),
        ProposedQuestion(
            section="sensitive",
            key="veteran",
            question="Are you a veteran?",
            rationale="banned topic",
        ),
    ]


def test_generate_stores_filtered_proposals(client):
    client.app.state.llm = StubInterviewLLM(_proposals())
    generated = client.post("/api/onboarding/generate").json()
    assert [g["key"] for g in generated] == ["gap_2024"]
    assert generated[0]["origin"] == "generated"

    merged = client.get("/api/onboarding/next?limit=50").json()
    assert ("employment", "gap_2024") in {(q["section"], q["key"]) for q in merged}

    again = client.post("/api/onboarding/generate").json()
    assert again == []


def test_answer_generated_question(client):
    client.app.state.llm = StubInterviewLLM(_proposals())
    client.post("/api/onboarding/generate")
    res = client.post(
        "/api/onboarding/answer",
        json={
            "section": "employment",
            "key": "gap_2024",
            "value": {"text": "Sabbatical for a family matter; skills kept current."},
        },
    )
    assert res.status_code == 200
    assert res.json()["fact_id"]
    merged = client.get("/api/onboarding/next?limit=50").json()
    assert ("employment", "gap_2024") not in {(q["section"], q["key"]) for q in merged}


def test_dismiss_generated_question(client):
    client.app.state.llm = StubInterviewLLM(_proposals())
    client.post("/api/onboarding/generate")
    res = client.post(
        "/api/onboarding/answer",
        json={"section": "employment", "key": "gap_2024", "skip": True},
    )
    assert res.status_code == 200
    merged = client.get("/api/onboarding/next?limit=50").json()
    assert ("employment", "gap_2024") not in {(q["section"], q["key"]) for q in merged}

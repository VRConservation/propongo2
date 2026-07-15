import json
import os
import tempfile
import shutil
from app.main import create_app
from app.models import Proposal, PROPOSALS_DIR


def setup_function():
    """Create a temp proposals dir for tests."""
    os.makedirs(PROPOSALS_DIR, exist_ok=True)


def teardown_function():
    """Clean up test proposals."""
    if os.path.exists(PROPOSALS_DIR):
        for f in os.listdir(PROPOSALS_DIR):
            if f.endswith(".json"):
                os.remove(os.path.join(PROPOSALS_DIR, f))


def test_index_page():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.get("/")
        assert resp.status_code == 200
        assert b"Propongo 2" in resp.data


def test_new_proposal():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.get("/new", follow_redirects=True)
        assert resp.status_code == 200


def test_create_and_load_proposal():
    proposal = Proposal(title="Test Proposal", client_name="Test Client")
    proposal.save()

    loaded = Proposal.load(proposal.id)
    assert loaded is not None
    assert loaded.title == "Test Proposal"
    assert loaded.client_name == "Test Client"


def test_list_proposals():
    p1 = Proposal(title="First")
    p1.save()
    p2 = Proposal(title="Second")
    p2.save()

    proposals = Proposal.list_all()
    assert len(proposals) >= 2


def test_delete_proposal():
    p = Proposal(title="Delete Me")
    p.save()
    assert Proposal.load(p.id) is not None

    Proposal.delete(p.id)
    assert Proposal.load(p.id) is None


def test_api_get_proposal():
    p = Proposal(title="API Test")
    p.save()

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.get(f"/api/proposal/{p.id}")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["title"] == "API Test"


def test_api_put_proposal():
    p = Proposal(title="Original")
    p.save()

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.put(
            f"/api/proposal/{p.id}",
            json={"title": "Updated"},
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["title"] == "Updated"


def test_api_delete_proposal():
    p = Proposal(title="Delete via API")
    p.save()

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.delete(f"/api/proposal/{p.id}")
        assert resp.status_code == 200
        assert Proposal.load(p.id) is None


def test_api_add_task():
    p = Proposal(title="Task Test")
    p.save()

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.post(
            f"/api/task/{p.id}",
            json={"name": "Field Survey"},
            content_type="application/json",
        )
        assert resp.status_code == 201
        data = json.loads(resp.data)
        assert data["name"] == "Field Survey"

        loaded = Proposal.load(p.id)
        assert len(loaded.tasks) == 1


def test_api_add_budget_item():
    p = Proposal(title="Budget Test")
    p.save()

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.post(
            f"/api/budget/{p.id}",
            json={"task_id": "t1", "name": "Travel", "cost_per_unit": 150, "units": 4},
            content_type="application/json",
        )
        assert resp.status_code == 201
        data = json.loads(resp.data)
        assert data["cost_per_unit"] == 150
        assert data["units"] == 4


def test_budget_total():
    p = Proposal(title="Total Test")
    p.budget_items = [
        {"name": "Item A", "cost_per_unit": 100, "units": 2},
        {"name": "Item B", "cost_per_unit": 50, "units": 3},
    ]
    assert p.total_budget == 350


def test_editor_route():
    p = Proposal(title="Editor Test")
    p.save()

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.get(f"/editor/{p.id}")
        assert resp.status_code == 200
        assert b"Editor Test" in resp.data

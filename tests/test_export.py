from app.main import create_app
from app.models import Proposal


def setup_function():
    import os
    from app.models import PROPOSALS_DIR
    os.makedirs(PROPOSALS_DIR, exist_ok=True)


def teardown_function():
    import os
    from app.models import PROPOSALS_DIR
    if os.path.exists(PROPOSALS_DIR):
        for f in os.listdir(PROPOSALS_DIR):
            if f.endswith(".json"):
                os.remove(os.path.join(PROPOSALS_DIR, f))


def test_export_html():
    p = Proposal(title="Export Test", client_name="Client Co")
    p.tasks = [{"name": "Task 1", "description": "Do stuff"}]
    p.budget_items = [{"name": "Item 1", "cost_per_unit": 100, "units": 2}]
    p.qualifications = "We are qualified."
    p.save()

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.get(f"/export/html/{p.id}")
        assert resp.status_code == 200


def test_export_pdf():
    p = Proposal(title="PDF Export Test")
    p.tasks = [{"name": "Task A", "description": "Description A"}]
    p.budget_items = [{"name": "Budget A", "cost_per_unit": 200, "units": 1}]
    p.save()

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.get(f"/export/pdf/{p.id}")
        assert resp.status_code == 200


def test_export_missing_proposal():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.get("/export/pdf/nonexistent")
        assert resp.status_code == 404

        resp = client.get("/export/html/nonexistent")
        assert resp.status_code == 404


def test_preview_route():
    p = Proposal(title="Preview Test")
    p.tasks = [{"name": "Review", "description": "Review deliverables"}]
    p.save()

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        resp = client.get(f"/preview/{p.id}")
        assert resp.status_code == 200
        assert b"Preview Test" in resp.data

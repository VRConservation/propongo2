import json
import re
import uuid as _uuid
from flask import Flask, render_template, request, jsonify, redirect, url_for
from .models import Proposal
from .export import export_bp
from .snippets import snippets_bp


def create_app():
    app = Flask(__name__)
    app.secret_key = "propongo2-dev-key-change-in-production"

    app.register_blueprint(export_bp)
    app.register_blueprint(snippets_bp)

    @app.route("/")
    def index():
        proposals = Proposal.list_all()
        return render_template("index.html", proposals=proposals)

    @app.route("/new")
    def new_proposal():
        proposal = Proposal()
        proposal.save()
        return redirect(url_for("editor", proposal_id=proposal.id))

    @app.route("/editor/<proposal_id>")
    def editor(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return redirect(url_for("index"))
        return render_template(
            "base.html",
            proposal=proposal,
            tasks=proposal.tasks,
            budget_items=proposal.budget_items,
        )

    @app.route("/api/proposal/<proposal_id>", methods=["GET"])
    def get_proposal(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404
        return jsonify(proposal.to_dict())

    @app.route("/api/proposal/<proposal_id>", methods=["PUT"])
    def save_proposal(proposal_id):
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data"}), 400

        proposal = Proposal.load(proposal_id)
        if not proposal:
            proposal = Proposal(id=proposal_id)

        for key, value in data.items():
            if hasattr(proposal, key):
                setattr(proposal, key, value)

        proposal.save()
        return jsonify(proposal.to_dict())

    @app.route("/api/proposal/<proposal_id>", methods=["DELETE"])
    def delete_proposal(proposal_id):
        Proposal.delete(proposal_id)
        return jsonify({"ok": True})

    @app.route("/api/proposal/<proposal_id>/save-as", methods=["POST"])
    def save_proposal_as(proposal_id):
        data = request.get_json()
        title = data.get("title", "").strip()
        if not title:
            return jsonify({"error": "Title required"}), 400

        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404

        new_id = re.sub(r"[^a-z0-9_-]", "_", title.lower())
        new_id = re.sub(r"_+", "_", new_id).strip("_")
        if not new_id:
            new_id = _uuid.uuid4().hex[:8]

        original_id = new_id
        counter = 1
        while Proposal.load(new_id):
            new_id = f"{original_id}_{counter}"
            counter += 1

        new_proposal = Proposal(id=new_id, title=title)
        new_proposal.client_name = proposal.client_name
        new_proposal.project_summary = proposal.project_summary
        new_proposal.tasks = list(proposal.tasks)
        new_proposal.qualifications = proposal.qualifications
        new_proposal.budget_items = list(proposal.budget_items)
        new_proposal.start_date = proposal.start_date
        new_proposal.save()

        return jsonify({"id": new_id}), 201

    @app.route("/api/proposals", methods=["GET"])
    def list_proposals():
        return jsonify(Proposal.list_all())

    @app.route("/scope/<proposal_id>")
    def scope_tab(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404
        return render_template("scope.html", proposal=proposal, tasks=proposal.tasks)

    @app.route("/budget/<proposal_id>")
    def budget_tab(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404

        task_budgets = {}
        for task in proposal.tasks:
            items = [b for b in proposal.budget_items if b.get("task_id") == task["id"]]
            subtotal = sum(i.get("cost_per_unit", 0) * i.get("units", 0) for i in items)
            task_budgets[task["id"]] = {
                "task": task,
                "items": items,
                "subtotal": subtotal,
            }

        return render_template(
            "budget.html",
            proposal=proposal,
            tasks=proposal.tasks,
            budget_items=proposal.budget_items,
            total_budget=proposal.total_budget,
            task_budgets=task_budgets,
        )

    @app.route("/qualifications/<proposal_id>")
    def qualifications_tab(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404
        return render_template("qualifications.html", proposal=proposal)

    @app.route("/timeline/<proposal_id>")
    def timeline_tab(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404
        return render_template(
            "timeline.html",
            proposal=proposal,
            tasks=proposal.tasks,
            start_date=proposal.start_date,
        )

    @app.route("/preview/<proposal_id>")
    def preview_tab(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404
        return render_template(
            "preview.html",
            proposal=proposal,
            tasks=proposal.tasks,
            budget_items=proposal.budget_items,
            total_budget=proposal.total_budget,
        )

    @app.route("/api/task/<proposal_id>", methods=["POST"])
    def add_task(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404

        data = request.get_json()
        task = {
            "id": __import__("uuid").uuid4().hex[:8],
            "name": data.get("name", ""),
            "description": data.get("description", ""),
            "lead_months": data.get("lead_months", 0),
            "duration_months": data.get("duration_months", 1),
        }
        proposal.tasks.append(task)
        proposal.save()
        return jsonify(task), 201

    @app.route("/api/task/<proposal_id>/<task_id>", methods=["DELETE"])
    def delete_task(proposal_id, task_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404

        proposal.tasks = [t for t in proposal.tasks if t.get("id") != task_id]
        proposal.budget_items = [b for b in proposal.budget_items if b.get("task_id") != task_id]
        proposal.save()
        return jsonify({"ok": True})

    @app.route("/api/budget/<proposal_id>", methods=["POST"])
    def add_budget_item(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404

        data = request.get_json()
        item = {
            "id": __import__("uuid").uuid4().hex[:8],
            "task_id": data.get("task_id", ""),
            "name": data.get("name", ""),
            "cost_per_unit": float(data.get("cost_per_unit", 0)),
            "units": float(data.get("units", 1)),
        }
        proposal.budget_items.append(item)
        proposal.save()
        return jsonify(item), 201

    @app.route("/api/budget/<proposal_id>/<item_id>", methods=["DELETE"])
    def delete_budget_item(proposal_id, item_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404

        proposal.budget_items = [b for b in proposal.budget_items if b.get("id") != item_id]
        proposal.save()
        return jsonify({"ok": True})

    @app.route("/api/budget/<proposal_id>/<item_id>", methods=["PUT"])
    def update_budget_item(proposal_id, item_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data"}), 400

        for item in proposal.budget_items:
            if item.get("id") == item_id:
                item["task_id"] = data.get("task_id", item.get("task_id", ""))
                item["name"] = data.get("name", item.get("name", ""))
                item["cost_per_unit"] = float(data.get("cost_per_unit", item.get("cost_per_unit", 0)))
                item["units"] = float(data.get("units", item.get("units", 1)))
                break
        else:
            return jsonify({"error": "Item not found"}), 404

        proposal.save()
        return jsonify({"ok": True})

    return app


def run_server():
    app = create_app()
    app.run(debug=True, port=5000)


if __name__ == "__main__":
    run_server()

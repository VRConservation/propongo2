import json
import os
import re
import uuid as _uuid
import threading
from flask import Flask, render_template, request, jsonify, redirect, url_for
from markupsafe import Markup
from .models import Proposal, PROPOSALS_DIR
from .export import export_bp
from .snippets import snippets_bp
from . import __version__

_proposal_locks = {}
_proposal_locks_lock = threading.Lock()


def markdown_to_html(text):
    if not text:
        return ""
    lines = text.split("\n")
    html_lines = []
    in_list = False
    in_ol = False

    for line in lines:
        stripped = line.strip()

        if not stripped:
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            if in_ol:
                html_lines.append("</ol>")
                in_ol = False
            continue

        if stripped.startswith("######"):
            if in_list: html_lines.append("</ul>"); in_list = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            html_lines.append(f"<h6>{_md_inline(stripped[6:])}</h6>")
        elif stripped.startswith("#####"):
            if in_list: html_lines.append("</ul>"); in_list = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            html_lines.append(f"<h5>{_md_inline(stripped[5:])}</h5>")
        elif stripped.startswith("####"):
            if in_list: html_lines.append("</ul>"); in_list = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            html_lines.append(f"<h4>{_md_inline(stripped[4:])}</h4>")
        elif stripped.startswith("###"):
            if in_list: html_lines.append("</ul>"); in_list = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            html_lines.append(f"<h3>{_md_inline(stripped[3:])}</h3>")
        elif stripped.startswith("##"):
            if in_list: html_lines.append("</ul>"); in_list = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            html_lines.append(f"<h2>{_md_inline(stripped[2:])}</h2>")
        elif stripped.startswith("#"):
            if in_list: html_lines.append("</ul>"); in_list = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            html_lines.append(f"<h1>{_md_inline(stripped[1:])}</h1>")
        elif re.match(r"^[-*+]\s+", stripped):
            if in_ol: html_lines.append("</ol>"); in_ol = False
            if not in_list:
                html_lines.append("<ul>")
                in_list = True
            content = re.sub(r"^[-*+]\s+", "", stripped)
            html_lines.append(f"<li>{_md_inline(content)}</li>")
        elif re.match(r"^\d+\.\s+", stripped):
            if in_list: html_lines.append("</ul>"); in_list = False
            if not in_ol:
                html_lines.append("<ol>")
                in_ol = True
            content = re.sub(r"^\d+\.\s+", "", stripped)
            html_lines.append(f"<li>{_md_inline(content)}</li>")
        else:
            if in_list: html_lines.append("</ul>"); in_list = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            html_lines.append(f"<p>{_md_inline(stripped)}</p>")

    if in_list:
        html_lines.append("</ul>")
    if in_ol:
        html_lines.append("</ol>")

    return "\n".join(html_lines)


def _md_inline(text):
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    text = re.sub(r"`(.+?)`", r"<code>\1</code>", text)
    return text


def create_app():
    app = Flask(__name__)
    app.secret_key = "propongo2-dev-key-change-in-production"

    app.register_blueprint(export_bp)
    app.register_blueprint(snippets_bp)

    @app.context_processor
    def inject_version():
        return {"app_version": __version__}

    app.jinja_env.filters["md"] = lambda text: Markup(markdown_to_html(text))
    app.jinja_env.filters["currency"] = lambda value: f"{value:,.0f}"

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

        with _proposal_locks_lock:
            if proposal_id not in _proposal_locks:
                _proposal_locks[proposal_id] = threading.Lock()
            lock = _proposal_locks[proposal_id]

        with lock:
            proposal = Proposal.load(proposal_id)
            if not proposal:
                return jsonify({"error": "Not found"}), 404

            if "tasks" in data:
                incoming_tasks = data.pop("tasks")
                existing_by_id = {t.get("id"): t for t in proposal.tasks}
                merged = []
                for t in incoming_tasks:
                    tid = t.get("id", "")
                    if tid in existing_by_id:
                        merged_task = dict(existing_by_id[tid])
                        merged_task.update(t)
                    else:
                        merged_task = t
                    merged.append(merged_task)
                proposal.tasks = merged

            skip_fields = {"id", "title", "created_at"}
            for key, value in data.items():
                if key in skip_fields:
                    continue
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
        new_proposal.subtitle = getattr(proposal, 'subtitle', '') or ''
        new_proposal.project_summary = proposal.project_summary
        new_proposal.tasks = list(proposal.tasks)
        new_proposal.qualifications = proposal.qualifications
        new_proposal.budget_items = list(proposal.budget_items)
        new_proposal.budget_item_timings = dict(proposal.budget_item_timings) if proposal.budget_item_timings else {}
        new_proposal.start_date = proposal.start_date
        new_proposal.indirect_percent = getattr(proposal, 'indirect_percent', 0) or 0
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

        indirect_percent = getattr(proposal, 'indirect_percent', 0) or 0
        indirect_amount = proposal.total_budget * (indirect_percent / 100)
        total_with_indirect = proposal.total_budget + indirect_amount

        return render_template(
            "budget.html",
            proposal=proposal,
            tasks=proposal.tasks,
            budget_items=proposal.budget_items,
            total_budget=proposal.total_budget,
            task_budgets=task_budgets,
            indirect_percent=indirect_percent,
            indirect_amount=indirect_amount,
            total_with_indirect=total_with_indirect,
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

        task_budgets = {}
        timings = proposal.budget_item_timings or {}
        for task in proposal.tasks:
            items = [b for b in proposal.budget_items if b.get("task_id") == task["id"]]
            for item in items:
                t = timings.get(item.get("id", ""), {})
                if t:
                    item["start_month"] = t.get("start_month")
                    item["start_year"] = t.get("start_year")
                    item["duration_months"] = t.get("duration_months", 1)
                    if t.get("lead_entity"):
                        item["lead_entity"] = t["lead_entity"]
            if items:
                task_budgets[task["id"]] = {
                    "task": task,
                    "items": items,
                }

        from datetime import datetime as _dt
        try:
            sd = _dt.strptime(proposal.start_date, "%Y-%m-%d")
            start_date_month = sd.month
            start_date_year = sd.year
        except (ValueError, TypeError):
            now = _dt.now()
            start_date_month = now.month
            start_date_year = now.year

        return render_template(
            "timeline.html",
            proposal=proposal,
            tasks=proposal.tasks,
            start_date=proposal.start_date,
            start_date_month=start_date_month,
            start_date_year=start_date_year,
            task_budgets=task_budgets,
        )

    @app.route("/preview/<proposal_id>")
    def preview_tab(proposal_id):
        proposal = Proposal.load(proposal_id)
        if not proposal:
            return jsonify({"error": "Not found"}), 404

        indirect_percent = getattr(proposal, 'indirect_percent', 0) or 0
        indirect_amount = proposal.total_budget * (indirect_percent / 100)
        total_with_indirect = proposal.total_budget + indirect_amount

        tasks_with_timing = []
        for t in proposal.tasks:
            tasks_with_timing.append({
                "id": t.get("id", ""),
                "name": t.get("name", ""),
                "description": t.get("description", ""),
                "lead_entity": t.get("lead_entity", ""),
                "start_month": t.get("start_month"),
                "start_year": t.get("start_year"),
                "duration_months": t.get("duration_months", 1),
            })

        budget_with_timing = []
        timings = proposal.budget_item_timings or {}
        for item in proposal.budget_items:
            item_id = item.get("id", "")
            timing = timings.get(item_id, {})
            budget_with_timing.append({
                **item,
                "start_month": timing.get("start_month"),
                "start_year": timing.get("start_year"),
                "duration_months": timing.get("duration_months", 1),
                "task_id": item.get("task_id", ""),
            })

        return render_template(
            "preview.html",
            proposal=proposal,
            tasks=tasks_with_timing,
            budget_items=proposal.budget_items,
            budget_with_timing=budget_with_timing,
            total_budget=proposal.total_budget,
            indirect_percent=indirect_percent,
            indirect_amount=indirect_amount,
            total_with_indirect=total_with_indirect,
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

# Propongo 2

A local proposal generator for conservation and natural resource projects. Create professional proposals with scope of work, budgets, qualifications, timelines, and export to PDF or HTML.

## Features

- **Scope of Work** - Define project summary, tasks, and deliverables
- **Budget** - Line-item budgeting with cost/unit calculations and totals
- **Qualifications** - Document team background and relevant experience
- **Timeline** - Set lead times and durations per task with GANTT chart visualization
- **Preview** - View the complete proposal before exporting
- **PDF Export** - Clean, professional PDF output via WeasyPrint
- **HTML Export** - Standalone HTML file with embedded styles
- **Snippet Library** - Reusable markdown components for organization descriptions, deliverable templates, and custom content
- **Save/Load** - Proposals stored as JSON files on disk, no database required

## Quick Start

### Install from PyPI

```bash
pip install propongo2
```

### Run

```bash
propongo2
```

Opens at [http://localhost:5000](http://localhost:5000)

### Install from source

```bash
git clone https://github.com/VRConservation/propongo2.git
cd propongo2
pip install -e .
propongo2
```

### Development setup

```bash
git clone https://github.com/VRConservation/propongo2.git
cd propongo2
pip install -e ".[dev]"
python run.py
```

## Usage

### Creating a Proposal

1. Click **New Proposal** from the dashboard
2. Enter a title and optional client name in the header
3. Work through each tab:

   **Scope** - Add a project summary, then create tasks/deliverables with descriptions

   **Budget** - Select a task, enter line items with cost per unit and quantities. Totals calculate automatically.

   **Qualifications** - Describe your organization's background and why you're qualified for this project

   **Timeline** - Set project start date, configure lead times and durations per task, then view the Gantt chart

   **Preview** - Review the complete proposal before exporting

### Using Snippets

Click the sidebar icon (&#9776;) to open the snippet library:

- **Organization** - Pre-written organization descriptions
- **Deliverables** - Templates for common deliverable types (surveys, assessments, plans)
- **Custom** - Create and save your own reusable snippets

Click a snippet to insert it at the cursor position in any text field.

### Exporting

- **PDF** - Click "Export PDF" to generate a clean, professional PDF document
- **HTML** - Click "Export HTML" to download a standalone HTML file
- **Print** - Use Ctrl+P / Cmd+P in the Preview tab for browser printing

### Managing Proposals

- Proposals auto-save as you work
- Click "Proposals" in the header to see all saved proposals
- Create, edit, or delete proposals from the dashboard

## Updating

### From PyPI

```bash
pip install --upgrade propongo2
```

### From source

```bash
cd propongo2
git pull
pip install -e .
```

## Development

### Run tests

```bash
pytest
```

### Bump version

```bash
bump2version patch   # 0.1.0 -> 0.1.1
bump2version minor   # 0.1.1 -> 0.2.0
bump2version major   # 0.2.0 -> 1.0.0
```

### Publish to PyPI

```bash
python -m build
twine upload dist/*
```

## Project Structure

```
propongo2/
├── run.py                      # Dev entry point
├── pyproject.toml              # Package config
├── requirements.txt            # Dependencies
├── app/
│   ├── __init__.py             # Version
│   ├── main.py                 # Flask app + routes
│   ├── models.py               # Proposal data model
│   ├── export.py               # PDF/HTML export
│   ├── snippets.py             # Snippet management
│   ├── templates/              # Jinja2 templates
│   │   ├── base.html           # Layout + HTMX
│   │   ├── index.html          # Proposal dashboard
│   │   ├── scope.html          # Scope editor
│   │   ├── budget.html         # Budget editor
│   │   ├── qualifications.html # Qualifications editor
│   │   ├── timeline.html       # Timeline + Gantt
│   │   ├── preview.html        # Proposal preview
│   │   └── export_proposal.html# PDF export template
│   ├── static/
│   │   ├── css/style.css       # All styles
│   │   └── js/
│   │       ├── app.js          # Core JS + HTMX helpers
│   │       ├── budget.js       # Budget calculations
│   │       ├── gantt.js        # Gantt chart rendering
│   │       └── snippets.js     # Snippet panel logic
│   ├── snippets/               # Stock snippet data
│   │   ├── organization.json
│   │   ├── deliverables.json
│   │   └── custom/             # User-created snippets
│   └── data/
│       └── proposals/          # Saved proposals (JSON)
└── tests/
    ├── test_main.py
    └── test_export.py
```

## Tech Stack

- **Backend:** Python, Flask
- **Frontend:** HTMX, Jinja2, vanilla CSS/JS
- **PDF Export:** WeasyPrint
- **Packaging:** pyproject.toml, setuptools

## License

MIT

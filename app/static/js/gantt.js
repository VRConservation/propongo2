let ganttUseDays = false;

function toggleTimelineUnits() {
    ganttUseDays = document.getElementById('timeline-use-days').checked;
    const label = document.querySelectorAll('.duration-label');
    label.forEach(l => {
        l.textContent = ganttUseDays ? 'Duration (days)' : 'Duration (months)';
    });
}

function toggleBudgetInTimeline() {
    const show = document.getElementById('timeline-show-budget').checked;
    const el = document.getElementById('budget-timeline-inputs');
    if (el) el.style.display = show ? 'block' : 'none';
}

function updateTimeline(proposalId) {
    const inputs = document.querySelectorAll('.timeline-input-card:not(.budget-timeline-item)');
    const showBudget = document.getElementById('timeline-show-budget')?.checked;
    const useDays = document.getElementById('timeline-use-days')?.checked;
    ganttUseDays = useDays;

    const tasks = [];

    inputs.forEach(card => {
        const taskId = card.dataset.taskId;
        const leadEntity = card.querySelector('.lead-entity')?.value || '';
        let duration = parseInt(card.querySelector('.duration-months').value) || 1;
        if (useDays) duration = Math.ceil(duration / 30);
        tasks.push({ id: taskId, name: card.querySelector('.timeline-task-name').textContent, lead_entity: leadEntity, lead_months: 0, duration_months: duration });
    });

    if (showBudget) {
        document.querySelectorAll('.budget-timeline-item').forEach(card => {
            const itemId = card.dataset.itemId;
            const taskName = card.querySelector('.timeline-task-name').textContent;
            const leadEntity = card.querySelector('.lead-entity')?.value || '';
            let duration = parseInt(card.querySelector('.duration-months').value) || 1;
            if (useDays) duration = Math.ceil(duration / 30);
            tasks.push({ id: 'budget_' + itemId, name: taskName, lead_entity: leadEntity, lead_months: 0, duration_months: duration, is_budget: true });
        });
    }

    const saveTasks = tasks.map(t => ({
        id: t.id,
        lead_entity: t.lead_entity,
        lead_months: t.lead_months,
        duration_months: t.duration_months
    }));

    fetch('/api/proposal/' + proposalId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: saveTasks })
    })
    .then(() => renderGantt(tasks));
}

function renderGantt(tasks) {
    const container = document.getElementById('gantt-chart');
    if (!tasks.length) {
        container.innerHTML = '<div class="gantt-placeholder">No tasks to display.</div>';
        return;
    }

    const maxMonths = Math.max(12, ...tasks.map(t => (t.lead_months || 0) + (t.duration_months || 1)));
    const monthWidth = 60;

    const startDate = new Date(document.getElementById('start-date')?.value || Date.now());

    let headerHTML = '<div class="gantt-header"><div class="gantt-label-col">Task</div>';
    for (let i = 0; i < maxMonths; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        headerHTML += `<div class="gantt-month" style="min-width:${monthWidth}px">${label}</div>`;
    }
    headerHTML += '</div>';

    let rowsHTML = '';
    tasks.forEach(task => {
        const lead = task.lead_months || 0;
        const duration = task.duration_months || 1;
        const entityLabel = task.lead_entity ? ` (${task.lead_entity})` : '';

        rowsHTML += `<div class="gantt-row">
            <div class="gantt-row-label">${task.name}${entityLabel}</div>
            <div class="gantt-bar-container">`;

        for (let i = 0; i < maxMonths; i++) {
            if (i === lead) {
                rowsHTML += `<div class="gantt-cell" style="min-width:${monthWidth}px">
                    <div class="gantt-bar" style="width:${duration * monthWidth}px"></div>
                </div>`;
                i += duration - 1;
            } else if (i < lead || i >= lead + duration) {
                rowsHTML += `<div class="gantt-cell" style="min-width:${monthWidth}px"></div>`;
            }
        }

        rowsHTML += '</div></div>';
    });

    container.innerHTML = headerHTML + rowsHTML;
}

function updateTimeline(proposalId) {
    const inputs = document.querySelectorAll('.timeline-input-card');
    const tasks = [];

    inputs.forEach(card => {
        const taskId = card.dataset.taskId;
        const lead = parseInt(card.querySelector('.lead-months').value) || 0;
        const duration = parseInt(card.querySelector('.duration-months').value) || 1;
        tasks.push({ id: taskId, lead_months: lead, duration_months: duration });
    });

    // Update proposal with timeline data
    const proposal = { tasks: [] };
    inputs.forEach(card => {
        const taskId = card.dataset.taskId;
        const nameEl = card.querySelector('.timeline-task-name');
        proposal.tasks.push({
            id: taskId,
            name: nameEl ? nameEl.textContent : '',
            lead_months: parseInt(card.querySelector('.lead-months').value) || 0,
            duration_months: parseInt(card.querySelector('.duration-months').value) || 1,
        });
    });

    fetch('/api/proposal/' + proposalId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: tasks.map(t => ({ id: t.id, lead_months: t.lead_months, duration_months: t.duration_months })) })
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

    // Header
    let headerHTML = '<div class="gantt-header"><div class="gantt-label-col">Task</div>';
    for (let i = 0; i < maxMonths; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        headerHTML += `<div class="gantt-month" style="min-width:${monthWidth}px">${label}</div>`;
    }
    headerHTML += '</div>';

    // Rows
    let rowsHTML = '';
    tasks.forEach(task => {
        const lead = task.lead_months || 0;
        const duration = task.duration_months || 1;

        rowsHTML += `<div class="gantt-row">
            <div class="gantt-row-label">${task.name}</div>
            <div class="gantt-bar-container">`;

        for (let i = 0; i < maxMonths; i++) {
            if (i === lead) {
                rowsHTML += `<div class="gantt-cell" style="min-width:${monthWidth}px">
                    <div class="gantt-bar" style="width:${duration * monthWidth}px"></div>
                </div>`;
                // Skip ahead
                i += duration - 1;
            } else if (i < lead || i >= lead + duration) {
                rowsHTML += `<div class="gantt-cell" style="min-width:${monthWidth}px"></div>`;
            }
        }

        rowsHTML += '</div></div>';
    });

    container.innerHTML = headerHTML + rowsHTML;
}

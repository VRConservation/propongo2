let ganttUseDays = false;

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toggleTimelineUnits() {
    ganttUseDays = document.getElementById('timeline-use-days').checked;
    const label = document.querySelectorAll('.duration-label');
    label.forEach(l => {
        l.textContent = ganttUseDays ? 'Duration (days)' : 'Duration (months)';
    });
}

function toggleBudgetInTimeline() {
    const show = document.getElementById('timeline-show-budget').checked;
    document.querySelectorAll('.budget-timeline-subitems').forEach(el => {
        el.style.display = show ? 'block' : 'none';
    });
}

function updateTimeline(proposalId) {
    const taskCards = document.querySelectorAll('#timeline-inputs > .timeline-input-card:not(.budget-timeline-item)');
    const showBudget = document.getElementById('timeline-show-budget')?.checked;
    const useDays = document.getElementById('timeline-use-days')?.checked;
    ganttUseDays = useDays;

    const projectStartMonth = parseInt(document.getElementById('start-month').value) || 1;
    const projectStartYear = parseInt(document.getElementById('start-year').value) || 2025;

    const tasks = [];

    taskCards.forEach(card => {
        const taskId = card.dataset.taskId;
        const leadEntity = card.querySelector('.lead-entity')?.value || '';
        let duration = parseInt(card.querySelector('.duration-months').value) || 1;
        if (useDays) duration = Math.ceil(duration / 30);

        const startMonth = parseInt(card.querySelector('.task-start-month')?.value) || projectStartMonth;
        const startYear = parseInt(card.querySelector('.task-start-year')?.value) || projectStartYear;

        tasks.push({
            id: taskId,
            name: card.querySelector('.timeline-task-name').textContent,
            lead_entity: leadEntity,
            start_month: startMonth,
            start_year: startYear,
            duration_months: duration
        });

        if (showBudget) {
            const subitems = card.nextElementSibling;
            if (subitems && subitems.classList.contains('budget-timeline-subitems')) {
                subitems.querySelectorAll('.budget-timeline-item').forEach(sub => {
                    const itemId = sub.dataset.itemId;
                    const itemName = sub.querySelector('.timeline-task-name').textContent;
                    const itemLead = sub.querySelector('.lead-entity')?.value || '';
                    let itemDuration = parseInt(sub.querySelector('.duration-months').value) || 1;
                    if (useDays) itemDuration = Math.ceil(itemDuration / 30);

                    const itemStartMonth = parseInt(sub.querySelector('.item-start-month')?.value) || startMonth;
                    const itemStartYear = parseInt(sub.querySelector('.item-start-year')?.value) || startYear;

                    tasks.push({
                        id: 'budget_' + itemId,
                        name: itemName,
                        lead_entity: itemLead,
                        start_month: itemStartMonth,
                        start_year: itemStartYear,
                        duration_months: itemDuration,
                        is_budget: true
                    });
                });
            }
        }
    });

    const saveTasks = tasks.filter(t => !t.is_budget).map(t => ({
        id: t.id,
        lead_entity: t.lead_entity,
        start_month: t.start_month,
        start_year: t.start_year,
        duration_months: t.duration_months
    }));

    const budgetTimings = {};
    tasks.filter(t => t.is_budget).forEach(t => {
        const rawId = t.id.replace('budget_', '');
        budgetTimings[rawId] = {
            start_month: t.start_month,
            start_year: t.start_year,
            duration_months: t.duration_months
        };
    });

    fetch('/api/proposal/' + proposalId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: saveTasks, budget_item_timings: budgetTimings })
    })
    .then(() => renderGantt(tasks));
}

function monthsBetween(year1, month1, year2, month2) {
    return (year2 - year1) * 12 + (month2 - month1);
}

function renderGantt(tasks) {
    const container = document.getElementById('gantt-chart');
    if (!tasks.length) {
        container.innerHTML = '<div class="gantt-placeholder">No tasks to display.</div>';
        return;
    }

    const projectStartMonth = parseInt(document.getElementById('start-month')?.value) || 1;
    const projectStartYear = parseInt(document.getElementById('start-year')?.value) || 2025;

    let maxEnd = 0;
    tasks.forEach(t => {
        const offset = monthsBetween(projectStartYear, projectStartMonth, t.start_year, t.start_month);
        const end = offset + (t.duration_months || 1);
        if (end > maxEnd) maxEnd = end;
    });
    const maxMonths = Math.max(12, Math.min(60, maxEnd));
    const monthWidth = 60;

    const startDate = new Date(projectStartYear, projectStartMonth - 1, 1);

    const months = [];
    for (let i = 0; i < maxMonths; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        months.push({
            label: d.toLocaleString('default', { month: 'short' }),
            year: d.getFullYear(),
            monthIndex: i,
            isFirstOfMonth: i === 0 || months[i - 1]?.year !== d.getFullYear()
        });
    }

    let yearHTML = '<div class="gantt-year-row"><div class="gantt-label-col"></div><div class="gantt-year-cells">';
    let currentYear = null;
    let yearStartIdx = 0;
    months.forEach((m, i) => {
        if (m.isFirstOfMonth || i === 0) {
            if (currentYear !== null) {
                const span = i - yearStartIdx;
                yearHTML += `<div class="gantt-year-cell" style="min-width:${span * monthWidth}px;flex:${span}">${currentYear}</div>`;
            }
            currentYear = m.year;
            yearStartIdx = i;
        }
    });
    if (currentYear !== null) {
        const span = months.length - yearStartIdx;
        yearHTML += `<div class="gantt-year-cell" style="min-width:${span * monthWidth}px;flex:${span}">${currentYear}</div>`;
    }
    yearHTML += '</div></div>';

    let headerHTML = '<div class="gantt-header"><div class="gantt-label-col"></div><div class="gantt-month-cells">';
    months.forEach(m => {
        headerHTML += `<div class="gantt-month${m.isFirstOfMonth ? ' gantt-month-year-start' : ''}" style="min-width:${monthWidth}px">${m.label}</div>`;
    });
    headerHTML += '</div></div>';

    let rowsHTML = '';
    tasks.forEach(task => {
        const lead = monthsBetween(projectStartYear, projectStartMonth, task.start_year, task.start_month);
        const duration = task.duration_months || 1;
        const entityLabel = task.lead_entity ? ` (${task.lead_entity})` : '';
        const isBudget = task.is_budget;
        const rowClass = isBudget ? 'gantt-row gantt-row-budget' : 'gantt-row';
        const labelClass = isBudget ? 'gantt-row-label gantt-row-label-budget' : 'gantt-row-label';
        const barClass = isBudget ? 'gantt-bar gantt-bar-budget' : 'gantt-bar';

        rowsHTML += `<div class="${rowClass}">
            <div class="${labelClass}">${task.name}${entityLabel}</div>
            <div class="gantt-bar-container">`;

        for (let i = 0; i < maxMonths; i++) {
            const m = months[i];
            const yearBorder = m.isFirstOfMonth && i > 0 ? ' gantt-year-border' : '';
            if (i === lead) {
                rowsHTML += `<div class="gantt-cell${yearBorder}" style="min-width:${monthWidth}px">
                    <div class="${barClass}" style="width:${duration * monthWidth}px"></div>
                </div>`;
                i += duration - 1;
            } else if (i < lead || i >= lead + duration) {
                rowsHTML += `<div class="gantt-cell${yearBorder}" style="min-width:${monthWidth}px"></div>`;
            }
        }

        rowsHTML += '</div></div>';
    });

    container.innerHTML = yearHTML + headerHTML + rowsHTML;
}

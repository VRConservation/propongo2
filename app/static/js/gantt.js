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

function updateStartDate(proposalId) {
    const month = document.getElementById('start-month').value;
    const year = document.getElementById('start-year').value;
    const startDate = year + '-' + String(month).padStart(2, '0') + '-01';

    fetch('/api/proposal/' + proposalId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate })
    });
}

let autoSaveTimelineTimer = null;

function autoSaveTimeline(proposalId) {
    clearTimeout(autoSaveTimelineTimer);
    autoSaveTimelineTimer = setTimeout(function() {
        const inputs = document.getElementById('timeline-inputs');
        if (!inputs) return;

        const useDays = document.getElementById('timeline-use-days')?.checked;
        const showBudget = document.getElementById('timeline-show-budget')?.checked;
        const projectStartMonth = parseInt(document.getElementById('start-month').value) || 1;
        const projectStartYear = parseInt(document.getElementById('start-year').value) || 2025;
        const startDate = projectStartYear + '-' + String(projectStartMonth).padStart(2, '0') + '-01';

        const saveTasks = [];
        const budgetTimings = {};
        const taskBudgetItems = {};

        inputs.querySelectorAll('.timeline-input-card:not(.budget-timeline-item)').forEach(card => {
            const taskId = card.dataset.taskId;
            taskBudgetItems[taskId] = [];
        });

        if (showBudget) {
            inputs.querySelectorAll('.budget-timeline-item').forEach(sub => {
                const taskId = sub.dataset.taskId;
                if (!taskBudgetItems[taskId]) taskBudgetItems[taskId] = [];
                let itemDuration = parseInt(sub.querySelector('.duration-months').value) || 1;
                if (useDays) itemDuration = Math.ceil(itemDuration / 30);
                const itemStartMonth = parseInt(sub.querySelector('.item-start-month')?.value) || projectStartMonth;
                const itemStartYear = parseInt(sub.querySelector('.item-start-year')?.value) || projectStartYear;
                taskBudgetItems[taskId].push({
                    start_month: itemStartMonth,
                    start_year: itemStartYear,
                    duration_months: itemDuration
                });
                budgetTimings[sub.dataset.itemId] = {
                    start_month: itemStartMonth,
                    start_year: itemStartYear,
                    duration_months: itemDuration
                };
            });
        }

        inputs.querySelectorAll('.timeline-input-card:not(.budget-timeline-item)').forEach(card => {
            const taskId = card.dataset.taskId;
            const leadEntity = card.querySelector('.lead-entity')?.value || '';
            const items = taskBudgetItems[taskId] || [];

            let taskStartMonth = projectStartMonth;
            let taskStartYear = projectStartYear;
            let taskDuration = 1;

            if (items.length > 0) {
                let minOffset = Infinity;
                let maxEnd = -Infinity;
                items.forEach(item => {
                    const offset = (item.start_year - projectStartYear) * 12 + (item.start_month - projectStartMonth);
                    const end = offset + item.duration_months;
                    if (offset < minOffset) minOffset = offset;
                    if (end > maxEnd) maxEnd = end;
                });
                const absStart = projectStartMonth + minOffset - 1;
                taskStartMonth = (absStart % 12) + 1;
                taskStartYear = projectStartYear + Math.floor(absStart / 12);
                taskDuration = maxEnd - minOffset;
                if (taskDuration < 1) taskDuration = 1;
            }

            saveTasks.push({
                id: taskId,
                name: card.querySelector('.timeline-task-name').textContent,
                lead_entity: leadEntity,
                start_month: taskStartMonth,
                start_year: taskStartYear,
                duration_months: taskDuration
            });
        });

        fetch('/api/proposal/' + proposalId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tasks: saveTasks,
                budget_item_timings: budgetTimings,
                start_date: startDate,
                timeline_use_days: !!document.getElementById('timeline-use-days')?.checked,
                timeline_show_budget: !!document.getElementById('timeline-show-budget')?.checked
            })
        });
    }, 500);
}

function updateTimeline(proposalId) {
    const taskCards = document.querySelectorAll('#timeline-inputs > .timeline-input-card:not(.budget-timeline-item)');
    const showBudget = document.getElementById('timeline-show-budget')?.checked;
    const useDays = document.getElementById('timeline-use-days')?.checked;
    ganttUseDays = useDays;

    const projectStartMonth = parseInt(document.getElementById('start-month').value) || 1;
    const projectStartYear = parseInt(document.getElementById('start-year').value) || 2025;
    const startDate = projectStartYear + '-' + String(projectStartMonth).padStart(2, '0') + '-01';

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
        name: t.name || '',
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
        body: JSON.stringify({
            tasks: saveTasks,
            budget_item_timings: budgetTimings,
            start_date: startDate,
            timeline_use_days: useDays,
            timeline_show_budget: showBudget
        })
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

    const taskItems = {};
    tasks.forEach(t => {
        if (t.is_budget) {
            const parentId = t.id.replace('budget_', '');
            if (!taskItems[parentId]) taskItems[parentId] = [];
            taskItems[parentId].push(t);
        }
    });

    tasks.forEach(task => {
        const lead = monthsBetween(projectStartYear, projectStartMonth, task.start_year, task.start_month);
        let duration = task.duration_months || 1;
        const entityLabel = task.lead_entity ? ` (${task.lead_entity})` : '';
        const isBudget = task.is_budget;

        if (!isBudget && taskItems[task.id] && taskItems[task.id].length > 0) {
            let minOffset = lead + duration;
            let maxEnd = lead;
            taskItems[task.id].forEach(item => {
                const itemLead = monthsBetween(projectStartYear, projectStartMonth, item.start_year, item.start_month);
                const itemEnd = itemLead + (item.duration_months || 1);
                if (itemLead < minOffset) minOffset = itemLead;
                if (itemEnd > maxEnd) maxEnd = itemEnd;
            });
            duration = maxEnd - minOffset;
            if (duration < 1) duration = 1;
            var taskLead = minOffset;
        } else {
            var taskLead = lead;
        }

        const rowClass = isBudget ? 'gantt-row gantt-row-budget' : 'gantt-row';
        const labelClass = isBudget ? 'gantt-row-label gantt-row-label-budget' : 'gantt-row-label';
        const barClass = isBudget ? 'gantt-bar gantt-bar-budget' : 'gantt-bar';

        rowsHTML += `<div class="${rowClass}">
            <div class="${labelClass}">${task.name}${entityLabel}</div>
            <div class="gantt-bar-container">`;

        for (let i = 0; i < maxMonths; i++) {
            const m = months[i];
            const yearBorder = m.isFirstOfMonth && i > 0 ? ' gantt-year-border' : '';
            if (i === taskLead) {
                rowsHTML += `<div class="gantt-cell${yearBorder}" style="min-width:${monthWidth}px">
                    <div class="${barClass}" style="width:${duration * monthWidth}px"></div>
                </div>`;
                i += duration - 1;
            } else if (i < taskLead || i >= taskLead + duration) {
                rowsHTML += `<div class="gantt-cell${yearBorder}" style="min-width:${monthWidth}px"></div>`;
            }
        }

        rowsHTML += '</div></div>';
    });

    container.innerHTML = yearHTML + headerHTML + rowsHTML;
}

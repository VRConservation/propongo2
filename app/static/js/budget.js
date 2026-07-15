function formatCurrency(num) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function deleteBudgetItem(proposalId, itemId, btn) {
    if (!confirm('Delete this budget item?')) return;
    fetch('/api/budget/' + proposalId + '/' + itemId, { method: 'DELETE' })
        .then(() => {
            const card = btn.closest('.budget-item-card');
            if (card) card.remove();
            checkEmptyGroups();
        });
}

function addBudgetItem(proposalId) {
    const taskId = document.getElementById('budget-task-select').value;
    const name = document.getElementById('budget-item-name').value.trim();
    const costPerUnit = parseFloat(document.getElementById('budget-cost').value) || 0;
    const units = parseFloat(document.getElementById('budget-units').value) || 1;

    if (!taskId || !name) {
        alert('Select a task and enter an item name.');
        return;
    }

    fetch('/api/budget/' + proposalId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            task_id: taskId,
            name: name,
            cost_per_unit: costPerUnit,
            units: units,
        })
    })
    .then(r => r.json())
    .then(item => {
        const list = document.getElementById('budget-item-list');
        const emptyMsg = list.querySelector('.empty-text');
        if (emptyMsg) emptyMsg.remove();

        const taskSelect = document.getElementById('budget-task-select');
        const taskName = taskSelect.options[taskSelect.selectedIndex].text;

        const card = document.createElement('div');
        card.className = 'budget-item-card';
        card.dataset.itemId = item.id;
        card.dataset.taskId = item.task_id;
        card.dataset.name = item.name;
        card.dataset.cost = item.cost_per_unit;
        card.dataset.units = item.units;
        card.innerHTML = `
            <div class="budget-item-info">
                <span class="budget-item-name">${item.name}</span>
            </div>
            <div class="budget-item-numbers">
                <span>${formatCurrency(item.cost_per_unit)}/unit &times; ${item.units} units</span>
                <span class="budget-item-total">${formatCurrency(item.cost_per_unit * item.units)}</span>
            </div>
            <div class="budget-item-actions">
                <button class="btn-icon" onclick="editBudgetItem('${proposalId}', this)" title="Edit">&#9998;</button>
                <button class="btn-icon btn-danger-icon"
                        onclick="deleteBudgetItem('${proposalId}', '${item.id}', this)">&times;</button>
            </div>
        `;
        htmx.process(card);

        let group = list.querySelector(`.budget-task-group[data-task-id="${taskId}"]`);
        if (!group) {
            group = document.createElement('div');
            group.className = 'budget-task-group';
            group.dataset.taskId = taskId;
            group.innerHTML = `
                <div class="budget-task-header">
                    <span class="budget-task-name">${taskName}</span>
                    <span class="budget-task-subtotal" data-task-id="${taskId}">$0</span>
                </div>
            `;
            list.appendChild(group);
        }

        group.appendChild(card);

        document.getElementById('budget-item-name').value = '';
        document.getElementById('budget-cost').value = '';
        document.getElementById('budget-units').value = '1';

        updateBudgetTotal();
    });
}

function editBudgetItem(proposalId, btn) {
    const card = btn.closest('.budget-item-card');
    if (card.querySelector('.budget-item-edit-form')) return;

    const taskId = card.dataset.taskId;
    const name = card.dataset.name;
    const cost = card.dataset.cost;
    const units = card.dataset.units;

    const taskSelect = document.getElementById('budget-task-select');
    let taskOptions = '';
    for (const opt of taskSelect.options) {
        if (opt.value) {
            taskOptions += `<option value="${opt.value}" ${opt.value === taskId ? 'selected' : ''}>${opt.text}</option>`;
        }
    }

    const info = card.querySelector('.budget-item-info');
    const numbers = card.querySelector('.budget-item-numbers');
    const actions = card.querySelector('.budget-item-actions');

    info.style.display = 'none';
    numbers.style.display = 'none';
    actions.style.display = 'none';

    const form = document.createElement('div');
    form.className = 'budget-item-edit-form';
    form.innerHTML = `
        <select class="edit-task-id">${taskOptions}</select>
        <input type="text" class="edit-name flex-grow" value="${name}" placeholder="Item name">
        <input type="number" class="edit-cost" value="${cost}" min="0" step="0.01" placeholder="Cost/unit">
        <input type="number" class="edit-units" value="${units}" min="0" step="1" placeholder="Units">
        <div class="budget-item-edit-actions">
            <button class="btn btn-primary btn-sm" onclick="saveBudgetItem('${proposalId}', this)">Save</button>
            <button class="btn btn-sm" onclick="cancelEditBudgetItem(this)">Cancel</button>
        </div>
    `;
    card.insertBefore(form, actions);
}

function saveBudgetItem(proposalId, btn) {
    const card = btn.closest('.budget-item-card');
    const form = card.querySelector('.budget-item-edit-form');

    const data = {
        task_id: form.querySelector('.edit-task-id').value,
        name: form.querySelector('.edit-name').value.trim(),
        cost_per_unit: parseFloat(form.querySelector('.edit-cost').value) || 0,
        units: parseFloat(form.querySelector('.edit-units').value) || 1,
    };

    if (!data.task_id || !data.name) {
        alert('Select a task and enter an item name.');
        return;
    }

    fetch(`/api/budget/${proposalId}/${card.dataset.itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    .then(r => r.json())
    .then(() => {
        const taskSelect = document.getElementById('budget-task-select');
        let taskName = '';
        for (const opt of taskSelect.options) {
            if (opt.value === data.task_id) {
                taskName = opt.text;
                break;
            }
        }

        const oldTaskId = card.dataset.taskId;
        card.dataset.taskId = data.task_id;
        card.dataset.name = data.name;
        card.dataset.cost = data.cost_per_unit;
        card.dataset.units = data.units;

        const info = card.querySelector('.budget-item-info');
        const numbers = card.querySelector('.budget-item-numbers');
        const actions = card.querySelector('.budget-item-actions');

        info.querySelector('.budget-item-name').textContent = data.name;
        numbers.querySelector('span:first-child').innerHTML =
            `${formatCurrency(data.cost_per_unit)}/unit &times; ${data.units} units`;
        numbers.querySelector('.budget-item-total').textContent =
            `${formatCurrency(data.cost_per_unit * data.units)}`;

        form.remove();
        info.style.display = '';
        numbers.style.display = '';
        actions.style.display = '';

        if (oldTaskId !== data.task_id) {
            moveCardToGroup(card, data.task_id, taskName);
            checkEmptyGroups();
        }

        updateBudgetTotal();
    });
}

function moveCardToGroup(card, newTaskId, taskName) {
    const list = document.getElementById('budget-item-list');
    let group = list.querySelector(`.budget-task-group[data-task-id="${newTaskId}"]`);

    if (!group) {
        group = document.createElement('div');
        group.className = 'budget-task-group';
        group.dataset.taskId = newTaskId;
        group.innerHTML = `
            <div class="budget-task-header">
                <span class="budget-task-name">${taskName}</span>
                <span class="budget-task-subtotal" data-task-id="${newTaskId}">$0</span>
            </div>
        `;
        list.appendChild(group);
    }

    group.appendChild(card);
}

function cancelEditBudgetItem(btn) {
    const card = btn.closest('.budget-item-card');
    const form = card.querySelector('.budget-item-edit-form');

    form.remove();
    card.querySelector('.budget-item-info').style.display = '';
    card.querySelector('.budget-item-numbers').style.display = '';
    card.querySelector('.budget-item-actions').style.display = '';
}

function checkEmptyGroups() {
    setTimeout(() => {
        document.querySelectorAll('.budget-task-group').forEach(group => {
            if (!group.querySelector('.budget-item-card')) {
                group.remove();
            }
        });
        updateBudgetTotal();
    }, 50);
}

function updateBudgetTotal() {
    document.querySelectorAll('.budget-task-group').forEach(group => {
        let subtotal = 0;
        group.querySelectorAll('.budget-item-total').forEach(el => {
            subtotal += parseFloat(el.textContent.replace(/[$,]/g, '')) || 0;
        });
        const subtotalEl = group.querySelector('.budget-task-subtotal');
        if (subtotalEl) {
            subtotalEl.textContent = '$' + formatCurrency(subtotal);
        }
    });

    let total = 0;
    document.querySelectorAll('.budget-item-total').forEach(el => {
        total += parseFloat(el.textContent.replace(/[$,]/g, '')) || 0;
    });
    document.getElementById('budget-total').textContent = '$' + formatCurrency(total);

    const indirectInput = document.getElementById('indirect-percent');
    const percent = indirectInput ? (parseFloat(indirectInput.value) || 0) : 0;
    const indirectAmount = total * (percent / 100);
    const totalWithIndirect = total + indirectAmount;

    const indirectAmountEl = document.getElementById('indirect-amount');
    if (indirectAmountEl) {
        indirectAmountEl.textContent = '$' + formatCurrency(indirectAmount);
    }

    const indirectLabel = document.getElementById('indirect-label');
    if (indirectLabel) {
        indirectLabel.textContent = `Indirect (${Math.round(percent)}%)`;
    }

    const totalWithIndirectEl = document.getElementById('budget-total-with-indirect');
    if (totalWithIndirectEl) {
        totalWithIndirectEl.textContent = '$' + formatCurrency(totalWithIndirect);
    }
}

function updateIndirect(proposalId) {
    const percentInput = document.getElementById('indirect-percent');
    const percent = parseFloat(percentInput.value) || 0;

    fetch('/api/proposal/' + proposalId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indirect_percent: percent })
    });

    updateBudgetTotal();
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.budget-item-card').forEach(card => {
        card.querySelector('.btn-icon')?.addEventListener('click', () => {
            setTimeout(updateBudgetTotal, 100);
        });
    });
});

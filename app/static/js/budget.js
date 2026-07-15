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

        const card = document.createElement('div');
        card.className = 'budget-item-card';
        card.dataset.itemId = item.id;
        card.innerHTML = `
            <div class="budget-item-info">
                <span class="budget-item-name">${item.name}</span>
            </div>
            <div class="budget-item-numbers">
                <span>$${item.cost_per_unit.toFixed(2)}/unit &times; ${item.units} units</span>
                <span class="budget-item-total">$${(item.cost_per_unit * item.units).toFixed(2)}</span>
            </div>
            <button class="btn-icon btn-danger-icon"
                    hx-delete="/api/budget/${proposalId}/${item.id}"
                    hx-target="closest .budget-item-card"
                    hx-swap="outerHTML">&times;</button>
        `;
        list.appendChild(card);
        htmx.process(card);

        document.getElementById('budget-item-name').value = '';
        document.getElementById('budget-cost').value = '';
        document.getElementById('budget-units').value = '1';

        updateBudgetTotal();
    });
}

function updateBudgetTotal() {
    const totals = document.querySelectorAll('.budget-item-total');
    let total = 0;
    totals.forEach(el => {
        total += parseFloat(el.textContent.replace('$', '')) || 0;
    });
    document.getElementById('budget-total').textContent = '$' + total.toFixed(2);
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.budget-item-card').forEach(card => {
        card.querySelector('.btn-icon')?.addEventListener('click', () => {
            setTimeout(updateBudgetTotal, 100);
        });
    });
});

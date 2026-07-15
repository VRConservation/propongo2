function toggleSidebar() {
    const sidebar = document.getElementById('snippet-sidebar');
    const main = document.querySelector('.main-content');
    sidebar.classList.toggle('open');
    main.classList.toggle('sidebar-open');
}

function activateTab(btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function exportProposal(proposalId, format) {
    if (format === 'pdf') {
        window.open('/export/pdf/' + proposalId, '_blank');
    } else if (format === 'html') {
        window.open('/export/html/' + proposalId, '_blank');
    }
}

function loadProposalList() {
    const modal = document.getElementById('proposal-modal');
    const body = document.getElementById('proposal-list-body');
    modal.classList.remove('hidden');

    fetch('/api/proposals')
        .then(r => r.json())
        .then(proposals => {
            if (proposals.length === 0) {
                body.innerHTML = '<p style="text-align:center;color:#64748b;">No proposals yet.</p>';
                return;
            }
            body.innerHTML = proposals.map(p => `
                <div class="proposal-card" style="margin-bottom:8px;">
                    <h3 style="font-size:14px;">${p.title || 'Untitled'}</h3>
                    <p style="font-size:12px;color:#64748b;">${p.client_name || 'No client'} &middot; ${p.updated_at ? p.updated_at.slice(0,10) : ''}</p>
                    <div class="card-actions" style="margin-top:8px;">
                        <a href="/editor/${p.id}" class="btn btn-primary btn-sm">Edit</a>
                        <button class="btn btn-danger btn-sm" onclick="deleteProposal('${p.id}')">Delete</button>
                    </div>
                </div>
            `).join('');
        });
}

function closeModal() {
    document.getElementById('proposal-modal').classList.add('hidden');
}

function deleteProposal(id) {
    if (!confirm('Delete this proposal?')) return;
    fetch('/api/proposal/' + id, { method: 'DELETE' })
        .then(() => {
            const card = document.querySelector(`[data-proposal-id="${id}"]`);
            if (card) card.remove();
            const currentPath = window.location.pathname;
            if (currentPath.includes(id)) {
                window.location.href = '/';
            } else {
                loadProposalList();
            }
        });
}

function addTask(proposalId) {
    const nameInput = document.getElementById('new-task-name');
    const descInput = document.getElementById('new-task-desc');
    const name = nameInput.value.trim();
    const description = descInput ? descInput.value.trim() : '';
    if (!name) return;

    fetch('/api/task/' + proposalId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, description: description })
    })
    .then(r => r.json())
    .then(task => {
        const taskList = document.getElementById('task-list');
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id;
        card.innerHTML = `
            <div class="task-header">
                <input type="text" class="task-name-input" value="${task.name}"
                       placeholder="Task name"
                       hx-trigger="keyup changed delay:500ms, change"
                       hx-put="/api/proposal/${proposalId}"
                       hx-vals='{"tasks": "JS(getUpdatedTasks())"}'>
                <button class="btn-icon btn-danger-icon"
                        hx-delete="/api/task/${proposalId}/${task.id}"
                        hx-target="closest .task-card"
                        hx-swap="outerHTML"
                        hx-confirm="Remove this task and its budget items?">&times;</button>
            </div>
            <textarea class="task-desc-input" rows="2"
                      placeholder="Task description..."
                      hx-trigger="keyup changed delay:1000ms, change"
                      hx-put="/api/proposal/${proposalId}"
                      hx-vals='{"tasks": "JS(getUpdatedTasks())"}'>${task.description || ''}</textarea>
        `;
        taskList.appendChild(card);
        htmx.process(card);
        nameInput.value = '';
        if (descInput) descInput.value = '';
        const newName = card.querySelector('.task-name-input');
        if (newName) newName.focus();
    });
}

function getUpdatedTasks() {
    const cards = document.querySelectorAll('.task-card');
    const tasks = [];
    cards.forEach(card => {
        tasks.push({
            id: card.dataset.taskId,
            name: card.querySelector('.task-name-input').value,
            description: card.querySelector('.task-desc-input').value,
        });
    });
    return JSON.stringify(tasks);
}

function openSaveAsModal() {
    const modal = document.getElementById('save-as-modal');
    const input = document.getElementById('save-as-title');
    input.value = document.getElementById('proposal-title').value;
    modal.classList.remove('hidden');
    input.focus();
    input.select();
}

function closeSaveAsModal() {
    document.getElementById('save-as-modal').classList.add('hidden');
}

function saveProposalAs() {
    const title = document.getElementById('save-as-title').value.trim();
    if (!title) {
        alert('Please enter a title.');
        return;
    }

    const proposalId = window.location.pathname.split('/').pop();

    fetch('/api/proposal/' + proposalId + '/save-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title })
    })
    .then(r => r.json())
    .then(data => {
        if (data.id) {
            window.location.href = '/editor/' + data.id;
        } else {
            alert(data.error || 'Failed to save.');
        }
    });
}

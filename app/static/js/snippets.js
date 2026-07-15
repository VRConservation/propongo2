document.addEventListener('DOMContentLoaded', loadSnippets);

function loadSnippets() {
    fetch('/snippets')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('snippet-list');
            if (!container) return;

            let html = '';

            if (data.organization && data.organization.length) {
                html += '<div class="snippet-category"><h4>Organization</h4>';
                data.organization.forEach(s => {
                    html += snippetHTML(s, 'organization');
                });
                html += '</div>';
            }

            if (data.deliverables && data.deliverables.length) {
                html += '<div class="snippet-category"><h4>Deliverables</h4>';
                data.deliverables.forEach(s => {
                    html += snippetHTML(s, 'deliverables');
                });
                html += '</div>';
            }

            if (data.custom && data.custom.length) {
                html += '<div class="snippet-category"><h4>Custom</h4>';
                data.custom.forEach(s => {
                    html += snippetHTML(s, 'custom');
                });
                html += '</div>';
            }

            html += `
                <div class="snippet-add-form">
                    <h4 style="margin-bottom:8px;font-size:13px;">Add Custom Snippet</h4>
                    <input type="text" id="new-snippet-title" placeholder="Title">
                    <textarea id="new-snippet-content" rows="3" placeholder="Markdown content..."></textarea>
                    <button class="btn btn-primary btn-sm" onclick="addCustomSnippet()" style="width:100%">Add Snippet</button>
                </div>
            `;

            container.innerHTML = html || '<p class="snippet-loading">No snippets yet. Add one below.</p>';
        });
}

function snippetHTML(snippet, category) {
    const preview = snippet.content ? snippet.content.substring(0, 80) + (snippet.content.length > 80 ? '...' : '') : '';
    return `
        <div class="snippet-item" onclick="insertSnippet('${escapeAttr(snippet.content)}')">
            <div class="snippet-title">${escapeHTML(snippet.title)}
                <button class="btn-icon btn-danger-icon snippet-delete btn-sm"
                        onclick="event.stopPropagation(); deleteSnippet('${category}', '${snippet.id}')">&times;</button>
            </div>
            <div class="snippet-preview">${escapeHTML(preview)}</div>
        </div>
    `;
}

function insertSnippet(content) {
    const decoded = content.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');

    // Find the currently focused textarea
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
        const start = active.selectionStart;
        const end = active.selectionEnd;
        const before = active.value.substring(0, start);
        const after = active.value.substring(end);
        active.value = before + decoded + after;
        active.selectionStart = active.selectionEnd = start + decoded.length;
        active.focus();
        active.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        navigator.clipboard.writeText(decoded).then(() => {
            const btn = event?.target;
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = orig, 1500);
            }
        });
    }
}

function addCustomSnippet() {
    const title = document.getElementById('new-snippet-title').value.trim();
    const content = document.getElementById('new-snippet-content').value.trim();
    if (!title || !content) {
        alert('Enter a title and content.');
        return;
    }

    fetch('/snippets/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
    })
    .then(() => {
        document.getElementById('new-snippet-title').value = '';
        document.getElementById('new-snippet-content').value = '';
        loadSnippets();
    });
}

function deleteSnippet(category, id) {
    if (!confirm('Delete this snippet?')) return;
    fetch(`/snippets/${category}/${id}`, { method: 'DELETE' })
        .then(() => loadSnippets());
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

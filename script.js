const STORAGE_KEY = 'vanilla-todos';
const CATEGORY_OPTIONS = ['Study', 'Work', 'Personal', 'Shopping', 'Health', 'Other'];
const THEME_KEY = 'todo-theme';
const SORT_KEY = 'todo-sort';

const dom = {
    todoInput: document.getElementById('todoInput'),
    todoDueDate: document.getElementById('todoDueDate'),
    todoPriority: document.getElementById('todoPriority'),
    todoCategoryInput: document.getElementById('todoCategoryInput'),
    addBtn: document.getElementById('addBtn'),
    todoList: document.getElementById('todoList'),
    clearBtn: document.getElementById('clearBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    emptyState: document.getElementById('emptyState'),
    emptyAddBtn: document.getElementById('emptyAddBtn'),
    filterButtons: document.querySelector('.chip-group'),
    totalCount: document.getElementById('totalCount'),
    activeCount: document.getElementById('activeCount'),
    completedCount: document.getElementById('completedCount'),
    completionPercent: document.getElementById('completionPercent'),
    progressBar: document.getElementById('progressBar'),
    progressLabel: document.getElementById('progressLabel'),
    progressComplete: document.getElementById('progressComplete'),
    progressRemaining: document.getElementById('progressRemaining'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    themeToggle: document.getElementById('themeToggle'),
    toastContainer: document.getElementById('toastContainer'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalDialog: document.getElementById('modalDialog'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalActions: document.getElementById('modalActions'),
    modalCloseBtn: document.getElementById('modalCloseBtn')
};

let todos = [];
let currentFilter = 'all';
let currentSort = localStorage.getItem(SORT_KEY) || 'newest';
let searchTerm = '';
let theme = localStorage.getItem(THEME_KEY) || 'light';
let modalState = { type: null, todoId: null };
let draggedTodoId = null;


document.addEventListener('DOMContentLoaded', init);

document.addEventListener('keydown', handleGlobalKeydown);

function init() {
    loadTheme();
    loadTodos();
    bindEvents();
    render();
}

function bindEvents() {
    dom.addBtn.addEventListener('click', handleAddTodo);
    dom.emptyAddBtn.addEventListener('click', () => dom.todoInput.focus());

    dom.todoInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAddTodo();
        }
    });

    dom.clearBtn.addEventListener('click', () => openModal('clear', null));
    dom.searchInput.addEventListener('input', (event) => {
        searchTerm = event.target.value.trim().toLowerCase();
        render();
    });

    dom.sortSelect.addEventListener('change', (event) => {
        currentSort = event.target.value;
        localStorage.setItem(SORT_KEY, currentSort);
        render();
    });

    dom.filterButtons.addEventListener('click', handleFilterClick);
    dom.themeToggle.addEventListener('click', toggleTheme);
    dom.exportBtn.addEventListener('click', () => {
        window.exportTodos();
        showToast('Tasks exported', 'success');
    });
    dom.importBtn.addEventListener('click', () => window.importTodos());
    dom.todoList.addEventListener('click', handleTodoListClick);
    dom.todoList.addEventListener('change', handleTodoListChange);
    dom.todoList.addEventListener('dragstart', handleDragStart);
    dom.todoList.addEventListener('dragover', handleDragOver);
    dom.todoList.addEventListener('drop', handleDrop);
    dom.todoList.addEventListener('dragend', handleDragEnd);
    dom.modalBackdrop.addEventListener('click', (event) => {
        if (event.target === dom.modalBackdrop) {
            closeModal();
        }
    });
    dom.modalCloseBtn.addEventListener('click', closeModal);
}

function handleAddTodo() {
    const title = dom.todoInput.value.trim();

    if (!title) {
        dom.todoInput.focus();
        showToast('Please enter a task title.', 'warning');
        return;
    }

    const todo = {
        id: Date.now(),
        text: title,
        completed: false,
        priority: dom.todoPriority.value,
        category: normalizeCategory(dom.todoCategoryInput.value),
        dueDate: dom.todoDueDate.value,
        createdAt: new Date().toLocaleString(),
        createdAtTimestamp: Date.now(),
        updatedAt: ''
    };

    todos.unshift(todo);
    persistTodos();
    dom.todoInput.value = '';
    dom.todoDueDate.value = '';
    dom.todoPriority.value = 'Medium';
    dom.todoCategoryInput.value = '';
    render();
    dom.todoInput.focus();
    showToast('Task added', 'success');
}

function handleFilterClick(event) {
    const button = event.target.closest('.filter-btn');
    if (!button) {
        return;
    }

    currentFilter = button.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn === button);
    });
    render();
}

function handleTodoListClick(event) {
    const button = event.target.closest('button');
    if (!button) {
        return;
    }

    const item = event.target.closest('.todo-item');
    if (!item) {
        return;
    }

    const todoId = Number(item.dataset.id);

    if (button.classList.contains('edit-btn')) {
        openModal('edit', todoId);
    } else if (button.classList.contains('delete-btn')) {
        openModal('delete', todoId);
    }
}

function handleTodoListChange(event) {
    const checkbox = event.target.closest('.todo-checkbox');
    if (!checkbox) {
        return;
    }

    toggleTodo(Number(checkbox.dataset.id));
}

function handleDragStart(event) {
    const item = event.target.closest('.todo-item');
    if (!item) {
        return;
    }

    draggedTodoId = Number(item.dataset.id);
    item.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(draggedTodoId));
}

function handleDragOver(event) {
    const item = event.target.closest('.todo-item');
    if (!item || Number(item.dataset.id) === draggedTodoId) {
        return;
    }

    event.preventDefault();
    document.querySelectorAll('.todo-item').forEach((entry) => entry.classList.remove('drag-over'));
    item.classList.add('drag-over');
    event.dataTransfer.dropEffect = 'move';
}

function handleDrop(event) {
    const item = event.target.closest('.todo-item');
    if (!item || draggedTodoId === null) {
        return;
    }

    event.preventDefault();
    const targetId = Number(item.dataset.id);
    reorderTodos(draggedTodoId, targetId);
    document.querySelectorAll('.todo-item').forEach((entry) => entry.classList.remove('drag-over'));
    draggedTodoId = null;
    render();
    showToast('Task reordered', 'success');
}

function handleDragEnd(event) {
    document.querySelectorAll('.todo-item').forEach((entry) => entry.classList.remove('dragging', 'drag-over'));
    draggedTodoId = null;
}

function reorderTodos(fromId, toId) {
    const fromIndex = todos.findIndex((todo) => todo.id === fromId);
    const toIndex = todos.findIndex((todo) => todo.id === toId);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return;
    }

    const [movedItem] = todos.splice(fromIndex, 1);
    todos.splice(toIndex, 0, movedItem);
    persistTodos();
}

function openModal(type, todoId) {
    modalState = { type, todoId };
    renderModal();
}

function closeModal() {
    modalState = { type: null, todoId: null };
    dom.modalBackdrop.classList.remove('show');
    dom.modalDialog.classList.remove('show');
    document.body.classList.remove('modal-open');
    dom.modalBody.innerHTML = '';
    dom.modalActions.innerHTML = '';
}

function renderModal() {
    if (!modalState.type) {
        return;
    }

    if (modalState.type === 'edit') {
        const todo = todos.find((entry) => entry.id === modalState.todoId);
        if (!todo) {
            closeModal();
            return;
        }

        dom.modalTitle.textContent = 'Edit Task';
        dom.modalBody.innerHTML = createEditModalMarkup(todo);
        dom.modalActions.innerHTML = `
            <button class="modal-action-btn ghost" type="button" data-action="cancel">Cancel</button>
            <button class="modal-action-btn primary" type="submit" form="editTaskForm">Save Changes</button>
        `;
        dom.modalBackdrop.classList.add('show');
        dom.modalDialog.classList.add('show');
        document.body.classList.add('modal-open');

        const form = dom.modalBody.querySelector('#editTaskForm');
        form.addEventListener('submit', handleEditSubmit);
        dom.modalActions.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
        requestAnimationFrame(() => form.querySelector('input').focus());
        return;
    }

    dom.modalTitle.textContent = modalState.type === 'delete' ? 'Delete Task' : 'Clear Completed';
    dom.modalBody.innerHTML = `
        <p class="confirm-copy">
            ${modalState.type === 'delete'
                ? 'This task will be removed permanently from your list.'
                : 'All completed tasks will be removed from your list.'}
        </p>
    `;
    dom.modalActions.innerHTML = `
        <button class="modal-action-btn ghost" type="button" data-action="cancel">Cancel</button>
        <button class="modal-action-btn primary" type="button" data-action="confirm">Confirm</button>
    `;
    dom.modalBackdrop.classList.add('show');
    dom.modalDialog.classList.add('show');
    document.body.classList.add('modal-open');

    dom.modalActions.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
    dom.modalActions.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        if (modalState.type === 'delete') {
            deleteTodo(modalState.todoId);
        } else {
            clearCompleted();
        }
        closeModal();
    });
}

function handleEditSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = form.querySelector('#editTitle').value.trim();
    const dueDate = form.querySelector('#editDueDate').value;
    const priority = form.querySelector('#editPriority').value;
    const category = normalizeCategory(form.querySelector('#editCategory').value);

    if (!title) {
        showToast('Task title cannot be empty.', 'warning');
        return;
    }

    const todo = todos.find((entry) => entry.id === modalState.todoId);
    if (!todo) {
        return;
    }

    todo.text = title;
    todo.dueDate = dueDate;
    todo.priority = priority;
    todo.category = category;
    todo.updatedAt = new Date().toLocaleString();
    persistTodos();
    render();
    closeModal();
    showToast('Task updated', 'success');
}

function toggleTodo(todoId) {
    const todo = todos.find((entry) => entry.id === todoId);
    if (!todo) {
        return;
    }

    todo.completed = !todo.completed;
    todo.updatedAt = new Date().toLocaleString();
    persistTodos();
    render();
    showToast(todo.completed ? 'Task completed' : 'Task reopened', 'success');
}

function deleteTodo(todoId) {
    todos = todos.filter((entry) => entry.id !== todoId);
    persistTodos();
    render();
    showToast('Task deleted', 'success');
}

function clearCompleted() {
    const completedCount = todos.filter((todo) => todo.completed).length;
    if (!completedCount) {
        return;
    }

    todos = todos.filter((todo) => !todo.completed);
    persistTodos();
    render();
    showToast('Completed tasks cleared', 'success');
}

function getVisibleTodos() {
    const normalizedSearch = searchTerm.toLowerCase();
    let filteredTodos = todos.filter((todo) => matchesFilter(todo));

    if (normalizedSearch) {
        filteredTodos = filteredTodos.filter((todo) => {
            const haystack = `${todo.text} ${todo.category} ${todo.priority}`.toLowerCase();
            return haystack.includes(normalizedSearch);
        });
    }

    return sortTodos(filteredTodos);
}

function matchesFilter(todo) {
    switch (currentFilter) {
        case 'active':
            return !todo.completed;
        case 'completed':
            return todo.completed;
        case 'high-priority':
            return todo.priority === 'High';
        case 'today':
            return isDueToday(todo);
        case 'overdue':
            return isOverdue(todo);
        case 'study':
            return normalizeCategory(todo.category) === 'Study';
        case 'work':
            return normalizeCategory(todo.category) === 'Work';
        case 'personal':
            return normalizeCategory(todo.category) === 'Personal';
        default:
            return true;
    }
}

function sortTodos(taskList) {
    const sorted = [...taskList];

    switch (currentSort) {
        case 'oldest':
            return sorted.sort((a, b) => a.createdAtTimestamp - b.createdAtTimestamp);
        case 'az':
            return sorted.sort((a, b) => a.text.localeCompare(b.text));
        case 'za':
            return sorted.sort((a, b) => b.text.localeCompare(a.text));
        case 'priority':
            return sorted.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
        case 'due-date':
            return sorted.sort((a, b) => compareDueDate(a, b));
        case 'newest':
        default:
            return sorted.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
    }
}

function priorityWeight(priority) {
    return priority === 'High' ? 3 : priority === 'Medium' ? 2 : 1;
}

function compareDueDate(a, b) {
    if (!a.dueDate && !b.dueDate) {
        return 0;
    }
    if (!a.dueDate) {
        return 1;
    }
    if (!b.dueDate) {
        return -1;
    }
    return new Date(a.dueDate) - new Date(b.dueDate);
}

function render() {
    const visibleTodos = getVisibleTodos();
    dom.todoList.innerHTML = '';

    if (!todos.length || !visibleTodos.length) {
        dom.emptyState.classList.add('show');
        const title = dom.emptyState.querySelector('h2');
        const description = dom.emptyState.querySelector('p');
        if (!todos.length) {
            title.textContent = 'No tasks yet';
            description.textContent = 'Start by creating your first task and build momentum.';
        } else {
            title.textContent = 'No matching tasks';
            description.textContent = 'Try another search or filter.';
        }
    } else {
        dom.emptyState.classList.remove('show');
    }

    visibleTodos.forEach((todo) => {
        const item = document.createElement('li');
        item.className = `todo-item ${todo.completed ? 'completed' : ''} ${isOverdue(todo) ? 'overdue' : ''}`;
        item.dataset.id = todo.id;
        item.innerHTML = createTaskMarkup(todo);
        dom.todoList.appendChild(item);
    });

    updateDashboard();
    updateProgress();
    updateFilterButtons();
    dom.searchInput.value = searchTerm;
    dom.sortSelect.value = currentSort;
    dom.clearBtn.disabled = !todos.some((todo) => todo.completed);
}

function createTaskMarkup(todo) {
    const dueMeta = getDueMeta(todo);
    const titleMarkup = searchTerm ? highlightMatch(todo.text, searchTerm) : escapeHtml(todo.text);
    const createdDate = formatDate(todo.createdAtTimestamp);
    return `
        <div class="task-content">
            <div class="task-main">
                <label class="task-check">
                    <span class="drag-handle" aria-hidden="true">⋮⋮</span>
                    <input class="todo-checkbox" data-id="${todo.id}" type="checkbox" ${todo.completed ? 'checked' : ''}>
                    <span class="task-title">${titleMarkup}</span>
                </label>
                <div class="task-actions">
                    <button class="edit-btn" type="button">✎ Edit</button>
                    <button class="delete-btn" type="button">🗑 Delete</button>
                </div>
            </div>
            <div class="task-meta">
                <span class="badge priority-${priorityClass(todo.priority)}">${todo.priority || 'Medium'} ${priorityIcon(todo.priority)}</span>
                <span class="badge category-badge">📂 ${escapeHtml(normalizeCategory(todo.category))}</span>
                <span class="meta-pill ${dueMeta.className}">📅 ${dueMeta.label}</span>
                <span class="meta-pill due-upcoming">🕒 ${createdDate}</span>
                <span class="meta-pill ${todo.completed ? 'status-pill' : 'status-pill inactive'}">${todo.completed ? 'Completed' : 'Active'}</span>
            </div>
        </div>`;
}

function createEditModalMarkup(todo) {
    return `
        <form id="editTaskForm" class="modal-form">
            <label for="editTitle">
                Task title
                <input id="editTitle" name="editTitle" type="text" value="${escapeHtml(todo.text)}" maxlength="180" required>
            </label>
            <div class="modal-grid">
                <label for="editDueDate">
                    Due date
                    <input id="editDueDate" name="editDueDate" type="date" value="${todo.dueDate || ''}">
                </label>
                <label for="editPriority">
                    Priority
                    <select id="editPriority" name="editPriority">
                        <option value="High" ${todo.priority === 'High' ? 'selected' : ''}>High 🔴</option>
                        <option value="Medium" ${todo.priority === 'Medium' ? 'selected' : ''}>Medium 🟡</option>
                        <option value="Low" ${todo.priority === 'Low' ? 'selected' : ''}>Low 🟢</option>
                    </select>
                </label>
                <label for="editCategory">
                    Category
                    <input id="editCategory" name="editCategory" type="text" value="${escapeHtml(normalizeCategory(todo.category))}" list="categoryOptions" maxlength="40">
                </label>
            </div>
        </form>
    `;
}

function updateDashboard() {
    const total = todos.length;
    const completed = todos.filter((todo) => todo.completed).length;
    const pending = total - completed;
    const percent = total ? Math.round((completed / total) * 100) : 0;

    animateNumber(dom.totalCount, total);
    animateNumber(dom.completedCount, completed);
    animateNumber(dom.activeCount, pending);
    animateNumber(dom.completionPercent, percent, '%');
}

function updateProgress() {
    const total = todos.length;
    const completed = todos.filter((todo) => todo.completed).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const remaining = Math.max(total - completed, 0);
    dom.progressBar.style.width = `${percent}%`;
    dom.progressLabel.textContent = `${percent}% complete`;
    dom.progressComplete.textContent = `${completed} completed`;
    dom.progressRemaining.textContent = `${remaining} remaining`;
}

function updateFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.filter === currentFilter);
    });
}

function animateNumber(element, target, suffix = '') {
    const currentValue = Number(element.dataset.value || 0);
    const start = currentValue;
    const distance = target - start;
    if (!distance) {
        element.textContent = `${target}${suffix}`;
        element.dataset.value = target;
        return;
    }

    const duration = 260;
    const startTime = performance.now();

    const step = (timestamp) => {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(start + distance * eased);
        element.textContent = `${value}${suffix}`;
        element.dataset.value = value;
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };

    requestAnimationFrame(step);
}

function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, theme);
    loadTheme();
    showToast(theme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled', 'success');
}

function loadTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    dom.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('is-removing');
    }, 2000);

    window.setTimeout(() => {
        toast.remove();
    }, 2400);
}

function persistTodos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function loadTodos() {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
        todos = [];
        return;
    }

    try {
        const parsed = JSON.parse(storedValue);
        todos = Array.isArray(parsed) ? parsed.map(normalizeTodo) : [];
    } catch (error) {
        console.error('Unable to load tasks.', error);
        todos = [];
    }
}

function normalizeTodo(todo) {
    return {
        id: Number(todo.id) || Date.now(),
        text: todo.text || '',
        completed: Boolean(todo.completed),
        priority: todo.priority || 'Medium',
        category: normalizeCategory(todo.category),
        dueDate: todo.dueDate || '',
        createdAt: todo.createdAt || new Date().toLocaleString(),
        createdAtTimestamp: Number(todo.createdAtTimestamp) || Date.now(),
        updatedAt: todo.updatedAt || ''
    };
}

function normalizeCategory(category) {
    const normalized = (category || '').trim();
    return normalized || 'Other';
}

function priorityClass(priority) {
    return priority === 'High' ? 'high' : priority === 'Low' ? 'low' : 'medium';
}

function priorityIcon(priority) {
    if (priority === 'High') {
        return '🔴';
    }
    if (priority === 'Low') {
        return '🟢';
    }
    return '🟡';
}

function isOverdue(todo) {
    if (!todo.dueDate || todo.completed) {
        return false;
    }

    const today = new Date();
    const dueDate = new Date(`${todo.dueDate}T00:00:00`);
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
}

function isDueToday(todo) {
    if (!todo.dueDate || todo.completed) {
        return false;
    }

    const today = new Date();
    const dueDate = new Date(`${todo.dueDate}T00:00:00`);
    today.setHours(0, 0, 0, 0);
    return dueDate.getTime() === today.getTime();
}

function getDueMeta(todo) {
    if (!todo.dueDate) {
        return { label: 'No due date', className: 'due-upcoming' };
    }

    const today = new Date();
    const dueDate = new Date(`${todo.dueDate}T00:00:00`);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { label: 'Overdue', className: 'due-overdue' };
    }
    if (diffDays === 0) {
        return { label: 'Today', className: 'due-today' };
    }
    if (diffDays === 1) {
        return { label: 'Tomorrow', className: 'due-tomorrow' };
    }
    return { label: `${diffDays} days left`, className: 'due-upcoming' };
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 'Recently added' : date.toLocaleDateString();
}

function highlightMatch(text, query) {
    const escapedText = escapeHtml(text);
    if (!query) {
        return escapedText;
    }

    const safeQuery = escapeRegExp(query);
    return escapedText.replace(new RegExp(safeQuery, 'ig'), (match) => `<mark>${match}</mark>`);
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function handleGlobalKeydown(event) {
    if (!modalState.type) {
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
    }

    if (event.key === 'Tab') {
        const focusable = dom.modalDialog.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) {
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
}

window.exportTodos = function exportTodos() {
    const dataStr = JSON.stringify(todos, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'todos.json';
    link.click();
    URL.revokeObjectURL(url);
};

window.importTodos = function importTodos() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            try {
                const imported = JSON.parse(loadEvent.target.result);
                if (!Array.isArray(imported)) {
                    throw new Error('Invalid file format');
                }
                todos = imported.map(normalizeTodo);
                persistTodos();
                render();
                showToast('Todos imported', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

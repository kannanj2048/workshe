// ===================================================
// DRAG AND DROP REORDERING FEATURE (ADMIN ONLY) - FIXED VERSION
// ===================================================

// Global drag state
let dragState = {
    draggedElement: null,
    draggedIndex: null,
    dragType: null, // 'platform' or 'task'
    currentSchedule: null
};

// Platform order storage key
const PLATFORM_ORDER_KEY = 'customPlatformOrder';
const TASK_ORDER_KEY = 'customTaskOrder';

// Initialize drag and drop functionality
function initDragAndDrop() {
    // This will be called after displaySchedule() to add drag handlers
    if (!isAdmin) return;

    const tbody = document.getElementById('scheduleTableBody');
    if (tbody) {
        makePlatformsRowsDraggable();
    }

    const tasksGrid = document.getElementById('additionalTasksGrid');
    if (tasksGrid) {
        makeTaskCardsDraggable();
    }
}

// Make platform table rows draggable
function makePlatformsRowsDraggable() {
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');

    rows.forEach((row, index) => {
        // Add draggable attribute and drag handle
        row.setAttribute('draggable', 'true');
        row.style.cursor = 'grab';

        // Add visual drag handle icon to first cell
        const firstCell = row.querySelector('td:first-child strong');
        if (firstCell && !firstCell.querySelector('.drag-handle')) {
            const dragHandle = document.createElement('i');
            dragHandle.className = 'fas fa-grip-vertical drag-handle';
            dragHandle.style.marginRight = '8px';
            dragHandle.style.color = 'var(--primary-color)';
            dragHandle.style.cursor = 'grab';
            firstCell.insertBefore(dragHandle, firstCell.firstChild);
        }

        // Drag start
        row.addEventListener('dragstart', (e) => {
            dragState.draggedElement = row;
            dragState.draggedIndex = index;
            dragState.dragType = 'platform';
            row.style.opacity = '0.5';
            row.style.cursor = 'grabbing';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', row.innerHTML);
        });

        // Drag end
        row.addEventListener('dragend', (e) => {
            row.style.opacity = '1';
            row.style.cursor = 'grab';

            // Remove all drag-over classes
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        // Drag over
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (dragState.dragType === 'platform') {
                row.classList.add('drag-over');
            }
        });

        // Drag leave
        row.addEventListener('dragleave', (e) => {
            row.classList.remove('drag-over');
        });

        // Drop
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('drag-over');

            if (dragState.dragType === 'platform' && dragState.draggedElement !== row) {
                swapPlatformRows(dragState.draggedElement, row);
            }
        });
    });
}

// Swap two platform rows and save order
function swapPlatformRows(draggedRow, targetRow) {
    const tbody = document.getElementById('scheduleTableBody');

    // Get platform names from rows (remove drag handle icon)
    const draggedPlatform = draggedRow.querySelector('td:first-child strong').textContent
        .trim().replace(/[⋮🔄]/g, '').trim();
    const targetPlatform = targetRow.querySelector('td:first-child strong').textContent
        .trim().replace(/[⋮🔄]/g, '').trim();

    console.log(`🔄 Swapping platforms: "${draggedPlatform}" ↔ "${targetPlatform}"`);

    // Swap in DOM
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const draggedIndex = allRows.indexOf(draggedRow);
    const targetIndex = allRows.indexOf(targetRow);

    if (draggedIndex < targetIndex) {
        targetRow.parentNode.insertBefore(draggedRow, targetRow.nextSibling);
    } else {
        targetRow.parentNode.insertBefore(draggedRow, targetRow);
    }

    // Save the new order
    savePlatformOrder();

    // Reinitialize drag handlers
    setTimeout(() => {
        makePlatformsRowsDraggable();
        showNotification(`Moved "${draggedPlatform}" to new position`, 'success');
    }, 100);
}

// Save current platform order from DOM
function savePlatformOrder() {
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const order = [];

    rows.forEach(row => {
        const platformName = row.querySelector('td:first-child strong').textContent
            .trim().replace(/[⋮🔄]/g, '').trim();
        if (platformName) {
            order.push(platformName);
        }
    });

    localStorage.setItem(PLATFORM_ORDER_KEY, JSON.stringify(order));
    console.log('💾 Platform order saved:', order);
}

// Load and apply saved platform order
function loadAndApplyPlatformOrder() {
    const savedOrder = localStorage.getItem(PLATFORM_ORDER_KEY);
    if (!savedOrder) {
        console.log('ℹ️ No custom platform order found');
        return;
    }

    try {
        const order = JSON.parse(savedOrder);
        console.log('📂 Loading platform order:', order);

        const tbody = document.getElementById('scheduleTableBody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        const rowMap = {};

        // Create map of platform name to row element
        rows.forEach(row => {
            const platformName = row.querySelector('td:first-child strong').textContent
                .trim().replace(/[⋮🔄]/g, '').trim();
            if (platformName) {
                rowMap[platformName] = row;
            }
        });

        // Clear tbody
        tbody.innerHTML = '';

        // Append rows in saved order
        order.forEach(platformName => {
            if (rowMap[platformName]) {
                tbody.appendChild(rowMap[platformName]);
            }
        });

        // Append any missing platforms (new ones not in saved order)
        rows.forEach(row => {
            if (!tbody.contains(row)) {
                tbody.appendChild(row);
            }
        });

        console.log('✅ Platform order applied');

        // Reinitialize drag handlers
        if (isAdmin) {
            makePlatformsRowsDraggable();
        }
    } catch (e) {
        console.error('❌ Failed to load platform order:', e);
    }
}

// Make task cards draggable
function makeTaskCardsDraggable() {
    const tasksGrid = document.getElementById('additionalTasksGrid');
    if (!tasksGrid) return;

    const cards = tasksGrid.querySelectorAll('.task-card');

    cards.forEach((card, index) => {
        card.setAttribute('draggable', 'true');
        card.style.cursor = 'grab';

        // Add drag handle icon
        const heading = card.querySelector('h4');
        if (heading && !heading.querySelector('.drag-handle')) {
            const dragHandle = document.createElement('i');
            dragHandle.className = 'fas fa-grip-vertical drag-handle';
            dragHandle.style.marginRight = '8px';
            dragHandle.style.color = 'var(--primary-color)';
            dragHandle.style.cursor = 'grab';
            heading.insertBefore(dragHandle, heading.firstChild);
        }

        // Drag start
        card.addEventListener('dragstart', (e) => {
            dragState.draggedElement = card;
            dragState.draggedIndex = index;
            dragState.dragType = 'task';
            card.style.opacity = '0.5';
            card.style.cursor = 'grabbing';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', card.innerHTML);
        });

        // Drag end
        card.addEventListener('dragend', (e) => {
            card.style.opacity = '1';
            card.style.cursor = 'grab';

            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        // Drag over
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (dragState.dragType === 'task') {
                card.classList.add('drag-over');
            }
        });

        // Drag leave
        card.addEventListener('dragleave', (e) => {
            card.classList.remove('drag-over');
        });

        // Drop
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');

            if (dragState.dragType === 'task' && dragState.draggedElement !== card) {
                swapTaskCards(dragState.draggedElement, card);
            }
        });
    });
}

// Swap two task cards and save order
function swapTaskCards(draggedCard, targetCard) {
    const tasksGrid = document.getElementById('additionalTasksGrid');
    const allCards = Array.from(tasksGrid.querySelectorAll('.task-card'));
    const draggedIndex = allCards.indexOf(draggedCard);
    const targetIndex = allCards.indexOf(targetCard);

    // Get task names (remove icons)
    const draggedTask = draggedCard.querySelector('h4').textContent
        .trim().replace(/[⋮📋]/g, '').trim();
    const targetTask = targetCard.querySelector('h4').textContent
        .trim().replace(/[⋮📋]/g, '').trim();

    console.log(`🔄 Swapping tasks: "${draggedTask}" ↔ "${targetTask}"`);

    // Swap in DOM
    if (draggedIndex < targetIndex) {
        targetCard.parentNode.insertBefore(draggedCard, targetCard.nextSibling);
    } else {
        targetCard.parentNode.insertBefore(draggedCard, targetCard);
    }

    // Save the new order
    saveTaskOrder();

    // Reinitialize drag handlers
    setTimeout(() => {
        makeTaskCardsDraggable();
        showNotification(`Moved "${draggedTask}" to new position`, 'success');
    }, 100);
}

// Save current task order from DOM
function saveTaskOrder() {
    const tasksGrid = document.getElementById('additionalTasksGrid');
    if (!tasksGrid) return;

    const cards = tasksGrid.querySelectorAll('.task-card');
    const order = [];

    cards.forEach(card => {
        const taskName = card.querySelector('h4').textContent
            .trim().replace(/[⋮📋]/g, '').trim();
        if (taskName) {
            order.push(taskName);
        }
    });

    localStorage.setItem(TASK_ORDER_KEY, JSON.stringify(order));
    console.log('💾 Task order saved:', order);
}

// Load and apply saved task order
function loadAndApplyTaskOrder() {
    const savedOrder = localStorage.getItem(TASK_ORDER_KEY);
    if (!savedOrder) {
        console.log('ℹ️ No custom task order found');
        return;
    }

    try {
        const order = JSON.parse(savedOrder);
        console.log('📂 Loading task order:', order);

        const tasksGrid = document.getElementById('additionalTasksGrid');
        if (!tasksGrid) return;

        const cards = Array.from(tasksGrid.querySelectorAll('.task-card'));
        const cardMap = {};

        // Create map of task name to card element
        cards.forEach(card => {
            const taskName = card.querySelector('h4').textContent
                .trim().replace(/[⋮📋]/g, '').trim();
            if (taskName) {
                cardMap[taskName] = card;
            }
        });

        // Clear grid
        tasksGrid.innerHTML = '';

        // Append cards in saved order
        order.forEach(taskName => {
            if (cardMap[taskName]) {
                tasksGrid.appendChild(cardMap[taskName]);
            }
        });

        // Append any missing tasks
        cards.forEach(card => {
            if (!tasksGrid.contains(card)) {
                tasksGrid.appendChild(card);
            }
        });

        console.log('✅ Task order applied');

        // Reinitialize drag handlers
        if (isAdmin) {
            makeTaskCardsDraggable();
        }
    } catch (e) {
        console.error('❌ Failed to load task order:', e);
    }
}

// Add reset order button for admin
function addResetOrderButton() {
    if (!isAdmin) return;

    const scheduleControls = document.querySelector('.schedule-controls .schedule-actions');
    if (scheduleControls && !document.getElementById('resetOrderBtn')) {
        const resetBtn = document.createElement('button');
        resetBtn.id = 'resetOrderBtn';
        resetBtn.className = 'btn btn-secondary btn-small admin-only';
        resetBtn.innerHTML = '<i class="fas fa-undo"></i> Reset Order';
        resetBtn.onclick = resetCustomOrder;
        scheduleControls.appendChild(resetBtn);
    }
}

// Reset order to default
function resetCustomOrder() {
    if (!confirm('Reset platform and task order to default?')) return;

    // Clear saved orders
    localStorage.removeItem(PLATFORM_ORDER_KEY);
    localStorage.removeItem(TASK_ORDER_KEY);

    console.log('🔄 Order reset to default');

    // Reload current schedule
    const dateInput = document.getElementById('scheduleDate');
    const currentDate = new Date(dateInput ? dateInput.value : getNowSGT());
    const dateStr = currentDate.toISOString().split('T')[0];
    const schedule = scheduleHistory[dateStr];

    if (schedule) {
        displaySchedule(schedule);
    }

    showNotification('Order reset to default', 'success');
}

// CSS for drag and drop effects
const dragDropStyles = `
<style id="dragDropCustomStyles">
.drag-handle {
    opacity: 0.5;
    transition: opacity 0.2s ease;
}

.drag-handle:hover {
    opacity: 1;
}

tr[draggable="true"]:hover {
    background: var(--bg-secondary);
    cursor: grab;
}

tr[draggable="true"]:active {
    cursor: grabbing;
}

.task-card[draggable="true"]:hover {
    transform: translateX(5px);
    cursor: grab;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.task-card[draggable="true"]:active {
    cursor: grabbing;
}

.drag-over {
    border: 2px dashed var(--primary-color) !important;
    background: rgba(59, 130, 246, 0.1) !important;
}

/* Smooth transition when reordering */
#scheduleTableBody tr,
#additionalTasksGrid .task-card {
    transition: transform 0.2s ease, background 0.2s ease;
}
</style>
`;

// Inject styles
if (!document.getElementById('dragDropCustomStyles')) {
    const styleDiv = document.createElement('div');
    styleDiv.innerHTML = dragDropStyles;
    document.head.appendChild(styleDiv.firstElementChild);
}

console.log('%c🎯 Drag and Drop Feature Loaded', 'color: #10b981; font-weight: bold; font-size: 14px');
console.log('%c📋 Admin can drag platforms and tasks to reorder', 'color: #3b82f6; font-size: 12px');

// ============================================
// LEAVE MANAGEMENT SYSTEM - FIXED VERSION
// ============================================

// ✅ Declare globally to avoid conflicts
if (typeof window.monthlyLeaveSettings === 'undefined') {
    window.monthlyLeaveSettings = JSON.parse(localStorage.getItem('monthlyLeaveSettings')) || {};
}
let monthlyLeaveSettings = window.monthlyLeaveSettings;

// Save leave settings to localStorage and Firebase
function saveLeaveSettings() {
    localStorage.setItem('monthlyLeaveSettings', JSON.stringify(monthlyLeaveSettings));
    window.monthlyLeaveSettings = monthlyLeaveSettings;
    if (typeof hasDatabase !== 'undefined' && hasDatabase) {
        saveLeaveSettingsToFirebase();
    }
}

// ✅ Check if member is on leave for a specific date
function isMemberOnLeave(member, role, date) {
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const memberKey = `${member}|${role}`;

    console.log(`🔍 Checking leave for ${member} (${role}) on ${date.toDateString()}`);
    console.log(`📅 Month key: ${monthKey}, Member key: ${memberKey}`);

    if (!monthlyLeaveSettings[monthKey]) {
        console.log(`❌ No leave settings for month ${monthKey}`);
        return false;
    }

    if (!monthlyLeaveSettings[monthKey][memberKey]) {
        console.log(`❌ No leave settings for ${memberKey}`);
        return false;
    }

    const dayOfWeek = date.getDay();
    const leaveData = monthlyLeaveSettings[monthKey][memberKey];

    console.log(`📊 Leave data for ${member}:`, leaveData);
    console.log(`📆 Day of week: ${dayOfWeek} (0=Sun, 4=Thu, 5=Fri, 6=Sat)`);

    // Check Thu-Fri leave (Thursday = 4, Friday = 5)
    if ((dayOfWeek === 4 || dayOfWeek === 5) && leaveData.THUFRI) {
        console.log(`✅ ${member} is on LEAVE (Thu-Fri)`);
        return true;
    }

    // Check Sat-Sun leave (Saturday = 6, Sunday = 0)
    if ((dayOfWeek === 0 || dayOfWeek === 6) && leaveData.SATSUN) {
        console.log(`✅ ${member} is on LEAVE (Sat-Sun)`);
        return true;
    }

    console.log(`✅ ${member} is AVAILABLE`);
    return false;
}

// Open monthly leave management modal (Admin only)
function openMonthlyLeaveManagement() {
    if (!isAdmin && !isGuest) {
        showNotification('Admin access required', 'error');
        return;
    }

    let modal = document.getElementById('monthlyLeaveModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'monthlyLeaveModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content monthly-leave-content">
                <span class="modal-close" onclick="closeMonthlyLeaveModal()">&times;</span>
                <h3><i class="fas fa-calendar-times"></i> Monthly Leave Management</h3>
                <div id="monthlyLeaveContent"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.classList.add('show');
    renderLeaveManagementContent();
}

// Close monthly leave modal
function closeMonthlyLeaveModal() {
    const modal = document.getElementById('monthlyLeaveModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Render leave management UI
function renderLeaveManagementContent() {
    const container = document.getElementById('monthlyLeaveContent');
    if (!container) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthInput = document.getElementById('leaveMonthInput');
    const selectedMonth = monthInput ? monthInput.value : currentMonth;

    let html = `
        <div class="leave-month-selector">
            <label>
                <i class="fas fa-calendar"></i>
                Select Month:
                <input type="month" id="leaveMonthInput" value="${selectedMonth}" onchange="renderLeaveManagementContent()">
            </label>
        </div>
        <div class="leave-instructions">
            <p><i class="fas fa-info-circle"></i> Set leave for individual members by day type (Thu-Fri or Sat-Sun)</p>
            <p style="font-size: 0.9em; color: var(--text-muted); margin-top: 8px;">
                <strong>Note:</strong> Marking leave blocks ONLY those specific days. Members remain available on their other regular working days.
            </p>
        </div>
        <div class="leave-management-grid">
    `;

    // Security Analysts Section
    html += `<div class="leave-section"><h4><i class="fas fa-shield-alt"></i> Security Analysts</h4><div class="leave-member-list">`;

    teamData.SAs.forEach(sa => {
        const memberKey = `${sa}|SA`;
        const leaveData = monthlyLeaveSettings[selectedMonth]?.[memberKey] || { THUFRI: false, SATSUN: false };

        html += `
            <div class="leave-member-item">
                <div class="leave-member-name">
                    <i class="fas fa-user"></i><span>${sa}</span>
                </div>
                <div class="leave-day-toggles">
                    <label class="leave-toggle ${leaveData.THUFRI ? 'active' : ''}">
                        <input type="checkbox" ${leaveData.THUFRI ? 'checked' : ''} 
                               onchange="toggleMonthlyLeave('${sa}', 'SA', '${selectedMonth}', 'THUFRI', this.checked)">
                        <span class="toggle-label">Thu-Fri</span>
                    </label>
                    <label class="leave-toggle ${leaveData.SATSUN ? 'active' : ''}">
                        <input type="checkbox" ${leaveData.SATSUN ? 'checked' : ''} 
                               onchange="toggleMonthlyLeave('${sa}', 'SA', '${selectedMonth}', 'SATSUN', this.checked)">
                        <span class="toggle-label">Sat-Sun</span>
                    </label>
                </div>
            </div>
        `;
    });

    html += `</div></div>`;

    // Apprentices Section
    html += `<div class="leave-section">
    <h4><i class="fas fa-graduation-cap"></i> Apprentices</h4>
    <div class="leave-member-list">`;

    teamData.apprentices.forEach(app => {
        const memberKey = `${app}|Apprentice`;
        const leaveData = monthlyLeaveSettings[selectedMonth]?.[memberKey] || { THUFRI: false, SATSUN: false };

        html += `
            <div class="leave-member-item">
                <div class="leave-member-name">
                    <i class="fas fa-user"></i><span>${app}</span>
                </div>
                <div class="leave-day-toggles">
                    <label class="leave-toggle ${leaveData.THUFRI ? 'active' : ''}">
                        <input type="checkbox" ${leaveData.THUFRI ? 'checked' : ''} 
                               onchange="toggleMonthlyLeave('${app}', 'Apprentice', '${selectedMonth}', 'THUFRI', this.checked)">
                        <span class="toggle-label">Thu-Fri</span>
                    </label>
                    <label class="leave-toggle ${leaveData.SATSUN ? 'active' : ''}">
                        <input type="checkbox" ${leaveData.SATSUN ? 'checked' : ''} 
                               onchange="toggleMonthlyLeave('${app}', 'Apprentice', '${selectedMonth}', 'SATSUN', this.checked)">
                        <span class="toggle-label">Sat-Sun</span>
                    </label>
                </div>
            </div>
        `;
    });

    html += `</div></div></div>`;

    // Action buttons
    html += `
        <div class="leave-action-buttons">
            <button class="btn btn-secondary" onclick="clearMonthLeave('${selectedMonth}')">
                <i class="fas fa-eraser"></i> Clear Month
            </button>
            <button class="btn btn-primary" onclick="closeMonthlyLeaveModal()">
                <i class="fas fa-check"></i> Done
            </button>
        </div>
    `;

    container.innerHTML = html;
}

// Toggle monthly leave and ensure proper working schedule
function toggleMonthlyLeave(member, role, month, dayType, isLeave) {
    if (!isAdmin && !isGuest) {
        showNotification('Admin access required', 'error');
        return;
    }

    const memberKey = `${member}|${role}`;

    if (!monthlyLeaveSettings[month]) {
        monthlyLeaveSettings[month] = {};
    }

    if (!monthlyLeaveSettings[month][memberKey]) {
        monthlyLeaveSettings[month][memberKey] = { THUFRI: false, SATSUN: false };
    }

    monthlyLeaveSettings[month][memberKey][dayType] = isLeave;

    // Update working schedule based on leave type
    const category = role === 'SA' ? 'SAs' : 'apprentices';
    
    if (!memberAvailabilitySettings[category][member]) {
        // Initialize if doesn't exist
        memberAvailabilitySettings[category][member] = {
            days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        };
    }

    // Get current leave settings for this member
    const currentLeave = monthlyLeaveSettings[month][memberKey];
    
    // Determine working days based on active leaves
    let workingDays = [];
    
    if (currentLeave.THUFRI && currentLeave.SATSUN) {
        // Both leaves active - only Mon-Wed available
        workingDays = ["Monday", "Tuesday", "Wednesday"];
    } else if (currentLeave.THUFRI) {
        // Thu-Fri leave - works Mon-Wed + Sat-Sun
        workingDays = ["Monday", "Tuesday", "Wednesday", "Saturday", "Sunday"];
    } else if (currentLeave.SATSUN) {
        // Sat-Sun leave - works Mon-Fri
        workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    } else {
        // No leave - all days available
        workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    }

    // Update the member's working schedule
    memberAvailabilitySettings[category][member].days = workingDays;
    saveMemberAvailabilitySettings();

    saveLeaveSettings();
    
    // ✅ NEW: Force save to Firebase
    if (typeof hasDatabase === 'function' && hasDatabase()) {
        if (typeof saveLeaveSettingsToFirebase === 'function') {
            saveLeaveSettingsToFirebase();
            console.log('✅ Leave settings forcefully saved to Firebase');
        }
    }

    const dayTypeLabel = dayType === 'THUFRI' ? 'Thu-Fri' : 'Sat-Sun';
    const statusLabel = isLeave ? 'on leave' : 'available';
    
    console.log(`✅ ${member} leave updated:`);
    console.log(`   - ${dayTypeLabel}: ${statusLabel}`);
    console.log(`   - New working days: ${workingDays.join(', ')}`);
    
    showNotification(`${member} marked ${statusLabel} for ${dayTypeLabel} in ${month}`, 'success');

    // ✅ NEW: Clear schedule cache for affected dates to force regeneration
    console.log('🗑️ Clearing schedule cache for affected month...');
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (scheduleHistory[dateStr]) {
            delete scheduleHistory[dateStr];
            console.log(`   Cleared cache for ${dateStr}`);
        }
    }
    localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
    console.log('✅ Schedule cache cleared - next generation will use new leave settings');

    // Refresh availability display
    if (typeof updateAvailabilityStatus === 'function') {
        updateAvailabilityStatus();
    }
    
    // ✅ NEW: If week view is open, regenerate it immediately
    const weekDiv = document.getElementById('weekSchedule');
    if (weekDiv && weekDiv.style.display !== 'none') {
        console.log('🔄 Regenerating week view with new leave settings...');
        if (typeof generateWeekView === 'function') {
            generateWeekView();
        }
    }
}

// Clear all leave for a specific month
function clearMonthLeave(month) {
if (!isAdmin && !isGuest) {
        showNotification('Access required', 'error');
        return;
    }
    
    if (!confirm(`Clear all leave settings for ${month}?`)) return;

    // Reset all members' working schedules to default before clearing
    const affectedMembers = monthlyLeaveSettings[month] || {};
    
    Object.keys(affectedMembers).forEach(memberKey => {
        const [name, role] = memberKey.split('|');
        const category = role === 'SA' ? 'SAs' : 'apprentices';
        
        if (memberAvailabilitySettings[category]?.[name]) {
            // Reset to full week
            memberAvailabilitySettings[category][name].days = 
                ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        }
    });
    
    saveMemberAvailabilitySettings();

    delete monthlyLeaveSettings[month];
    saveLeaveSettings();
    showNotification(`Leave settings cleared for ${month}`, 'success');
    renderLeaveManagementContent();
    updateAvailabilityStatus();
}

// Save leave settings to Firebase
function saveLeaveSettingsToFirebase() {
    if (!hasDatabase || !database) return;

    database.ref('leaveSettings').set(monthlyLeaveSettings)
        .then(() => console.log('✅ Leave settings saved to Firebase'))
        .catch(error => console.error('❌ Error saving leave settings:', error));
}

// Load leave settings from Firebase
function loadLeaveSettingsFromFirebase() {
    if (!hasDatabase || !database) return;

    database.ref('leaveSettings').once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                monthlyLeaveSettings = snapshot.val();
                localStorage.setItem('monthlyLeaveSettings', JSON.stringify(monthlyLeaveSettings));
                console.log('✅ Leave settings loaded from Firebase');
                
                // Sync working schedules with loaded leave data
                syncWorkingSchedulesWithLeave();
                
                if (typeof updateAvailabilityStatus === 'function') {
                    updateAvailabilityStatus();
                }
            }
        })
        .catch(error => console.error('❌ Error loading leave settings:', error));
}

// ✅ NEW: Sync working schedules when loading from Firebase
function syncWorkingSchedulesWithLeave() {
    Object.keys(monthlyLeaveSettings).forEach(month => {
        Object.keys(monthlyLeaveSettings[month]).forEach(memberKey => {
            const [name, role] = memberKey.split('|');
            const category = role === 'SA' ? 'SAs' : 'apprentices';
            const leaveData = monthlyLeaveSettings[month][memberKey];
            
            if (memberAvailabilitySettings[category]?.[name]) {
                let workingDays = [];
                
                if (leaveData.THUFRI && leaveData.SATSUN) {
                    workingDays = ["Monday", "Tuesday", "Wednesday"];
                } else if (leaveData.THUFRI) {
                    workingDays = ["Monday", "Tuesday", "Wednesday", "Saturday", "Sunday"];
                } else if (leaveData.SATSUN) {
                    workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
                } else {
                    workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                }
                
                memberAvailabilitySettings[category][name].days = workingDays;
            }
        });
    });
    
    saveMemberAvailabilitySettings();
}

console.log('%c✅ Monthly Leave Management System v3.1 Loaded (Fixed)', 'color: #10b981; font-weight: bold; font-size: 14px');

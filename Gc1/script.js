// ==========================================
// WORK SCHEDULE MANAGER
// All features: Rotation, Shift-based availability, Auto-status, Toggles
// ==========================================

function getNowSGT() {
    // Use toLocaleString to get actual SGT time
    const now = new Date();
    const sgtString = now.toLocaleString("en-US", { timeZone: "Asia/Singapore" });
    return new Date(sgtString);
}

function formatSGTDateTime(date) {
    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Singapore"
    };
    return date.toLocaleString("en-SG", options);
}

function formatSGTTime(date) {
    return date.toLocaleTimeString("en-SG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Singapore"
    });
}

// Format date as YYYY-MM-DD for input field
function formatDateForInput(date) {
    // Get SGT date components directly using SGT timezone
    const sgtDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
    const year = sgtDate.getFullYear();
    const month = String(sgtDate.getMonth() + 1).padStart(2, '0');
    const day = String(sgtDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Auto-update at midnight SGT (00:00)
let lastCheckedDate = null;

function checkForMidnightUpdate() {
    const nowSGT = getNowSGT();
    const currentDateStr = formatDateForInput(nowSGT);
    
    // Check if date has changed (midnight passed)
    if (lastCheckedDate !== null && lastCheckedDate !== currentDateStr) {
        
        // Auto-update to new day
        const dateInput = document.getElementById("scheduleDate");
        if (dateInput) {
            dateInput.value = currentDateStr;
        }
        
        // Generate new schedule for the new day
        generateDailySchedule(nowSGT);
        
        showNotification(`📅 Schedule auto-updated to ${currentDateStr}`, 'success');
    }
    
    lastCheckedDate = currentDateStr;
}
// ---------- SHIFT SYSTEM (SGT) ----------
const SHIFT_TYPES = {
    MORNING: { name: "Morning", start: 9, startMin: 0, end: 16, endMin: 59, label: "09:00 - 18:00" },
    AFTERNOON: { name: "Afternoon", start: 17, startMin: 0, end: 0, endMin: 30, label: "18:00 - 02:00" },
    NIGHT: { name: "Night", start: 0, startMin: 30, end: 8, endMin: 59, label: "01:00 - 09:00" }
};

let shiftSchedule = JSON.parse(localStorage.getItem("shiftSchedule")) || {
    currentPeriod: { shiftType: "MORNING", startDate: "2025-12-09", endDate: "2025-12-22" },
    nextPeriod: { shiftType: "AFTERNOON", startDate: "2025-12-23", endDate: "2026-01-05" }
};

// Store shift overrides (for Daily Platform Assignments section only)
// Format: { startDate: "2026-02-04", endDate: "2026-02-18", shift: "MORNING" }
let shiftOverride = JSON.parse(localStorage.getItem("shiftOverride")) || null;

// Get current shift based on TIME (not schedule rotation)
function getCurrentShift(dateSGT) {
    const hours = dateSGT.getHours();
    const minutes = dateSGT.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    // Morning: 09:00 - 16:49 (540 - 1020 minutes)
    if (totalMinutes >= 540 && totalMinutes < 1020) {
        return 'MORNING';
    }
    // Afternoon: 18:00 - 00:30 (1080 - 1439 minutes OR 0 - 30 minutes)
    else if (totalMinutes >= 1080 || totalMinutes < 30) {
        return 'AFTERNOON';
    }
    // Night: 00:30 - 08:30 (30 - 510 minutes)
    else if (totalMinutes >= 30 && totalMinutes < 510) {
        return 'NIGHT';
    }
    // Default to Morning for edge case (08:30 - 09:00)
    else {
        return 'MORNING';
    }
}

// Helper function to get shift for a specific date (checks for override first)
function getShiftForDate(date) {
    // Build dateStr correctly in SGT timezone
    const sgtDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
    const year = sgtDate.getFullYear();
    const month = String(sgtDate.getMonth() + 1).padStart(2, '0');
    const day = String(sgtDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Check if there's an active shift override for this date
    if (shiftOverride && shiftOverride.startDate && shiftOverride.endDate) {
        if (dateStr >= shiftOverride.startDate && dateStr <= shiftOverride.endDate) {
            return shiftOverride.shift;
        }
    }

    // Otherwise use automatic shift detection
    return getCurrentShift(date);
}

function getWorkingHoursDisplay() {
    const nowSGT = getNowSGT();
    const currentShift = getCurrentShift(nowSGT);
    const shift = SHIFT_TYPES[currentShift];
    return `${shift.name} Shift (${shift.label} SGT)`;
}

let availabilityOverrides = JSON.parse(localStorage.getItem("availabilityOverrides")) || {};
// ---------- TEAM DATA ----------
let teamData = JSON.parse(localStorage.getItem("teamData")) || {
    SAs: [ "Gayathiri", "Ajay", "Jana", "Malini", "Rajapandi Ganesan", "Keerthana", "Siva Bharathi"],
    apprentices: [ "Sanjay", "Vishal", "Subash"],
    responsibilities: {
        Gayathiri: "Vishal",
        Ajay: "Vishal",
        Jana: "Karl / Subash",
        Malini: "Sanjay",
        Rajapandi Ganesan: "Karl / Subash",
    }
};

const platforms = {
    main: ["SIEM", "XDR", "Forti EDR"],
    common: ["CrowdStrike EDR", "NDR", "Netskope"],
    grouped: ["Sophos XDR", "Trend Vision One", "Cloudflare", "Acronis EDR"]
};

let scheduleHistory = JSON.parse(localStorage.getItem("scheduleHistory")) || {};
let isAdmin = false;

// Load monthly leave management
// let monthlyLeaveSettings = JSON.parse(localStorage.getItem('monthlyLeaveSettings')) || {};

// ========== CENTRALIZED AVAILABILITY MANAGEMENT SYSTEM ==========
let memberAvailabilitySettings = JSON.parse(localStorage.getItem('memberAvailabilitySettings')) || {
    SAs: {
        "Gayathiri": { days: ["Monday", "Tuesday", "Wednesday", "Saturday", "Sunday"] },
        "Ajay": { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
        "Jana": { days: ["Monday", "Tuesday", "Wednesday", "Saturday", "Sunday"] },
        "Malini": { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
        "Rajapandi Ganesan": { days: ["Monday", "Tuesday", "Wednesday", "Saturday", "Sunday"] },
        "Keerthana": { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }
    },
    apprentices: {
        "Siva Bharathi": { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
        "Sanjay": { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
        "Vishal": { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
        "Subash": { days: ["Monday", "Tuesday", "Wednesday", "Saturday", "Sunday"] }
    }
};

// ========== GLOBAL AVAILABILITY FUNCTIONS ==========
function toggleMemberAvailability(name, role) {
    if (!isAdmin && !isGuest) {
        showNotification("Admin access required", "error");
        return;
    }
    const key = `${name}_${role}`;
    if (availabilityOverrides[key]) {
        delete availabilityOverrides[key];
        showNotification(`${name} is now available`, "success");
    } else {
        availabilityOverrides[key] = true;
        showNotification(`${name} marked as unavailable`, "success");
    }
    localStorage.setItem("availabilityOverrides", JSON.stringify(availabilityOverrides));
    if (typeof database !== 'undefined') {
        saveAvailabilityToFirebase();
    }
    updateAvailabilityStatus();
}

function editMemberInAvailability(oldName, role) {
    if (!isAdmin) {
        showNotification("Admin access required", "error");
        return;
    }
    const newName = prompt("Edit member name:", oldName);
    if (!newName || newName.trim() === "") {
        showNotification("Edit cancelled", "error");
        return;
    }
    if (newName.trim() === oldName) {
        showNotification("No changes made", "error");
        return;
    }
    const category = role === "SA" ? "SAs" : "apprentices";
    if (teamData[category].includes(newName.trim())) {
        showNotification("Member with this name already exists", "error");
        return;
    }
    const idx = teamData[category].indexOf(oldName);
    if (idx !== -1) {
        teamData[category][idx] = newName.trim();
        if (role === "SA" && teamData.responsibilities[oldName]) {
            teamData.responsibilities[newName.trim()] = teamData.responsibilities[oldName];
            delete teamData.responsibilities[oldName];
        }
        const oldKey = `${oldName}_${role}`;
        const newKey = `${newName.trim()}_${role}`;
        if (availabilityOverrides[oldKey]) {
            availabilityOverrides[newKey] = availabilityOverrides[oldKey];
            delete availabilityOverrides[oldKey];
            localStorage.setItem("availabilityOverrides", JSON.stringify(availabilityOverrides));
            if (typeof database !== 'undefined') {
                saveAvailabilityToFirebase();
            }
        }
        localStorage.setItem("teamData", JSON.stringify(teamData));
        if (typeof database !== 'undefined') {
            saveTeamDataToFirebase();
        }
        updateAvailabilityStatus();
        loadTeamData();
        showNotification(`${oldName} updated to ${newName.trim()}`, "success");
    }
}

function removeMemberFromAvailability(name, role) {
    if (!isAdmin) {
        showNotification("Admin access required", "error");
        return;
    }
    if (!confirm(`Are you sure you want to remove ${name}?\n\nThis will:\n- Remove from team list\n- Remove from all schedules\n- Clear availability settings`)) {
        return;
    }
    const category = role === "SA" ? "SAs" : "apprentices";
    const idx = teamData[category].indexOf(name);
    if (idx !== -1) {
        teamData[category].splice(idx, 1);
        if (role === "SA" && teamData.responsibilities[name]) {
            delete teamData.responsibilities[name];
        }

        // Remove from centralized system
        if (memberAvailabilitySettings[category]?.[name]) {
            delete memberAvailabilitySettings[category][name];
            saveMemberAvailabilitySettings();
        }

        const key = `${name}_${role}`;
        if (availabilityOverrides[key]) {
            delete availabilityOverrides[key];
            localStorage.setItem("availabilityOverrides", JSON.stringify(availabilityOverrides));
            if (typeof database !== 'undefined') {
                saveAvailabilityToFirebase();
            }
        }
        localStorage.setItem("teamData", JSON.stringify(teamData));
        if (typeof database !== 'undefined') {
            // Delete user from Firebase
            deleteUserFromRole(name, role, () => {
            });
            saveTeamDataToFirebase();
        }
        updateAvailabilityStatus();
        loadTeamData();
        updateTotalMembersCount();
        showNotification(`${name} removed successfully`, "success");
    }
}

function addMemberFromAvailability(role) {
    if (!isAdmin) {
        showNotification("Admin access required", "error");
        return;
    }
    const category = role === "SA" ? "SAs" : "apprentices";
    const name = prompt(`Enter new ${role} name:`);
    if (!name || name.trim() === "") {
        showNotification("Add cancelled", "error");
        return;
    }
    if (teamData[category].includes(name.trim())) {
        showNotification("Member already exists", "error");
        return;
    }
    
    teamData[category].push(name.trim());
    
    if (role === "SA") {
        const responsibilities = prompt(`Enter responsibilities for ${name.trim()} (e.g., "Karl / Subash"):`);
        if (responsibilities) {
            teamData.responsibilities[name.trim()] = responsibilities.trim();
        }
    }
    
    // Add to centralized availability system
    const scheduleChoice = prompt(`Set working days for ${name.trim()}:\n1 = Thu-Fri + Mon-Wed\n2 = Sat-Sun + Mon-Wed`);
    const cat = role === "SA" ? "SAs" : "apprentices";

    if (scheduleChoice === "1") {
        memberAvailabilitySettings[cat][name.trim()] = {
            days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        };
    } else {
        memberAvailabilitySettings[cat][name.trim()] = {
            days: ["Monday", "Tuesday", "Wednesday", "Saturday", "Sunday"]
        };
    }
    saveMemberAvailabilitySettings();

    localStorage.setItem("teamData", JSON.stringify(teamData));
    
    // Save to Firebase
    if (typeof database !== 'undefined') {
        checkAndAddUser(name.trim(), role, (success, status) => {
            if (success) {
                saveTeamDataToFirebase();
            } else {
            }
        });
    }
    
    updateAvailabilityStatus();
    loadTeamData();
    updateTotalMembersCount();
    showNotification(`${name.trim()} added successfully`, "success");
}

function saveMemberAvailabilitySettings() {
    localStorage.setItem('memberAvailabilitySettings', JSON.stringify(memberAvailabilitySettings));
    
    // ✅ Try Firebase sync silently - localStorage is the source of truth
    if (typeof database !== 'undefined') {
        try {
            database.ref('memberAvailabilitySettings').set(memberAvailabilitySettings)
                .then(() => {})
                .catch(() => {}); // Silent fail - localStorage already saved successfully
        } catch (error) {
            // Silent fail - localStorage already saved successfully
        }
    }
}

function changeMemberWorkingDays(name, role) {
    if (!isAdmin) {
        showNotification("Admin access required", "error");
        return;
    }
    
    const category = role === "SA" ? "SAs" : "apprentices";
    
    if (!memberAvailabilitySettings[category][name]) {
        showNotification("Member not found", "error");
        return;
    }
    
    const currentDays = memberAvailabilitySettings[category][name].days;
    const hasThuFri = currentDays.includes("Thursday");
    const hasSatSun = currentDays.includes("Saturday");
    
    let currentPattern = hasThuFri ? "Thu-Fri + Mon-Wed" : "Sat-Sun + Mon-Wed";
    
    const message = `${name} currently works:\n${currentPattern}\n\nChange to:\n1 = Thu-Fri + Mon-Wed\n2 = Sat-Sun + Mon-Wed\n3 = Cancel`;
    const choice = prompt(message);
    
    if (choice === "1") {
        memberAvailabilitySettings[category][name].days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        showNotification(`${name} → Thu-Fri + Mon-Wed`, "success");
    } else if (choice === "2") {
        memberAvailabilitySettings[category][name].days = ["Monday", "Tuesday", "Wednesday", "Saturday", "Sunday"];
        showNotification(`${name} → Sat-Sun + Mon-Wed`, "success");
    } else {
        showNotification("Cancelled", "error");
        return;
    }
    
    saveMemberAvailabilitySettings();
    updateAvailabilityStatus();
}

function getAvailableSAsForDate(dateSGT) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[dateSGT.getDay()];
    
    const availableMembers = [];
    
    // Safety check
    if (!memberAvailabilitySettings || !memberAvailabilitySettings.SAs) {
        return availableMembers;
    }
    
    for (const [name, settings] of Object.entries(memberAvailabilitySettings.SAs)) {
        // Safety check for settings
        if (!settings || !settings.days) {
            continue;
        }
        
        // Check working day schedule
        if (!settings.days.includes(dayName)) {
            continue;
        }
        
        // ✅ Check monthly leave
        if (typeof isMemberOnLeave === 'function' && isMemberOnLeave(name, 'SA', dateSGT)) {
            continue;
        }
        
        // Check availability override (manual toggle)
        const key = `${name}_SA`;
        if (availabilityOverrides[key]) {
            continue;
        }
        
        
        availableMembers.push(name);
    }
    
    return availableMembers;
}

function getAvailableApprenticesForDate(dateSGT) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[dateSGT.getDay()];
    
    const availableMembers = [];
    
    // Safety check
    if (!memberAvailabilitySettings || !memberAvailabilitySettings.apprentices) {
        return availableMembers;
    }
    
    for (const [name, settings] of Object.entries(memberAvailabilitySettings.apprentices)) {
        // Safety check for settings
        if (!settings || !settings.days) {
            continue;
        }
        
        // Check working day schedule
        if (!settings.days.includes(dayName)) {
            continue;
        }
        
        // ✅ Check monthly leave
        if (typeof isMemberOnLeave === 'function' && isMemberOnLeave(name, 'Apprentice', dateSGT)) {
            continue;
        }
        
        // Check availability override (manual toggle)
        const key = `${name}_Apprentice`;
        if (availabilityOverrides[key]) {
            continue;
        }
        
        availableMembers.push(name);
    }
    
    return availableMembers;
}

function isMemberAvailableOnDate(member, dateSGT, role) {
    // 1. Check manual availability override
    const key = `${member}_${role}`;
    if (availabilityOverrides[key]) {
        return false; // Member is unavailable (manual override)
    }
    
    // 2. Check if member is on leave
    if (typeof isMemberOnLeave === 'function' && isMemberOnLeave(member, role, dateSGT)) {
        return false; // Member is on leave
    }
    
    // 3. Check working schedule (memberAvailabilitySettings)
    if (typeof memberAvailabilitySettings !== 'undefined') {
        const roleKey = role === 'SA' ? 'SAs' : 'apprentices';
        if (memberAvailabilitySettings[roleKey] && memberAvailabilitySettings[roleKey][member]) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = dayNames[dateSGT.getDay()];
            const workingDays = memberAvailabilitySettings[roleKey][member].days || [];
            
            if (!workingDays.includes(dayName)) {
                return false; // Not a working day for this member
            }
        }
    }
    
    return true; // Member is available
}

// ---------- SCHEDULE GENERATION ----------

// Global assignment history tracker
let assignmentHistory = JSON.parse(localStorage.getItem("assignmentHistory")) || {
    platforms: {},
    tasks: {},
    saWorkload: {},
    apprenticeWorkload: {}
};

// ==========================================
// MAIN SCHEDULE GENERATION
// ==========================================
function generateScheduleForDate(date) {
    // Check if AI learning is enabled
    if (typeof AI_LEARNING_CONFIG !== 'undefined' && AI_LEARNING_CONFIG.ENABLE_LEARNING && typeof learnedPatterns !== 'undefined' && learnedPatterns.totalSchedules >= AI_LEARNING_CONFIG.MIN_PATTERNS_REQUIRED) {
        return generateScheduleWithAI(date);
    }

    // Fallback to original logic if not enough training data
    
    const schedule = {
        date: date.toISOString().split("T")[0],
        shift: getShiftForDate(date), // Use helper function that checks for 2-week override
        platforms: {},
        tasks: {}
    };

    const dateStr = schedule.date;
    const dayOfWeek = date.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];

    // ===== STEP 1: Get ONLY available members (check availability status) =====
    const availableSAs = getAvailableSAsForDate(date).filter(sa => {
        const key = `${sa}_SA`;
        const isAvailable = !availabilityOverrides[key];
        if (!isAvailable) {
        }
        return isAvailable;
    });

    const availableApps = getAvailableApprenticesForDate(date).filter(app => {
        const key = `${app}_Apprentice`;
        const isAvailable = !availabilityOverrides[key];
        if (!isAvailable) {
        }
        return isAvailable;
    });

    if (availableSAs.length === 0) {
        platforms.main.forEach(p => {
            schedule.platforms[p] = { inCharge: "No SA Available", responsibility: "N/A" };
        });
        return schedule;
    }

    // ===== STEP 2: Get assignment history (last 7 days) =====
    const recentHistory = getRecentAssignmentHistory(date, 7);

    // ===== STEP 3: Calculate workload scores =====
    const saScores = calculateWorkloadScores(availableSAs, recentHistory, 'SA');
    const appScores = calculateWorkloadScores(availableApps, recentHistory, 'Apprentice');

    availableSAs.forEach(sa => {
    });

    // ===== STEP 4: Assign MAIN PLATFORMS (SIEM, XDR, Forti EDR) =====
    const mainPlatforms = ['SIEM', 'XDR', 'Forti EDR'];
    const usedSAs = [];

    mainPlatforms.forEach(platform => {
        const bestSA = selectBestPersonForPlatform(
            platform,
            availableSAs,
            usedSAs,
            recentHistory,
            saScores,
            dateStr
        );

        if (bestSA) {
            usedSAs.push(bestSA);

            // Smart apprentice pairing
            const responsibility = smartApprenticeAssignment(
                bestSA,
                availableApps,
                dayName,
                mainPlatforms.indexOf(platform),
                mainPlatforms.length
            );

            schedule.platforms[platform] = {
                inCharge: bestSA,
                responsibility: responsibility
            };

            recordPlatformAssignment(platform, bestSA, dateStr, date);
        }
    });

    // ===== STEP 5: Assign COMMON PLATFORMS =====
    const commonPlatforms = ['CrowdStrike EDR', 'NDR', 'Netskope'];

    if (dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
        // Thursday/Friday/Saturday/Sunday - All SA's
        commonPlatforms.forEach(platform => {
            schedule.platforms[platform] = {
                inCharge: "All SA's",
                responsibility: 'All Apprentice'
            };
        });
    } else {
        // Monday-Wednesday - Assign specific SAs (not used in main platforms)
        const remainingSAs = availableSAs.filter(sa => !usedSAs.includes(sa));

        commonPlatforms.forEach((platform, idx) => {
            let assignedSA;

            if (remainingSAs.length > 0) {
                assignedSA = selectBestPersonForPlatform(
                    platform,
                    remainingSAs,
                    [],
                    recentHistory,
                    saScores,
                    dateStr
                );

                const saIndex = remainingSAs.indexOf(assignedSA);
                if (saIndex > -1) {
                    remainingSAs.splice(saIndex, 1);
                }
            } else {
                // Reuse SAs if no remaining
                assignedSA = availableSAs[idx % availableSAs.length];
            }

            schedule.platforms[platform] = {
                inCharge: assignedSA,
                responsibility: 'All Apprentice'
            };

            recordPlatformAssignment(platform, assignedSA, dateStr, date);
        });
    }

    // ===== STEP 6: Assign GROUPED PLATFORMS =====
    const groupedPlatforms = ['Sophos XDR', 'Trend Vision One', 'Cloudflare', 'Acronis EDR'];

    const allAssignedSAs = usedSAs.concat(
        Object.values(schedule.platforms)
            .map(p => p.inCharge)
            .filter(sa => sa !== "All SA's" && !usedSAs.includes(sa))
    );

    const remainingForGrouped = availableSAs.filter(sa => {
        const count = allAssignedSAs.filter(assigned => assigned === sa).length;
        return count < 2;
    });

    groupedPlatforms.forEach(platform => {
        if (platform === 'Acronis EDR') {
            // Acronis same as NDR
            schedule.platforms[platform] = {
                inCharge: schedule.platforms['NDR']?.inCharge || "All SA's",
                responsibility: 'All Apprentice'
            };
        } else if (platform === 'Sophos XDR' && remainingForGrouped.length > 0) {
            const assignedSA = selectBestPersonForPlatform(
                platform,
                remainingForGrouped,
                [],
                recentHistory,
                saScores,
                dateStr
            );

            schedule.platforms[platform] = {
                inCharge: assignedSA || "All SA's",
                responsibility: 'All Apprentice'
            };

            if (assignedSA) {
                recordPlatformAssignment(platform, assignedSA, dateStr, date);
            }
        } else {
            schedule.platforms[platform] = {
                inCharge: "All SA's",
                responsibility: 'All Apprentice'
            };
        }
    });

    // ===== STEP 7: Assign ADDITIONAL TASKS =====
    schedule.tasks = assignAdditionalTasksSmart(
        availableSAs,
        availableApps,
        date,
        recentHistory,
        usedSAs
    );

    // Save assignment history
    localStorage.setItem("assignmentHistory", JSON.stringify(assignmentHistory));

    return schedule;
}

// ==========================================
// SMART APPRENTICE PAIRING
// ==========================================
function smartApprenticeAssignment(sa, availableApps, dayName, platformIndex, totalPlatforms) {
    // Weekend - All Apprentice
    if (dayName === 'Saturday' || dayName === 'Sunday') {
        return 'All Apprentice';
    }

    // Check predefined responsibilities
    if (teamData.responsibilities[sa] && teamData.responsibilities[sa] !== 'All Apprentice') {
        return teamData.responsibilities[sa];
    }

    // Smart pairing logic
    const totalApps = availableApps.length;

    if (totalApps === 0) {
        return 'All Apprentice';
    } else if (totalApps === 1) {
        return availableApps[0];
    } else if (totalApps === 2) {
        return `${availableApps[0]} / ${availableApps[1]}`;
    } else if (totalApps === 3) {
        // Distribute: 2 platforms get 2 apps, 1 platform gets 1 app
        if (platformIndex === 0) return `${availableApps[0]} / ${availableApps[1]}`;
        if (platformIndex === 1) return `${availableApps[2]}`;
        if (platformIndex === 2) return 'All Apprentice';
    } else if (totalApps === 4) {
        // Each platform gets 2 apps (2 pairs)
        const pair1 = platformIndex === 0 ? [0, 1] : platformIndex === 1 ? [2, 3] : [0, 1];
        return `${availableApps[pair1[0]]} / ${availableApps[pair1[1]]}`;
    } else if (totalApps === 5) {
        // Make 2 pairs, 1 single
        if (platformIndex === 0) return `${availableApps[0]} / ${availableApps[1]}`;
        if (platformIndex === 1) return `${availableApps[2]} / ${availableApps[3]}`;
        if (platformIndex === 2) return availableApps[4];
    } else {
        // 6+ apprentices - distribute evenly
        const appsPerPlatform = Math.floor(totalApps / totalPlatforms);
        const start = platformIndex * appsPerPlatform;
        const end = start + appsPerPlatform;
        const assigned = availableApps.slice(start, end);
        return assigned.length > 0 ? assigned.join(' / ') : 'All Apprentice';
    }

    return 'All Apprentice';
}

// ==========================================
// SMART TASK ASSIGNMENT 
// ==========================================

// ==========================================
// SMART TASK ASSIGNMENT - FIXED VERSION
// ==========================================
function assignAdditionalTasksSmart(sas, apprentices, date, recentHistory, mainPlatformSAs) {
    const tasks = {};
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split("T")[0];

    // ✅ Use only actual available members - no hardcoded fallback
    const safeSAs = sas.length > 0 ? sas : [];
    const safeApps = apprentices.length > 0 ? apprentices : [];
    
    // ✅ GET TASK LIST (custom or default)
    const taskList = (typeof getAdditionalTasksList === 'function') 
        ? getAdditionalTasksList() 
        : [
            "Email Handle",
            "Follow Up Remainder",
            "SIEM Device Status",
            "HO PPT Update",
            "Handover Presentation",
            "Handover Summary"
        ];

    // If no members available at all, show "No one available"
    if (safeSAs.length === 0 && safeApps.length === 0) {
        taskList.forEach(task => {
            tasks[task] = "No one available";
        });
        return tasks;
    }

    // Calculate scores only with available members
    const saTaskScores = safeSAs.length > 0 ? calculateWorkloadScores(safeSAs, recentHistory, 'SA') : {};
    const appTaskScores = safeApps.length > 0 ? calculateWorkloadScores(safeApps, recentHistory, 'Apprentice') : {};

    // Sort by fairness (least loaded first)
    const sortedSAs = Object.entries(saTaskScores)
        .sort((a, b) => a[1].fairnessScore - b[1].fairnessScore)
        .map(entry => entry[0]);

    const sortedApps = Object.entries(appTaskScores)
        .sort((a, b) => a[1].fairnessScore - b[1].fairnessScore)
        .map(entry => entry[0]);

    // Prefer SAs NOT on main platforms (if shortage, use main platform SAs)
    const availableForTasks = safeSAs.filter(sa => !mainPlatformSAs.includes(sa));
    const taskSAs = availableForTasks.length > 0 ? availableForTasks : sortedSAs;

    // ✅ ASSIGN ALL TASKS DYNAMICALLY
    taskList.forEach((taskName, index) => {
        if (taskSAs.length > 0 && sortedApps.length > 0) {
            const saIndex = index % taskSAs.length;
            const appIndex = index % sortedApps.length;
            const assignedSA = taskSAs[saIndex] || sortedSAs[0];
            const assignedApp = sortedApps[appIndex];
            tasks[taskName] = `${assignedSA} / ${assignedApp}`;
        } else if (taskSAs.length > 0) {
            const saIndex = index % taskSAs.length;
            tasks[taskName] = taskSAs[saIndex] || sortedSAs[0];
        } else if (sortedApps.length > 0) {
            const appIndex = index % sortedApps.length;
            tasks[taskName] = sortedApps[appIndex];
        } else {
            tasks[taskName] = "All SA's";
        }
    });

    // ✅ VERIFICATION: Ensure all tasks are present
    taskList.forEach(taskName => {
        if (!tasks[taskName]) {
            tasks[taskName] = "All SA's";
        }
    });

    
    // ✅ FINAL VERIFICATION: Log all tasks before returning
    Object.entries(tasks).forEach(([taskName, assigned]) => {
    });

    // Record task assignments
    Object.entries(tasks).forEach(([task, assigned]) => {
        if (!assignmentHistory.tasks[task]) {
            assignmentHistory.tasks[task] = [];
        }
        assignmentHistory.tasks[task].push({
            person: assigned,
            date: dateStr,
            timestamp: date.getTime()
        });

        if (assignmentHistory.tasks[task].length > 30) {
            assignmentHistory.tasks[task].shift();
        }
    });

    return tasks;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getRecentAssignmentHistory(currentDate, days) {
    const history = {
        platforms: {},
        tasks: {},
        dates: []
    };

    for (let i = 1; i <= days; i++) {
        const pastDate = new Date(currentDate);
        pastDate.setDate(pastDate.getDate() - i);
        const dateStr = pastDate.toISOString().split("T")[0];

        history.dates.push(dateStr);

        const pastSchedule = scheduleHistory[dateStr];
        if (pastSchedule && pastSchedule.platforms) {
            Object.entries(pastSchedule.platforms).forEach(([platform, assignment]) => {
                if (!history.platforms[platform]) {
                    history.platforms[platform] = [];
                }
                history.platforms[platform].push({
                    sa: assignment.inCharge,
                    date: dateStr,
                    daysAgo: i
                });
            });
        }

        if (pastSchedule && pastSchedule.tasks) {
            Object.entries(pastSchedule.tasks).forEach(([task, assigned]) => {
                if (!history.tasks[task]) {
                    history.tasks[task] = [];
                }
                history.tasks[task].push({
                    person: assigned,
                    date: dateStr,
                    daysAgo: i
                });
            });
        }
    }

    return history;
}

function calculateWorkloadScores(members, recentHistory, role) {
    const scores = {};

    members.forEach(member => {
        let totalAssignments = 0;
        let recentAssignments = 0;

        Object.values(recentHistory.platforms).forEach(assignments => {
            assignments.forEach(assign => {
                if (assign.sa === member) {
                    totalAssignments++;
                    if (assign.daysAgo <= 3) {
                        recentAssignments += 2;
                    } else {
                        recentAssignments += 1;
                    }
                }
            });
        });

        Object.values(recentHistory.tasks).forEach(assignments => {
            assignments.forEach(assign => {
                if (assign.person.includes(member)) {
                    totalAssignments++;
                    if (assign.daysAgo <= 3) {
                        recentAssignments += 1;
                    }
                }
            });
        });

        scores[member] = {
            total: totalAssignments,
            recent: recentAssignments,
            fairnessScore: totalAssignments + (recentAssignments * 1.5)
        };
    });

    return scores;
}

function selectBestPersonForPlatform(platform, availableMembers, usedMembers, recentHistory, scores, currentDate) {
    const candidates = availableMembers.filter(m => !usedMembers.includes(m));

    if (candidates.length === 0) {
        return availableMembers[0];
    }

    const candidateScores = candidates.map(member => {
        let score = 0;

        const platformHistory = recentHistory.platforms[platform] || [];
        const lastAssignment = platformHistory.find(h => h.sa === member);

        if (lastAssignment) {
            // Heavy penalty for recent assignment
            score += (8 - lastAssignment.daysAgo) * 10;
        }

        if (scores[member]) {
            score += scores[member].fairnessScore;
        }

        const todaySchedule = scheduleHistory[currentDate];
        if (todaySchedule && todaySchedule.platforms) {
            if (todaySchedule.platforms[platform]?.inCharge === member) {
                score += 100;
            }
        }

        return { member, score };
    });

    candidateScores.sort((a, b) => a.score - b.score);

    return candidateScores[0].member;
}

function recordPlatformAssignment(platform, person, dateStr, date) {
    if (!assignmentHistory.platforms[platform]) {
        assignmentHistory.platforms[platform] = [];
    }

    assignmentHistory.platforms[platform].push({
        person: person,
        date: dateStr,
        timestamp: date.getTime()
    });

    if (assignmentHistory.platforms[platform].length > 30) {
        assignmentHistory.platforms[platform].shift();
    }
}

function clearAssignmentHistory() {
    if (!isAdmin) {
        showNotification("Admin access required", "error");
        return;
    }

    if (confirm("Clear all assignment history? This will reset the smart algorithm.")) {
        assignmentHistory = {
            platforms: {},
            tasks: {},
            saWorkload: {},
            apprenticeWorkload: {}
        };
        localStorage.setItem("assignmentHistory", JSON.stringify(assignmentHistory));
        showNotification("Assignment history cleared!", "success");
    }
}

// Legacy function for compatibility
function assignAdditionalTasks(sas, apprentices, date) {
    return assignAdditionalTasksSmart(sas, apprentices, date, {platforms: {}, tasks: {}}, []);
}

// ==========================================
// ✅ PROPER SCHEDULE GENERATION FUNCTION
// ==========================================
function generateDailySchedule(dateSGT) {
    const dateStr = dateSGT.toISOString().split("T")[0];
    
    // ✅ CRITICAL: Update date input field FIRST
    const dateInput = document.getElementById("scheduleDate");
    if (dateInput) {
        dateInput.value = dateStr;
    }
    
    // Update display immediately
    updateCurrentDayDisplay(dateSGT);
    updateCurrentShiftInfo(dateSGT);
    
    // Check if we have Firebase
    if (typeof database !== 'undefined') {
        // Try localStorage first for instant display
        let localSchedule = scheduleHistory[dateStr];
        
        loadScheduleFromFirebase(dateSGT, (firebaseSchedule) => {
            let scheduleToDisplay = null;
            
            if (firebaseSchedule) {
                // Use Firebase schedule (most up-to-date)
                scheduleToDisplay = firebaseSchedule;
                // Apply shift override if active for this date
                scheduleToDisplay.shift = getShiftForDate(dateSGT);
                scheduleHistory[dateStr] = firebaseSchedule;
                localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
            } else if (localSchedule) {
                // Use localStorage schedule
                scheduleToDisplay = localSchedule;
                // Apply shift override if active for this date
                scheduleToDisplay.shift = getShiftForDate(dateSGT);
                saveScheduleToFirebase(localSchedule); // Sync to Firebase
            } else {
                // Generate new schedule
                scheduleToDisplay = generateScheduleForDate(dateSGT);
                scheduleHistory[dateStr] = scheduleToDisplay;
                localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
                saveScheduleToFirebase(scheduleToDisplay);
            }
            
            displaySchedule(scheduleToDisplay);
        });
    } else {
        // No Firebase - use localStorage 
        if (scheduleHistory[dateStr]) {
            let schedule = scheduleHistory[dateStr];
            // Apply shift override if active for this date
            schedule.shift = getShiftForDate(dateSGT);
            scheduleHistory[dateStr] = schedule;
            localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
            displaySchedule(schedule);
        } else {
            const schedule = generateScheduleForDate(dateSGT);
            scheduleHistory[dateStr] = schedule;
            localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
            displaySchedule(schedule);
        }
    }
}

// ---------- DISPLAY ----------
function displaySchedule(schedule) {
    const tbody = document.getElementById("scheduleTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const allPlatforms = [...platforms.main, ...platforms.common, ...platforms.grouped];
    allPlatforms.forEach(plat => {
        if (!schedule.platforms[plat]) return;
        const tr = document.createElement("tr");
        const inCharge = schedule.platforms[plat].inCharge;
        const responsibility = schedule.platforms[plat].responsibility;
// Show edit button for BOTH admin AND guest
        const editBtn = (isAdmin || isGuest) ? 
            `<button class="edit-schedule-btn ${isGuest ? 'guest-only' : 'admin-only'}" onclick="openEditScheduleModal(scheduleHistory['${schedule.date}'], '${plat}')">
                <i class="fas fa-edit"></i> Edit
            </button>` : "";        
            
            tr.innerHTML = `
            <td><strong>${plat}</strong></td>
            <td>${inCharge}</td>
            <td>${responsibility}</td>
            <td>${editBtn}</td>
        `;
        tbody.appendChild(tr);
    });
    displayAdditionalTasks(schedule);
    
    const shiftBadge = document.getElementById('currentShiftBadge');
    if (shiftBadge && schedule.shift) {
        const shift = SHIFT_TYPES[schedule.shift];
        if (shift) {
            const editBtn = isAdmin ? `<button id="editShiftBtn" class="btn-icon admin-only" onclick="openEditShiftModal()" title="Edit Shift" style="margin-left: 10px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.5); color: var(--primary); padding: 5px 25px; border-radius: 5px; cursor: pointer;"><i class="fas fa-edit"></i> Edit</button>` : '';
            shiftBadge.innerHTML = `<i class="fas fa-clock"></i> ${shift.name} Shift (${shift.label}) ${editBtn}`;
        }
    }

    // Apply drag/drop ordering if available
    if (typeof loadAndApplyPlatformOrder === 'function') {
        loadAndApplyPlatformOrder();
    }

    // Initialize drag/drop if admin
    if (typeof initDragAndDrop === 'function' && isAdmin) {
        initDragAndDrop();
    }

    // Refresh AI controls if admin
    if (isAdmin) {
        setTimeout(() => {
            if (!document.getElementById('aiLearningControls')) {
                if (typeof addAILearningControls === 'function') {
                    addAILearningControls();
                }
            }
            if (!document.getElementById('resetOrderBtn')) {
                if (typeof addResetOrderButton === 'function') {
                    addResetOrderButton();
                }
            }
        }, 100);
    }
}

function displayAdditionalTasks(schedule) {
    const tasksGrid = document.getElementById("additionalTasksGrid");
    if (!tasksGrid) return;
    
    // ✅ DEBUG: Log tasks being displayed
    
    tasksGrid.innerHTML = "";
    
    // ✅ GET TASK LIST (custom or default)
    const requiredTasks = (typeof getAdditionalTasksList === 'function') 
        ? getAdditionalTasksList() 
        : [
            "Email Handle",
            "Follow Up Remainder",
            "SIEM Device Status",
            "HO PPT Update",
            "Handover Presentation",
            "Handover Summary"
        ];
    
    // Check for missing tasks and add them with fallback
    requiredTasks.forEach(taskName => {
        if (!schedule.tasks[taskName]) {
            schedule.tasks[taskName] = "All SA's";
        }
    });
    
    // Display all tasks in the required order
    requiredTasks.forEach(taskName => {
        const assigned = schedule.tasks[taskName];
        
        // Show edit button for BOTH admin AND guest
        const editBtn = (isAdmin || isGuest) ? 
            `<button class="edit-task-btn ${isGuest ? 'guest-only' : 'admin-only'}" onclick="openEditTaskModal(scheduleHistory['${schedule.date}'], '${taskName}')">
                <i class="fas fa-edit"></i>
            </button>` : "";        
        
        const card = document.createElement("div");
        card.className = "task-card";
        card.innerHTML = `
            <h4><i class="fas fa-tasks"></i> ${taskName} ${editBtn}</h4>
            <p>${assigned}</p>
        `;
        tasksGrid.appendChild(card);
    });

    // Load and apply task order
    if (typeof loadAndApplyTaskOrder === 'function') {
        loadAndApplyTaskOrder();
    }
    
    // Initialize drag/drop
    if (typeof initDragAndDrop === 'function' && isAdmin) {
        initDragAndDrop();
    }
}

function updateCurrentDayDisplay(date) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const title = document.getElementById("currentDayTitle");
    if (title) {
        title.textContent = `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    }
}

function updateCurrentShiftInfo(date) {
    const currentShift = getCurrentShift(date);
    const shift = SHIFT_TYPES[currentShift];
    const shiftType = document.getElementById("shiftType");
    if (shiftType) {
        shiftType.textContent = `${shift.name} (${shift.label})`;
    }
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", () => {
// Initialize everything first
    initNavigation();
    initUserSystem();
    initThemeToggle();
    initScrollProgress();
    initBackToTop();
    initHeroAnimations();
    initAdminAccess();
    initScheduleFeatures();
    initTeamManagement();
    initContactForm();
    initScrollAnimations();

    // Load team data from Firebase if available
    if (typeof database !== 'undefined') {
        if (typeof loadTeamDataFromFirebase === 'function') {
            loadTeamDataFromFirebase(() => {
                // Callback after Firebase load completes
                loadTeamData();
                updateTotalMembersCount(); // Now safe to call
            });
        } else {
            loadTeamData();
            updateTotalMembersCount();
        }
        if (typeof loadAvailabilityFromFirebase === 'function') loadAvailabilityFromFirebase();
        initAvailabilityStatus();
    } else {
        // ✅ Ensure teamData exists from localStorage
        if (!teamData.SAs || !teamData.apprentices) {
            teamData = {
                SAs: [],
                apprentices: [],
                responsibilities: {}
            };
        }
        loadTeamData();
        updateTotalMembersCount();
        initAvailabilityStatus();
    }

    // ✅ Generate today's schedule with correct SGT date
    const todaySGT = getNowSGT();
    lastCheckedDate = formatDateForInput(todaySGT);  // ✅ Add this line
    generateDailySchedule(todaySGT);

    // Initialize clocks
    initSGTClocks();
    setInterval(updateLiveClocks, 1000);
    setInterval(updateAvailabilityStatus, 60000);
    setInterval(checkForMidnightUpdate, 60000);

    // **THE SKELETON HIDING CODE** ✅
    // Hide skeleton after content is ready
    setTimeout(() => {
        const skeleton = document.getElementById("heroSkeleton");
        const heroContent = document.querySelector(".hero-content > *:not(#heroSkeleton)");
        
        if (skeleton) {
            skeleton.classList.add("hidden");
        }
        
        // Show real content
        if (heroContent) {
            heroContent.style.opacity = "0";
            heroContent.style.display = "block";
            setTimeout(() => {
                heroContent.style.opacity = "1";
            }, 100);
        }
    }, 1500); // Adjust timing as needed

    setTimeout(() => {
        // Initialize AI Learning
        if (typeof analyzeAndLearnPatterns === 'function') {
            analyzeAndLearnPatterns();
        }

        // If already logged in as admin, add controls
        if (isAdmin) {
            if (typeof addAILearningControls === 'function') {
                addAILearningControls();
            }
            if (typeof addResetOrderButton === 'function') {
                addResetOrderButton();
            }
        }

        // Hide loading spinner
        const spinner = document.getElementById("loading-spinner");
        if (spinner) {
            spinner.classList.add("hidden");
        }

    }, 500); // currently adjust loading for skeleton
});

// ---------- LIVE CLOCKS ----------
function initSGTClocks() {
    updateLiveClocks();
}

function updateLiveClocks() {
    const nowSGT = getNowSGT();
    document.querySelectorAll(".sgt-time").forEach(el => {
        el.textContent = formatSGTTime(nowSGT);
    });
    const mainSGTTime = document.getElementById("mainSGTTime");
    if (mainSGTTime) mainSGTTime.textContent = formatSGTTime(nowSGT);
    const workingHoursDisplay = document.getElementById("workingHoursDisplay");
    if (workingHoursDisplay) workingHoursDisplay.textContent = getWorkingHoursDisplay();
    const shiftScheduleDisplay = document.getElementById("shiftSchedule");
    if (shiftScheduleDisplay) {
        const currentShift = getCurrentShift(nowSGT);
        const shift = SHIFT_TYPES[currentShift];
        shiftScheduleDisplay.textContent = `Current: ${shift.name} Shift (${shift.label})`;
    }
    const footerSGT = document.getElementById("footerSGT");
    if (footerSGT) footerSGT.textContent = formatSGTTime(nowSGT);
    const availabilitySGT = document.getElementById("availabilitySGT");
    if (availabilitySGT) availabilitySGT.textContent = formatSGTDateTime(nowSGT);
    const shiftIndicator = document.getElementById("currentShiftIndicator");
    if (shiftIndicator) {
        const currentShift = getCurrentShift(nowSGT);
        const shift = SHIFT_TYPES[currentShift];
        shiftIndicator.innerHTML = `<i class="fas fa-clock"></i> ${shift.name} Shift | ${formatSGTTime(nowSGT)} SGT`;
    }
}

// ---------- NAVIGATION ----------
function initNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const mobileToggle = document.getElementById("mobileToggle");
    const navMenu = document.getElementById("navMenu");
    navLinks.forEach(link => {
        link.addEventListener("click", e => {
            const href = link.getAttribute("href");
            
            // ✅ Allow external links (like ../main_app.html) to navigate normally
            if (!href.startsWith("#")) {
                // Don't prevent default - let the link work normally
                if (navMenu) navMenu.classList.remove("active");
                return;
            }
            
            // For hash links (#schedule, #team, etc.), use smooth scroll
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) target.scrollIntoView({ behavior: "smooth" });
            if (navMenu) navMenu.classList.remove("active");
        });
    });
    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener("click", () => {
            navMenu.classList.toggle("active");
        });
    }
    window.addEventListener("scroll", () => {
        let current = "";
        document.querySelectorAll("section").forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.pageYOffset >= sectionTop - 200) {
                current = section.getAttribute("id");
            }
        });
        navLinks.forEach(link => {
            link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
        });
    });
}

// ---------- THEME ----------
function initThemeToggle() {
    const themeToggle = document.getElementById("themeToggle");
    if (!themeToggle) return;
    const currentTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", currentTheme);
    updateThemeIcon(currentTheme);
    themeToggle.addEventListener("click", () => {
        const theme = document.documentElement.getAttribute("data-theme");
        const newTheme = theme === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector("#themeToggle i");
    if (!icon) return;
    icon.className = theme === "light" ? "fas fa-moon" : "fas fa-sun";
}

// ---------- SCROLL PROGRESS & BACK TO TOP ----------
function initScrollProgress() {
    window.addEventListener("scroll", () => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
        const bar = document.getElementById("scrollProgress");
        if (bar) bar.style.width = `${scrolled}%`;
    });
}

function initBackToTop() {
    const backToTop = document.getElementById("backToTop");
    if (!backToTop) return;
    window.addEventListener("scroll", () => {
        backToTop.classList.toggle("show", window.pageYOffset > 300);
    });
    backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// ---------- HERO ----------
function initHeroAnimations() {
    const typingText = document.getElementById("typingText");
    const text = "Work Schedule Manager";
    let index = 0;
    let deleting = false;
    function typeLoop() {
        if (!typingText) return;
        const speed = deleting ? 80 : 120;
        if (!deleting && index <= text.length) {
            typingText.textContent = text.substring(0, index);
            index++;
        } else if (deleting && index >= 0) {
            typingText.textContent = text.substring(0, index);
            index--;
        }
        if (index === text.length + 1) {
            deleting = true;
            setTimeout(typeLoop, 1000);
            return;
        }
        if (index === -1) {
            deleting = false;
            index = 0;
        }
        setTimeout(typeLoop, speed);
    }
    typeLoop();
    const counters = document.querySelectorAll(".stat-number");
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute("data-target"), 10);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;
        const updateCounter = () => {
            current += step;
            if (current < target) {
                counter.textContent = Math.floor(current);
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = target;
            }
        };
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                updateCounter();
                observer.disconnect();
            }
        });
        observer.observe(counter);
    });
}

// ---------- ADMIN ACCESS ----------

function initAdminAccess() {
    const adminToggle = document.getElementById("adminToggle");
    const adminLoginModal = document.getElementById("adminLoginModal");
    const adminLoginForm = document.getElementById("adminLoginForm");
    
    // saved admin mode
    const oldAdmin = localStorage.getItem("isAdmin");
    if (oldAdmin === "true" && !currentUser) {
        localStorage.removeItem("isAdmin");
    }
    
    if (adminToggle) {
        adminToggle.addEventListener("click", () => {
            if (currentUser) {
                logoutUser();
            } else {
                if (adminLoginModal) {
                    adminLoginModal.classList.add("show");
                    
                    // Add reset password button if not exists
                    addResetPasswordButtonToLogin();
                }
            }
        });
    }
    
if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const password = document.getElementById("adminPassword").value.trim();
        
        // 1) Check Admin Password
        const isAdmin_ = await verifyPassword(password, userCredentials.admin.password);
        if (isAdmin_) {
            currentUser = { username: 'admin', role: 'admin' };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            setAdminMode(true);
            isGuest = false;
            if (adminLoginModal) adminLoginModal.classList.remove("show");
            adminLoginForm.reset();
            showNotification("Admin mode enabled", "success");
            return;
        }

        // 2) Check Guest Password
        const isGuest_ = await verifyPassword(password, userCredentials.guest.password);
        if (isGuest_) {
            // Initialize activeSessions if it doesn't exist
            if (!userCredentials.guest.activeSessions) {
                userCredentials.guest.activeSessions = [];
            }
            
            if (userCredentials.guest.activeSessions.length >= userCredentials.guest.maxUsers) {
                showNotification("❌ Unauthorized access", "error");
                return;
            }
            
            const sessionId = generateSessionId();
            userCredentials.guest.activeSessions.push(sessionId);
            saveUserCredentials();
            
            currentUser = { 
                username: 'guest', 
                role: 'guest',
                sessionId: sessionId
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            setGuestMode(true);
            isGuest = true;
            if (adminLoginModal) adminLoginModal.classList.remove("show");
            adminLoginForm.reset();
            showNotification(`Welcome User! - ${userCredentials.guest.activeSessions.length}/2 active`, "success");

            if (typeof addGuestFeatures === 'function') addGuestFeatures();

            // ✅ Force refresh display
            setTimeout(() => {
                const dateInput = document.getElementById("scheduleDate");
                if (dateInput && dateInput.value) {
                    const selected = new Date(dateInput.value);
                    if (typeof generateDailySchedule === 'function') {
                        generateDailySchedule(selected);
                    }
                }
            }, 300);
            return;
        }

        // 3) Handle Incorrect Password
        showNotification("Invalid password", "error");
    }); 
}
    
    document.querySelectorAll("#adminLoginModal .modal-close").forEach(btn => {
        btn.addEventListener("click", () => {
            if (adminLoginModal) adminLoginModal.classList.remove("show");
        });
    });
}

// Add reset password button to login modal
function addResetPasswordButtonToLogin() {
    const loginModal = document.getElementById('adminLoginModal');
    if (!loginModal) return;
    
    let resetBtn = document.getElementById('loginResetPasswordBtn');
    if (!resetBtn) {
        const modalContent = loginModal.querySelector('.modal-content');
        const loginBtn = loginModal.querySelector('button[type="submit"]');
        
        if (modalContent && loginBtn) {
            resetBtn = document.createElement('button');
            resetBtn.id = 'loginResetPasswordBtn';
            resetBtn.type = 'button';
            resetBtn.className = 'btn btn-secondary';
            resetBtn.style.cssText = 'width: 100%; margin-top: 15px; background: linear-gradient(135deg, #f5576c 100%, #f093fb 0%); border: none;';
            resetBtn.innerHTML = '<i class="fas fa-key"></i> Reset Password';
            resetBtn.onclick = openResetPasswordModal;
            
            loginBtn.parentElement.appendChild(resetBtn);
        }
    }
}

// Add password toggle to login modal
function addPasswordToggleToLogin() {
    const passwordInput = document.getElementById('adminPassword');
    if (!passwordInput || passwordInput.dataset.toggleAdded) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'password-input-container';
    wrapper.style.position = 'relative';
    
    passwordInput.parentNode.insertBefore(wrapper, passwordInput);
    wrapper.appendChild(passwordInput);
    
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'password-toggle-btn';
    toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    toggleBtn.onclick = () => togglePasswordVisibility('adminPassword');
    
    wrapper.appendChild(toggleBtn);
    passwordInput.dataset.toggleAdded = 'true';
}

/*admin old
function initAdminAccess() {
    const adminToggle = document.getElementById("adminToggle");
    const adminLoginModal = document.getElementById("adminLoginModal");
    const adminLoginForm = document.getElementById("adminLoginForm");
    const savedAdmin = localStorage.getItem("isAdmin") === "true";
    if (savedAdmin) setAdminMode(true);
    if (adminToggle) {
        adminToggle.addEventListener("click", () => {
            if (isAdmin) {
                setAdminMode(false);
                localStorage.setItem("isAdmin", "false");
                showNotification("Admin mode disabled");
            } else {
                if (adminLoginModal) adminLoginModal.classList.add("show");
            }
        });
    }
    if (adminLoginForm) {
        adminLoginForm.addEventListener("submit", e => {
            e.preventDefault();
            const password = document.getElementById("adminPassword").value.trim();
            if (password === "admin123") {
                setAdminMode(true);
                localStorage.setItem("isAdmin", "true");
                if (adminLoginModal) adminLoginModal.classList.remove("show");
                adminLoginForm.reset();
                showNotification("Admin mode enabled");
            } else {
                showNotification("Invalid password", "error");
            }
        });
    }
    document.querySelectorAll("#adminLoginModal .modal-close").forEach(btn => {
        btn.addEventListener("click", () => {
            if (adminLoginModal) adminLoginModal.classList.remove("show");
        });
    });
} */

function setAdminMode(enabled) {
    isAdmin = enabled;
    document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", !enabled));
    const adminNotice = document.getElementById("adminNotice");
    if (adminNotice) adminNotice.classList.toggle("hidden", enabled);
    const adminToggle = document.getElementById("adminToggle");
    if (adminToggle) adminToggle.classList.toggle("active", enabled);
    updateAvailabilityStatus();
    const dateInput = document.getElementById("scheduleDate");
    if (dateInput && dateInput.value) {
        const selected = new Date(dateInput.value);
        const schedule = scheduleHistory[selected.toISOString().split("T")[0]];
        if (schedule) displaySchedule(schedule);
    }

    // Manage AI Learning controls
    if (enabled) {
        // Remove old controls first
        const oldAIControls = document.getElementById('aiLearningControls');
        if (oldAIControls) oldAIControls.remove();
        const oldResetBtn = document.getElementById('resetOrderBtn');
        if (oldResetBtn) oldResetBtn.remove();

        // Add new controls
        setTimeout(() => {
            if (typeof addAILearningControls === 'function') {
                addAILearningControls();
            }
            if (typeof addResetOrderButton === 'function') {
                addResetOrderButton();
            }
        }, 100);
    } else {
        // Remove controls when admin disabled
        const aiControls = document.getElementById('aiLearningControls');
        if (aiControls) aiControls.remove();
        const resetBtn = document.getElementById('resetOrderBtn');
        if (resetBtn) resetBtn.remove();
    }
}

// ---------- SCHEDULE FEATURES ----------
function initScheduleFeatures() {
    const dateInput = document.getElementById("scheduleDate");
    const todaySGT = getNowSGT();
    
    // ✅ Set initial date to current SGT date
    if (dateInput) {
        dateInput.value = formatDateForInput(todaySGT);
    }
    
        // Event listener for manual date change
        if (dateInput) {
        dateInput.addEventListener("change", () => {
        // ✅ FIX: Parse date correctly and convert to SGT
        const selectedDateStr = dateInput.value; // Format: "2026-01-25"
        const [year, month, day] = selectedDateStr.split('-').map(Number);
        
        // Create date in SGT timezone (UTC+8)
        const selectedDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const sgtOffset = 8 * 60; // SGT is UTC+8
        const utcOffset = selectedDate.getTimezoneOffset();
        const sgtDate = new Date(selectedDate.getTime() + (sgtOffset + utcOffset) * 60000);
        
        
        generateDailySchedule(sgtDate);
    });
}
    
    // "Today" button - shows current SGT date schedule (no regeneration)
    const todayBtn = document.getElementById("todayBtn");
    if (todayBtn) {
        todayBtn.addEventListener("click", () => {
            const nowSGT = getNowSGT();
            const dateStr = formatDateForInput(nowSGT);
            
            if (dateInput) {
                dateInput.value = dateStr;
            }
            
            
            // Load existing schedule (don't regenerate)
            generateDailySchedule(nowSGT);
            showNotification("Showing today's schedule");
        });
    }
    
    // ✅ "Generate Today" button - rechecks availability and regenerates once
    const genBtn = document.getElementById("generateSchedule");
    if (genBtn) {
        genBtn.addEventListener("click", () => {
            const nowSGT = getNowSGT();
            const dateStr = formatDateForInput(nowSGT);
            
            // Delete existing schedule to force regeneration
            delete scheduleHistory[dateStr];
            localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
            
            if (dateInput) {
                dateInput.value = dateStr;
            }
            
            
            // Generate new schedule with current availability
            generateDailySchedule(nowSGT);
            showNotification("Today's schedule generated successfully!");
        });
    }
    
    const dlBtn = document.getElementById("downloadSchedule");
    if (dlBtn) {
        dlBtn.addEventListener("click", () => {
            try {
                downloadScheduleAsCSV();
            } catch (error) {
                showNotification(`Download failed: ${error.message}`, 'error');
            }
        });
    } else {
    }
    
    const toggleWeekBtn = document.getElementById("toggleWeekView");
    if (toggleWeekBtn) {
        toggleWeekBtn.addEventListener("click", () => {
            try {
                const weekDiv = document.getElementById("weekSchedule");
                if (!weekDiv) {
                    showNotification('Error: Week view container not found', 'error');
                    return;
                }
                
                if (weekDiv.style.display === "none" || !weekDiv.style.display) {
                    generateWeekView();
                    weekDiv.style.display = "block";
                    toggleWeekBtn.innerHTML = '<i class="fas fa-calendar-day"></i> Show Day View';
                } else {
                    weekDiv.style.display = "none";
                    toggleWeekBtn.innerHTML = '<i class="fas fa-calendar-week"></i> Show Full Week';
                }
            } catch (error) {
                showNotification(`Week view error: ${error.message}`, 'error');
            }
        });
    } else {
    }
}

function generateWeekView() {
    try {
        const weekDiv = document.getElementById('weekSchedule');
        if (!weekDiv) {
            return;
        }
        
        // Check if required dependencies exist
        if (typeof platforms === 'undefined') {
            showNotification('Error: Schedule data not loaded', 'error');
            return;
        }
        
        if (typeof scheduleHistory === 'undefined') {
            showNotification('Error: Schedule history not loaded', 'error');
            return;
        }
        
        if (typeof generateScheduleForDate !== 'function') {
            showNotification('Error: Schedule generator not loaded', 'error');
            return;
        }
        
        
        const dateInput = document.getElementById('scheduleDate');
        const currentDate = new Date(dateInput ? dateInput.value : getNowSGT());
        const monday = new Date(currentDate);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        
        let html = '<div class="week-view-table"><table class="schedule-table"><thead><tr><th>Platform / Task</th>';
        const weekSchedules = [];
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
            html += `<th>${dn} ${d.getDate()}/${d.getMonth() + 1}</th>`;
            
            const dateStr = d.toISOString().split('T')[0];
            let schedule;
            if (scheduleHistory[dateStr]) {
                schedule = scheduleHistory[dateStr];
            } else {
                schedule = generateScheduleForDate(d);
                scheduleHistory[dateStr] = schedule;
                localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
            }
            weekSchedules.push(schedule);
        }
        
        html += '</tr></thead><tbody>';
        const allPlatforms = [...platforms.main, ...platforms.common, ...platforms.grouped];
        allPlatforms.forEach(p => {
            html += `<tr><td><strong>${p}</strong></td>`;
            weekSchedules.forEach(s => {
                const a = s.platforms[p];
                html += `<td>${a ? a.inCharge : '-'}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        weekDiv.innerHTML = html;
        
        showNotification('Week view loaded', 'success');
        
    } catch (error) {
        showNotification(`Error generating week view: ${error.message}`, 'error');
    }
}

// CSV downloaded 
function downloadScheduleAsCSV() {
    try {
        // Check if required dependencies exist
        if (typeof platforms === 'undefined') {
            showNotification('Error: Schedule data not loaded', 'error');
            return;
        }
        
        if (typeof scheduleHistory === 'undefined') {
            showNotification('Error: Schedule history not loaded', 'error');
            return;
        }
        
        if (typeof generateScheduleForDate !== 'function') {
            showNotification('Error: Schedule generator not loaded', 'error');
            return;
        }
        
        
        const dateInput = document.getElementById("scheduleDate");
        const currentDate = new Date(dateInput ? dateInput.value : getNowSGT());
        
        // Calculate Monday of the week
        const monday = new Date(currentDate);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        
        // Generate week schedules
        const weekSchedules = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            
            let schedule;
            if (scheduleHistory[dateStr]) {
                schedule = scheduleHistory[dateStr];
            } else {
                schedule = generateScheduleForDate(d);
                scheduleHistory[dateStr] = schedule;
                localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
            }
            
            weekSchedules.push({
                date: dateStr,
                dayName: dayNames[d.getDay()],
                dayDate: `${d.getDate()}/${d.getMonth() + 1}`,
                schedule: schedule
            });
        }
        
        // Build CSV with full week
        let csv = "WEEKLY WORK SCHEDULE\n";
        csv += `Week Starting: ${weekSchedules[0].date}\n\n`;
        
        // Header row with all days
        csv += "Platform / Task";
        weekSchedules.forEach(day => {
            csv += `,${day.dayName} ${day.dayDate}`;
        });
        csv += "\n";
        
        // Get all platforms
        const allPlatforms = [...platforms.main, ...platforms.common, ...platforms.grouped];
        
        // Platform assignments for each day
        allPlatforms.forEach(platform => {
            csv += platform;
            weekSchedules.forEach(day => {
                const assignment = day.schedule.platforms[platform];
                csv += `,${assignment ? assignment.inCharge : '-'}`;
            });
            csv += "\n";
        });
        
        // Add tasks section
        csv += "\nTASKS\n";
        csv += "Task Name";
        weekSchedules.forEach(day => {
            csv += `,${day.dayName} ${day.dayDate}`;
        });
        csv += "\n";
        
        // Get all unique tasks
        const allTasks = new Set();
        weekSchedules.forEach(day => {
            Object.keys(day.schedule.tasks).forEach(task => allTasks.add(task));
        });
        
        // Task assignments for each day
        allTasks.forEach(task => {
            csv += task;
            weekSchedules.forEach(day => {
                csv += `,${day.schedule.tasks[task] || '-'}`;
            });
            csv += "\n";
        });
        
        // Download
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `weekly_schedule_${weekSchedules[0].date}.csv`;
        document.body.appendChild(a); // ✅ Add to DOM before clicking
        a.click();
        document.body.removeChild(a); // ✅ Clean up
        window.URL.revokeObjectURL(url);
        
        showNotification("Weekly schedule downloaded successfully!", "success");
        
    } catch (error) {
        showNotification(`Error downloading CSV: ${error.message}`, 'error');
    }
}

// ---------- TEAM MANAGEMENT ----------
function initTeamManagement() {
    const addSABtn = document.getElementById("addSA");
    const addAppBtn = document.getElementById("addApprentice");
    if (addSABtn) {
        addSABtn.addEventListener("click", () => openAddMemberModal("SA"));
    }
    if (addAppBtn) {
        addAppBtn.addEventListener("click", () => openAddMemberModal("Apprentice"));
    }
}

function loadTeamData() {
    displayTeamMembers("SAs", "saList");
    displayTeamMembers("apprentices", "apprenticeList");
}

function displayTeamMembers(category, listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = "";
    
    const maxCount = Math.max(teamData.SAs.length, teamData.apprentices.length);
    const currentCategory = category === "SAs" ? teamData.SAs : teamData.apprentices;
    
    currentCategory.forEach(member => {
        const li = document.createElement("li");
        li.className = "member-item";
        const actions = isAdmin ? `
            <div class="member-actions admin-only">
                <button class="btn-icon edit" onclick="editMember('${category}', '${member}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete" onclick="deleteMember('${category}', '${member}')"><i class="fas fa-trash"></i></button>
            </div>
        ` : "";
        li.innerHTML = `
            <div class="member-name">
                <i class="fas fa-user"></i>
                <span>${member}</span>
            </div>
            ${actions}
        `;
        list.appendChild(li);
    });
    
    const emptyBoxesNeeded = maxCount - currentCategory.length;
    for (let i = 0; i < emptyBoxesNeeded; i++) {
        const li = document.createElement("li");
        li.className = "member-item empty-box";
        li.innerHTML = `
            <div class="member-name empty-placeholder">
                <i class="fas fa-user-slash"></i>
                <span>Empty Slot</span>
            </div>
        `;
        list.appendChild(li);
    }
}

function openAddMemberModal(type) {
    if (!isAdmin) return;
    const modal = document.getElementById("addMemberModal");
    if (!modal) return;
    const modalTitle = modal.querySelector("h3");
    if (modalTitle) modalTitle.textContent = `Add New ${type}`;
    modal.classList.add("show");
    const form = document.getElementById("addMemberForm");
    if (!form) return;
    form.onsubmit = e => {
        e.preventDefault();
        const nameInput = document.getElementById("memberName");
        const name = nameInput ? nameInput.value.trim() : "";
        if (!name) {
            showNotification("Please enter a name", "error");
            return;
        }
        const category = type === "SA" ? "SAs" : "apprentices";
        if (teamData[category].includes(name)) {
            showNotification("Member already exists", "error");
            return;
        }
        teamData[category].push(name);
        localStorage.setItem("teamData", JSON.stringify(teamData));
        
        if (typeof database !== 'undefined' && typeof checkAndAddUser === 'function') {
            checkAndAddUser(name, type, (success) => {
                if (success) {
                    if (typeof saveTeamDataToFirebase === 'function') saveTeamDataToFirebase();
                }
            });
        }
        
        displayTeamMembers(category, type === "SA" ? "saList" : "apprenticeList");
        updateTotalMembersCount();
        modal.classList.remove("show");
        form.reset();
        showNotification(`${type} added successfully`);
    };
    modal.querySelectorAll(".modal-close").forEach(btn => {
        btn.onclick = () => {
            modal.classList.remove("show");
            if (form) form.reset();
        };
    });
}

function editMember(category, oldName) {
    if (!isAdmin) return;
    const newName = prompt("Edit member name:", oldName);
    if (!newName || !newName.trim()) return;
    const idx = teamData[category].indexOf(oldName);
    if (idx !== -1) {
        teamData[category][idx] = newName.trim();
        localStorage.setItem("teamData", JSON.stringify(teamData));
        
        if (typeof database !== 'undefined') {
            const role = category === "SAs" ? "SA" : "Apprentice";
            if (typeof deleteUserFromRole === 'function' && typeof checkAndAddUser === 'function') {
                deleteUserFromRole(oldName, role, () => {
                    checkAndAddUser(newName.trim(), role, () => {
                        if (typeof saveTeamDataToFirebase === 'function') saveTeamDataToFirebase();
                    });
                });
            }
        }
        
        displayTeamMembers(category, category === "SAs" ? "saList" : "apprenticeList");
        showNotification("Member updated successfully");
    }
}

function deleteMember(category, name) {
    if (!isAdmin) return;
    if (!confirm(`Delete ${name}?`)) return;
    const idx = teamData[category].indexOf(name);
    if (idx !== -1) {
        teamData[category].splice(idx, 1);
        localStorage.setItem("teamData", JSON.stringify(teamData));
        
        if (typeof database !== 'undefined') {
            const role = category === "SAs" ? "SA" : "Apprentice";
            if (typeof deleteUserFromRole === 'function') {
                deleteUserFromRole(name, role, () => {
                    if (typeof saveTeamDataToFirebase === 'function') saveTeamDataToFirebase();
                });
            }
        }
        
        displayTeamMembers(category, category === "SAs" ? "saList" : "apprenticeList");
        updateTotalMembersCount();
        showNotification("Member deleted successfully");
    }
}

function updateTotalMembersCount() {
 // ✅ Ensure arrays exist before calculating
    const saCount = Array.isArray(teamData.SAs) ? teamData.SAs.length : 0;
    const appCount = Array.isArray(teamData.apprentices) ? teamData.apprentices.length : 0;
    const total = saCount + appCount;    
 // Update all stat counters
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(el => {
 // Find the stat item that shows "Total Members"
        const parentStatItem = el.closest('.stat-item');
        if (parentStatItem) {
            const label = parentStatItem.querySelector('p');
            if (label && label.textContent.includes('Total Members')) {
                el.setAttribute('data-target', total);
                el.textContent = total;
                
                // Trigger counter animation
                animateCounter(el, total);
            }
        }
    });
    
}

// Helper function for counter animation
function animateCounter(element, target) {
    const duration = 1000; // 1 second
    const step = target / (duration / 16); // 60fps
    let current = 0;
    
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// ---------- AVAILABILITY STATUS ----------
function initAvailabilityStatus() {
    updateAvailabilityStatus();
}

function updateAvailabilityStatus() {
    const nowSGT = getNowSGT();
    const saAvailList = document.getElementById("saAvailability");
    const appAvailList = document.getElementById("appAvailability");
    
    if (saAvailList) {
        saAvailList.innerHTML = "";
        teamData.SAs.forEach(sa => {
            const available = isMemberAvailableOnDate(sa, nowSGT, "SA");
            const li = document.createElement("li");
            li.className = "availability-item";

            // ✅ Show actions for BOTH admin AND guest
            const actions = (isAdmin || isGuest) ? `
                <div class="member-actions-inline ${isGuest ? 'guest-only' : 'admin-only'}">
                    <button class="btn-icon-inline" onclick="toggleMemberAvailability('${sa}', 'SA')" title="Toggle Availability">
                        <i class="fas fa-eye${available ? '' : '-slash'}" style="color: ${available ? '#10b981' : '#ef4444'}"></i>
                    </button>
                    ${isAdmin ? `
                    <button class="btn-icon-inline" onclick="editMemberInAvailability('${sa}', 'SA')" title="Edit Member">
                        <i class="fas fa-edit" style="color: #3b82f6"></i>
                    </button>
                    <button class="btn-icon-inline" onclick="removeMemberFromAvailability('${sa}', 'SA')" title="Remove Member">
                        <i class="fas fa-trash" style="color: #ef4444"></i>
                    </button>
                    ` : ''}
                </div>
            ` : '';
            

            li.innerHTML = `
                <div class="member-info">
                    <span class="status-icon ${available ? 'status-available' : 'status-unavailable'}">
                        <i class="fas fa-${available ? 'check-circle' : 'times-circle'}"></i>
                    </span>
                    <span class="member-name-text">${sa}</span>
                </div>
            ${actions}
            
            `;
            saAvailList.appendChild(li);
        });
    }
    
    if (appAvailList) {
        appAvailList.innerHTML = "";
        teamData.apprentices.forEach(app => {
            const available = isMemberAvailableOnDate(app, nowSGT, "Apprentice");
            const li = document.createElement("li");
            li.className = "availability-item";
            
            // ✅ Show actions for BOTH admin AND guest
            const actions = (isAdmin || isGuest) ? `
                <div class="member-actions-inline ${isGuest ? 'guest-only' : 'admin-only'}">
                    <button class="btn-icon-inline" onclick="toggleMemberAvailability('${app}', 'Apprentice')" title="Toggle Availability">
                        <i class="fas fa-eye${available ? '' : '-slash'}" style="color: ${available ? '#10b981' : '#ef4444'}"></i>
                    </button>
                    ${isAdmin ? `
                    <button class="btn-icon-inline" onclick="editMemberInAvailability('${app}', 'Apprentice')" title="Edit Member">
                        <i class="fas fa-edit" style="color: #3b82f6"></i>
                    </button>
                    <button class="btn-icon-inline" onclick="removeMemberFromAvailability('${app}', 'Apprentice')" title="Remove Member">
                        <i class="fas fa-trash" style="color: #ef4444"></i>
                    </button>
                    ` : ''}
                </div>
            ` : '';

            li.innerHTML = `
                <div class="member-info">
                    <span class="status-icon ${available ? 'status-available' : 'status-unavailable'}">
                        <i class="fas fa-${available ? 'check-circle' : 'times-circle'}"></i>
                    </span>
                    <span class="member-name-text">${app}</span>
                </div>
            ${actions}

            `;
            appAvailList.appendChild(li);
        });
    }

    // ✅ ADD EMPTY BOXES TO EQUALIZE COLUMNS
    if (saAvailList && appAvailList) {
        const saCount = teamData.SAs.length;
        const appCount = teamData.apprentices.length;
        const maxCount = Math.max(saCount, appCount);

        // Add empty slots to SA column
        const saEmptyCount = maxCount - saCount;
        for (let i = 0; i < saEmptyCount; i++) {
            const li = document.createElement('li');
            li.className = 'availability-item empty-slot';
            li.innerHTML = `
                <div class="member-info">
                    <i class="fas fa-user-slash" style="margin-right: 8px; opacity: 0.5; color: var(--text-muted);"></i>
                    <span style="font-style: italic; opacity: 0.6; color: var(--text-muted);">Empty Slot</span>
                </div>
            `;
            saAvailList.appendChild(li);
        }

        // Add empty slots to Apprentice column
        const appEmptyCount = maxCount - appCount;
        for (let i = 0; i < appEmptyCount; i++) {
            const li = document.createElement('li');
            li.className = 'availability-item empty-slot';
            li.innerHTML = `
                <div class="member-info">
                    <i class="fas fa-user-slash" style="margin-right: 8px; opacity: 0.5; color: var(--text-muted);"></i>
                    <span style="font-style: italic; opacity: 0.6; color: var(--text-muted);">Empty Slot</span>
                </div>
            `;
            appAvailList.appendChild(li);
        }
    }
}

// ---------- MODAL FUNCTIONS ----------
function openEditScheduleModal(schedule, platform) {
if (!isAdmin && !isGuest) {
        showNotification('Access required', 'error');
        return;
    }    
    
    const modal = document.getElementById("editScheduleModal");
    if (!modal) return;
    const editPlatform = document.getElementById("editPlatform");
    const editInCharge = document.getElementById("editInCharge");
    const editResponsibility = document.getElementById("editResponsibility");
    if (editPlatform) editPlatform.value = platform;
    if (editInCharge) {
        editInCharge.innerHTML = "";
        teamData.SAs.forEach(sa => {
            const opt = document.createElement("option");
            opt.value = sa;
            opt.textContent = sa;
            editInCharge.appendChild(opt);
        });
    }
    const current = schedule.platforms[platform];
    if (current) {
        if (editInCharge) editInCharge.value = current.inCharge;
        if (editResponsibility) editResponsibility.value = current.responsibility;
    }
    modal.classList.add("show");
    const form = document.getElementById("editScheduleForm");
    if (form) {
        form.onsubmit = e => {
            e.preventDefault();
            const newSA = editInCharge ? editInCharge.value : "";
            const newResp = editResponsibility ? editResponsibility.value.trim() : "";
            schedule.platforms[platform] = { inCharge: newSA, responsibility: newResp };
            const dateKey = schedule.date;
            scheduleHistory[dateKey] = schedule;
            localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
            if (typeof database !== 'undefined' && typeof saveScheduleToFirebase === 'function') {
                saveScheduleToFirebase(schedule);
            }
            displaySchedule(schedule);
            modal.classList.remove("show");
            showNotification("Schedule updated successfully");

            if (typeof onScheduleEdited === 'function') {
                onScheduleEdited(schedule);
            }
        };
    }
    modal.querySelectorAll(".modal-close").forEach(btn => {
        btn.onclick = () => {
            modal.classList.remove("show");
        };
    });
}

function openEditTaskModal(schedule, taskName) {
if (!isAdmin && !isGuest) {
        showNotification('Access required', 'error');
        return;
    }
    
    const modal = document.getElementById("editTaskModal");
    if (!modal) return;
    const editTaskName = document.getElementById("editTaskName");
    const editTaskAssigned = document.getElementById("editTaskAssigned");
    if (editTaskName) editTaskName.value = taskName;
    if (editTaskAssigned) editTaskAssigned.value = schedule.tasks[taskName];
    modal.classList.add("show");
    const form = document.getElementById("editTaskForm");
    if (form) {
        form.onsubmit = e => {
            e.preventDefault();
            const newAssigned = editTaskAssigned ? editTaskAssigned.value.trim() : "";
            schedule.tasks[taskName] = newAssigned;
            const dateKey = schedule.date;
            scheduleHistory[dateKey] = schedule;
            localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
            if (typeof database !== 'undefined' && typeof saveScheduleToFirebase === 'function') {
                saveScheduleToFirebase(schedule);
            }
            displaySchedule(schedule);
            modal.classList.remove("show");
            showNotification("Task assignment updated successfully");

            if (typeof onScheduleEdited === 'function') {
                onScheduleEdited(schedule);
            }
        };
    }
    modal.querySelectorAll(".modal-close").forEach(btn => {
        btn.onclick = () => {
            modal.classList.remove("show");
        };
    });
}

function openEditShiftModal() {
    if (!isAdmin) {
        showNotification('Admin access required', 'error');
        return;
    }
    const modal = document.getElementById('editShiftModal');
    if (!modal) return;
    
    const dateInput = document.getElementById('scheduleDate');
    const currentDate = new Date(dateInput ? dateInput.value : getNowSGT());
    const dateStr = currentDate.toISOString().split('T')[0];
    const schedule = scheduleHistory[dateStr];
    
    const editShiftType = document.getElementById('editShiftType');
    if (editShiftType && schedule) {
        editShiftType.value = schedule.shift || 'MORNING';
    }
    
    modal.classList.add('show');
    
    const form = document.getElementById('editShiftForm');
    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const newShift = editShiftType ? editShiftType.value : 'MORNING';
            const applyToDate = document.getElementById('applyToDate').checked;
            
            if (schedule) {
                // Update the current schedule's shift
                schedule.shift = newShift;
                scheduleHistory[dateStr] = schedule;
                localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
                
                // Handle shift override based on checkbox state
                if (applyToDate) {
                    // Checkbox checked: Apply to this date only, no override
                    if (typeof database !== 'undefined' && typeof saveScheduleToFirebase === 'function') {
                        saveScheduleToFirebase(schedule);
                    }
                    displaySchedule(schedule);
                    updateCurrentShiftInfo(currentDate);
                    showNotification(`Shift updated to ${SHIFT_TYPES[newShift].name} for ${dateStr} only!`, 'success');
                } else {
                    // Checkbox unchecked: Set 2-week override starting from selected date
                    const startDate = new Date(currentDate);
                    const endDate = new Date(currentDate);
                    endDate.setDate(endDate.getDate() + 13); // 2 weeks = 14 days total
                    
                    shiftOverride = {
                        startDate: startDate.toISOString().split('T')[0],
                        endDate: endDate.toISOString().split('T')[0],
                        shift: newShift
                    };
                    localStorage.setItem('shiftOverride', JSON.stringify(shiftOverride));
                    
                    // Update all existing schedules in the 2-week range
                    const currentDateObj = new Date(startDate);
                    while (currentDateObj <= endDate) {
                        const dateKey = currentDateObj.toISOString().split('T')[0];
                        if (scheduleHistory[dateKey]) {
                            scheduleHistory[dateKey].shift = newShift;
                        }
                        currentDateObj.setDate(currentDateObj.getDate() + 1);
                    }
                    localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
                    
                    if (typeof database !== 'undefined' && typeof saveScheduleToFirebase === 'function') {
                        saveScheduleToFirebase(schedule);
                    }
                    displaySchedule(schedule);
                    updateCurrentShiftInfo(currentDate);
                    
                    showNotification(`Shift override set to ${SHIFT_TYPES[newShift].name} for 2 weeks (${shiftOverride.startDate} to ${shiftOverride.endDate})!`, 'success');
                }
            }
            
            modal.classList.remove('show');
        };
    }
    
    // Handle Clear Global Override button
    const clearBtn = document.getElementById('clearShiftOverride');
    if (clearBtn) {
        clearBtn.onclick = () => {
            // Clear the 2-week shift override
            if (shiftOverride) {
                const startDate = new Date(shiftOverride.startDate);
                const endDate = new Date(shiftOverride.endDate);
                
                // Clear override
                shiftOverride = null;
                localStorage.removeItem('shiftOverride');
                
                // Update all schedules in the range to use automatic detection
                const currentDateObj = new Date(startDate);
                while (currentDateObj <= endDate) {
                    const dateKey = currentDateObj.toISOString().split('T')[0];
                    if (scheduleHistory[dateKey]) {
                        const dateObj = new Date(dateKey);
                        scheduleHistory[dateKey].shift = getCurrentShift(dateObj);
                    }
                    currentDateObj.setDate(currentDateObj.getDate() + 1);
                }
                localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
                
                // Regenerate current schedule
                const newSchedule = generateScheduleForDate(currentDate);
                scheduleHistory[dateStr] = newSchedule;
                localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
                
                if (typeof database !== 'undefined' && typeof saveScheduleToFirebase === 'function') {
                    saveScheduleToFirebase(newSchedule);
                }
                
                displaySchedule(newSchedule);
                updateCurrentShiftInfo(currentDate);
                showNotification('2-week shift override cleared! Using automatic detection.', 'success');
            } else {
                showNotification('No override to clear.', 'info');
            }
            modal.classList.remove('show');
        };
    }
    
    modal.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = () => {
            modal.classList.remove('show');
        };
    });
}

// ---------- CONTACT FORM ----------
function initContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;

    // Remove any existing event listeners by cloning the form
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Add event listener to the new form
    newForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const nameVal = document.getElementById("name").value.trim();
        const emailVal = document.getElementById("email").value.trim();
        const messageVal = document.getElementById("message").value.trim();

        if (!nameVal || !emailVal || !messageVal) {
            showNotification("Please fill in all fields", "error");
            return;
        }

        const submitBtn = newForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        
        try {
            // Show loading
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            submitBtn.disabled = true;
            
            // Send email using EmailJS
            await emailjs.send("service_vqszi3y", "template_cm46bal", {
                name: nameVal,                      // {{name}} in template
                email: emailVal,                    // {{email}} in template
                message: messageVal,                // {{message}} in template
                title: "New Contact Form Message"   // {{title}} in template
            });
            
            // Success
            showNotification("Message sent successfully!");
            newForm.reset();
            
        } catch (error) {
            showNotification("Failed to send message. Please try again.", "error");
            
        } finally {
            // Always reset button
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    }); // <-- This was missing
}

document.addEventListener("DOMContentLoaded", initContactForm);

// ---------- SCROLL ANIMATIONS ----------
function initScrollAnimations() {
    const fadeElements = document.querySelectorAll(".fade-in");
    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                }
            });
        },
        { threshold: 0.1 }
    );
    fadeElements.forEach(el => observer.observe(el));
}

// ---------- NOTIFICATIONS ----------
function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === "success" ? "#10b981" : "#ef4444"};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = "slideOut 0.3s ease";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    const style = document.createElement("style");
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    if (!document.getElementById('notificationStyles')) {
        style.id = 'notificationStyles';
        document.head.appendChild(style);
    }
}

// ============================================
// TESTIMONIAL CAROUSEL FUNCTIONALITY
// Continuous infinite loop (smooth)
// ============================================

let testimonialIndex = 0;
let testimonialTrack;
let testimonialCards;
let testimonialCardWidth;
let testimonialInterval;

const TESTIMONIAL_INTERVAL = 3000; // medium-fast

// Initialize testimonial carousel
function initTestimonialCarousel() {
    testimonialTrack = document.getElementById('testimonialTrack');
    testimonialCards = document.querySelectorAll('.testimonial-card');

    if (!testimonialTrack || testimonialCards.length === 0) return;

    testimonialCardWidth = testimonialCards[0].offsetWidth;

    // 🔁 CLONE FIRST CARD
    const firstClone = testimonialCards[0].cloneNode(true);
    firstClone.classList.add('clone');
    testimonialTrack.appendChild(firstClone);

    // Refresh cards
    testimonialCards = document.querySelectorAll('.testimonial-card');

    // ✅ SHOW FIRST CARD IMMEDIATELY
    testimonialTrack.style.transition = 'none';
    testimonialTrack.style.transform = 'translateX(0px)';
    showTestimonial(0);

    startTestimonialAutoSlide();

    // Pause on hover
    const carousel = document.querySelector('.testimonial-carousel');
    if (carousel) {
        carousel.addEventListener('mouseenter', stopTestimonialAutoSlide);
        carousel.addEventListener('mouseleave', startTestimonialAutoSlide);
    }
}

// Show testimonial (infinite)
function showTestimonial(index) {
    if (!testimonialTrack || testimonialCards.length === 0) return;

    testimonialIndex = index;
    const realCount = testimonialCards.length - 1;

    testimonialTrack.style.transition =
        'transform 0.55s cubic-bezier(0.25, 0.6, 0.4, 1)';
    testimonialTrack.style.transform =
        `translateX(-${testimonialIndex * testimonialCardWidth}px)`;

    // Update dots
    const dots = document.querySelectorAll('.testimonial-dots .dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === testimonialIndex % realCount);
    });

    // 🔁 Loop jump (clone → real first)
    if (testimonialIndex === realCount) {
        setTimeout(() => {
            testimonialTrack.style.transition = 'none';
            testimonialTrack.style.transform = 'translateX(0px)';
            testimonialIndex = 0;
        }, 560);
    }
}

// Auto slide
function startTestimonialAutoSlide() {
    stopTestimonialAutoSlide();
    testimonialInterval = setInterval(() => {
        showTestimonial(testimonialIndex + 1);
    }, TESTIMONIAL_INTERVAL);
}

// Stop auto slide
function stopTestimonialAutoSlide() {
    if (testimonialInterval) {
        clearInterval(testimonialInterval);
        testimonialInterval = null;
    }
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
        showTestimonial(testimonialIndex + 1);
    }
    if (e.key === 'ArrowLeft') {
        showTestimonial(testimonialIndex - 1);
    }
});

window.addEventListener('resize', () => {
  testimonialCardWidth = testimonialCards[0].offsetWidth;
  testimonialTrack.style.transition = 'none';
  testimonialTrack.style.transform =
    `translateX(-${testimonialIndex * testimonialCardWidth}px)`;
});

function changeTestimonial(direction) {
    showTestimonial(testimonialIndex + direction);
}

// Disable right-click and drag
function disableImageInteractions() {
    const avatars = document.querySelectorAll(
        '.testimonial-avatar, .avatar-circle, .avatar-circle img'
    );

    avatars.forEach(el => {
        el.addEventListener('contextmenu', e => e.preventDefault());
        el.addEventListener('dragstart', e => e.preventDefault());
        el.addEventListener('selectstart', e => e.preventDefault());
    });
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initTestimonialCarousel();
        disableImageInteractions();
    }, 300);
});

// ============================================
// AUTO-FOCUS CENTER CARD ON SECTION VIEW
// ============================================

function initTestimonialCenterFocus() {
    const testimonialSection = document.querySelector('.testimonial-section');
    if (!testimonialSection) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Get currently visible card (center one)
                const cards = document.querySelectorAll('.testimonial-card:not(.clone)');
                
                if (cards.length > 0) {
                    // Add focus to current visible card
                    const currentCard = cards[testimonialIndex] || cards[0];
                    currentCard.classList.add('center-focus');
                    
                    // Remove focus after 3 seconds
                    setTimeout(() => {
                        currentCard.classList.remove('center-focus');
                    }, 3000);
                }
                
                // Disconnect after first trigger
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.4 // Trigger when 40% of section is visible
    });

    observer.observe(testimonialSection);
}

// Initialize after carousel is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initTestimonialCarousel();
        disableImageInteractions();
        initTestimonialCenterFocus(); 
    }, 300);
});

// Also apply effect when manually changing slides
const originalShowTestimonial = showTestimonial;
showTestimonial = function(index) {
    // Remove focus from all cards
    document.querySelectorAll('.testimonial-card').forEach(card => {
        card.classList.remove('center-focus');
    });
    
    // Call original function
    originalShowTestimonial(index);
    
    // Briefly add focus to current card on manual change
    const cards = document.querySelectorAll('.testimonial-card:not(.clone)');
    const currentCard = cards[testimonialIndex % cards.length];
    if (currentCard) {
        currentCard.classList.add('center-focus');
        setTimeout(() => {
            currentCard.classList.remove('center-focus');
        }, 2000);
    }
};

// ==================
// GUEST USER SYSTEM 
// ===================

// 🔒 GROUP-SPECIFIC PASSWORD SYSTEM
// Note: detectGroupID() is defined later at line 3649, CURRENT_GROUP at line 3680

// Group-specific storage key (will be set after CURRENT_GROUP is defined)
let PASSWORD_STORAGE_KEY;
let userCredentials = null; // Will be initialized after CURRENT_GROUP is defined

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let isGuest = false;

// Save credentials to localStorage (group-specific)
function saveUserCredentials() {
    if (!PASSWORD_STORAGE_KEY || !userCredentials) {
        return;
    }
    
    // Save to localStorage
    localStorage.setItem(PASSWORD_STORAGE_KEY, JSON.stringify(userCredentials));
    
    // Save to Firebase for real-time sync
    if (typeof savePasswordsToFirebase === 'function') {
        savePasswordsToFirebase();
    }
}

// ==========================================
// 🔒 SECURE PASSWORD HASHING SYSTEM
// Uses Web Crypto API (SHA-256) — no libraries needed
// Adaptable for all groups (gc1, gc2, gc3...)
// ==========================================

/**
 * Hash a plain-text password using SHA-256.
 * Returns a hex string (Promise).
 */
async function hashPassword(plainText) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compare a plain-text password against a stored hash.
 * Returns true if they match (Promise<boolean>).
 */
async function verifyPassword(plainText, storedHash) {
    // Support legacy plain-text passwords during transition:
    // if the stored value is not a 64-char hex string it's plain text
    if (!/^[0-9a-f]{64}$/i.test(storedHash)) {
        return plainText === storedHash;
    }
    const hashed = await hashPassword(plainText);
    return hashed === storedHash;
}

/**
 * Migrate a credentials object so all passwords are hashed.
 * Call once when loading credentials for the first time.
 * Returns a Promise that resolves when migration is done.
 */
async function migrateCredentialsToHashed(creds) {
    let changed = false;

    // Admin password
    if (creds.admin && creds.admin.password && !/^[0-9a-f]{64}$/i.test(creds.admin.password)) {
        creds.admin.password = await hashPassword(creds.admin.password);
        changed = true;
    }

    // Guest password
    if (creds.guest && creds.guest.password && !/^[0-9a-f]{64}$/i.test(creds.guest.password)) {
        creds.guest.password = await hashPassword(creds.guest.password);
        changed = true;
    }

    return changed;
}

// Generate unique session ID
function generateSessionId() {
    return 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize user system
function initUserSystem() {
    if (currentUser) {
        if (currentUser.role === 'admin') {
            setAdminMode(true);
            isGuest = false;
        } else if (currentUser.role === 'guest') {
            // Initialize activeSessions if it doesn't exist
            if (!userCredentials.guest.activeSessions) {
                userCredentials.guest.activeSessions = [];
            }
            const sessionValid = userCredentials.guest.activeSessions.includes(currentUser.sessionId);
            if (sessionValid) {
                setGuestMode(true);
                isGuest = true;
            } else {
                currentUser = null;
                localStorage.removeItem('currentUser');
            }
        }
    }
    
    if (isGuest) {
        addGuestFeatures();
    }
}

// Update setGuestMode to ensure visibility
function setGuestMode(enabled) {
    isGuest = enabled;
    isAdmin = false;
    
    if (enabled) {
        // Hide admin elements
        document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
        
        // Force show ALL guest elements
        document.querySelectorAll(".guest-only").forEach(el => {
            el.classList.remove("hidden");
            el.style.display = el.classList.contains('edit-schedule-btn') || 
                               el.classList.contains('edit-task-btn') ? "inline-block" : "block";
            el.style.visibility = "visible";
            el.style.opacity = "1";
        });
        
        // Set body attribute for CSS targeting
        document.body.setAttribute('data-user-role', 'guest');
        
        const adminToggle = document.getElementById("adminToggle");
        if (adminToggle) {
            adminToggle.classList.add("active", "guest-active");
            adminToggle.innerHTML = '<i class="fas fa-user-tie"></i>';
            adminToggle.style.background = '#10b981';
        }
        
        const adminNotice = document.getElementById("adminNotice");
        if (adminNotice) adminNotice.classList.add("hidden");
        
        // Add guest features
        addGuestFeatures();

    } else {
        // Disable guest mode
        document.querySelectorAll(".guest-only").forEach(el => {
            el.classList.add("hidden");
            el.style.display = "";
            el.style.visibility = "";
            el.style.opacity = "";
        });
        
        document.body.removeAttribute('data-user-role');
        
        const adminToggle = document.getElementById("adminToggle");
        if (adminToggle) {
            adminToggle.classList.remove("active", "guest-active");
            adminToggle.innerHTML = '<i class="fas fa-user-shield"></i>';
            adminToggle.style.background = '';
        }
    }
}

// Add guest features
function addGuestFeatures() {
    setTimeout(() => {
    // Add monthly leave button for guests
    
        addGuestMonthlyLeaveButton();

    // Refresh display
        const dateInput = document.getElementById("scheduleDate");
        if (dateInput && dateInput.value) {
            const selected = new Date(dateInput.value);
            const schedule = scheduleHistory[selected.toISOString().split("T")[0]];
            if (schedule) {
                displayScheduleForGuest(schedule);
            }
        }
        
                updateAvailabilityStatus(); // Use main function

    }, 100);
}

// Display schedule for guest
function displayScheduleForGuest(schedule) {
    const tbody = document.getElementById("scheduleTableBody");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    const allPlatforms = [...platforms.main, ...platforms.common, ...platforms.grouped];
    
    allPlatforms.forEach(plat => {
        if (!schedule.platforms[plat]) return;
        const tr = document.createElement("tr");
        const inCharge = schedule.platforms[plat].inCharge;
        const responsibility = schedule.platforms[plat].responsibility;
        
        tr.innerHTML = `
            <td><strong>${plat}</strong></td>
            <td>${inCharge}</td>
            <td>${responsibility}</td>
            <td><button class="edit-schedule-btn guest-only" data-platform="${plat}"><i class="fas fa-edit"></i> Edit</button></td>
        `;
        tbody.appendChild(tr);
    });
    
    // Attach click events AFTER inserting into DOM
    tbody.querySelectorAll('.edit-schedule-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const platform = this.getAttribute('data-platform');
            openEditScheduleModal(schedule, platform);
        });
    });
    
    displayAdditionalTasksForGuest(schedule);
    
    if (typeof loadAndApplyPlatformOrder === 'function') {
        loadAndApplyPlatformOrder();
    }
}

// Display tasks for guest
function displayAdditionalTasksForGuest(schedule) {
    const tasksGrid = document.getElementById("additionalTasksGrid");
    if (!tasksGrid) return;
    
    tasksGrid.innerHTML = "";
    
    // ✅ ENSURE ALL 6 TASKS ARE PRESENT
    const requiredTasks = [
        "Email Handle",
        "Follow Up Remainder",
        "SIEM Device Status",
        "HO PPT Update",
        "Handover Presentation",
        "Handover Summary"
    ];
    
    // Check for missing tasks and add them with fallback
    requiredTasks.forEach(taskName => {
        if (!schedule.tasks[taskName]) {
            schedule.tasks[taskName] = "All SA's";
        }
    });
    
    // Display all tasks in the required order
    requiredTasks.forEach(taskName => {
        const assigned = schedule.tasks[taskName];
        
        const card = document.createElement("div");
        card.className = "task-card";
        card.innerHTML = `
            <h4><i class="fas fa-tasks"></i> ${taskName} <button class="edit-task-btn guest-only" data-task="${taskName}"><i class="fas fa-edit"></i></button></h4>
            <p>${assigned}</p>
        `;
        tasksGrid.appendChild(card);
    });
    
    // Attach click events AFTER inserting into DOM
    tasksGrid.querySelectorAll('.edit-task-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const taskName = this.getAttribute('data-task');
            openEditTaskModal(schedule, taskName);
        });
    });
    
    if (typeof loadAndApplyTaskOrder === 'function') {
        loadAndApplyTaskOrder();
    }
}

// Enable guest availability management
function enableGuestAvailabilityManagement() {
    const nowSGT = getNowSGT();
    const saAvailList = document.getElementById("saAvailability");
    const appAvailList = document.getElementById("appAvailability");
    
    if (saAvailList) {
        saAvailList.innerHTML = "";
        teamData.SAs.forEach(sa => {
            const available = isMemberAvailableOnDate(sa, nowSGT, "SA");
            const li = document.createElement("li");
            li.className = "availability-item";
            li.innerHTML = `
                <div class="member-info">
                    <span class="status-icon ${available ? 'status-available' : 'status-unavailable'}">
                        <i class="fas fa-${available ? 'check-circle' : 'times-circle'}"></i>
                    </span>
                    <span class="member-name-text">${sa}</span>
                </div>
                <div class="member-actions-inline guest-only">
                    <button class="btn-icon-inline" onclick="toggleMemberAvailabilityGuest('${sa}', 'SA')" title="Toggle Availability">
                        <i class="fas fa-eye${available ? '' : '-slash'}" style="color: ${available ? '#10b981' : '#ef4444'}"></i>
                    </button>
                </div>
            `;
            saAvailList.appendChild(li);
        });
        
        const maxCount = Math.max(teamData.SAs.length, teamData.apprentices.length);
        const saEmptyCount = maxCount - teamData.SAs.length;
        for (let i = 0; i < saEmptyCount; i++) {
            const li = document.createElement('li');
            li.className = 'availability-item empty-slot';
            li.innerHTML = `
                <div class="member-info">
                    <i class="fas fa-user-slash" style="margin-right: 8px; opacity: 0.5; color: var(--text-muted);"></i>
                    <span style="font-style: italic; opacity: 0.6; color: var(--text-muted);">Empty Slot</span>
                </div>
            `;
            saAvailList.appendChild(li);
        }
    }
    
    if (appAvailList) {
        appAvailList.innerHTML = "";
        teamData.apprentices.forEach(app => {
            const available = isMemberAvailableOnDate(app, nowSGT, "Apprentice");
            const li = document.createElement("li");
            li.className = "availability-item";
            li.innerHTML = `
                <div class="member-info">
                    <span class="status-icon ${available ? 'status-available' : 'status-unavailable'}">
                        <i class="fas fa-${available ? 'check-circle' : 'times-circle'}"></i>
                    </span>
                    <span class="member-name-text">${app}</span>
                </div>
                <div class="member-actions-inline guest-only">
                    <button class="btn-icon-inline" onclick="toggleMemberAvailabilityGuest('${app}', 'Apprentice')" title="Toggle Availability">
                        <i class="fas fa-eye${available ? '' : '-slash'}" style="color: ${available ? '#10b981' : '#ef4444'}"></i>
                    </button>
                </div>
            `;
            appAvailList.appendChild(li);
        });
        
        const maxCount = Math.max(teamData.SAs.length, teamData.apprentices.length);
        const appEmptyCount = maxCount - teamData.apprentices.length;
        for (let i = 0; i < appEmptyCount; i++) {
            const li = document.createElement('li');
            li.className = 'availability-item empty-slot';
            li.innerHTML = `
                <div class="member-info">
                    <i class="fas fa-user-slash" style="margin-right: 8px; opacity: 0.5; color: var(--text-muted);"></i>
                    <span style="font-style: italic; opacity: 0.6; color: var(--text-muted);">Empty Slot</span>
                </div>
            `;
            appAvailList.appendChild(li);
        }
    }
}

// Guest toggle availability
function toggleMemberAvailabilityGuest(name, role) {
    if (!isGuest) {
        showNotification("User access required", "error");
        return;
    }
    
    const key = `${name}_${role}`;
    if (availabilityOverrides[key]) {
        delete availabilityOverrides[key];
        showNotification(`${name} is now available`, "success");
    } else {
        availabilityOverrides[key] = true;
        showNotification(`${name} marked as unavailable`, "success");
    }
    
    localStorage.setItem("availabilityOverrides", JSON.stringify(availabilityOverrides));
    if (typeof database !== 'undefined') {
        saveAvailabilityToFirebase();
    }
    enableGuestAvailabilityManagement();
}

// Add monthly leave button for guests (same as admin)
function addGuestMonthlyLeaveButton() {
    const availabilitySection = document.querySelector('.availability-status');
    if (!availabilitySection) return;
    
    const oldBtn = document.getElementById('guestMonthlyLeaveBtn');
    if (oldBtn) oldBtn.remove();
    
    const container = availabilitySection.querySelector('.container');
    if (container) {
        const guestLeaveBtn = document.createElement('button');
        guestLeaveBtn.id = 'guestMonthlyLeaveBtn';
        guestLeaveBtn.className = 'btn btn-primary guest-only';
        guestLeaveBtn.style.cssText = `
            margin-top: 20px; 
            width: 100%; 
            max-width: 300px; 
            display: block !important; 
            margin-left: auto; 
            margin-right: auto;
            visibility: visible !important;
            opacity: 1 !important;
        `;
        guestLeaveBtn.innerHTML = '<i class="fas fa-calendar-times"></i> Manage Monthly Leave';
        guestLeaveBtn.onclick  = () => {
            // ✅ Call the SAME function as admin (from monthlyLeaveManagement.js)
            if (typeof openMonthlyLeaveManagement === 'function') {
                openMonthlyLeaveManagement();
            } else {
                showNotification('Monthly leave feature not available', 'error');
            }
        };
        // Find the availability grid and insert button after it
        const availGrid = container.querySelector('.availability-grid');
        if (availGrid) {
            availGrid.parentNode.insertBefore(guestLeaveBtn, availGrid.nextSibling);
        } else {
            container.appendChild(guestLeaveBtn);
        }
    }
}

// Open monthly leave for guests
function openMonthlyLeaveManagementGuest() {
    if (!isAdmin && !isGuest) {
        showNotification('access required', 'error');
        return;
    }
    
    if (typeof openMonthlyLeaveManagement === 'function') {
        openMonthlyLeaveManagement();
    } else {
        showNotification('Monthly leave feature not available', 'error');
    }
}

// Logout user
function logoutUser() {
    if (currentUser) {
        if (currentUser.role === 'guest') {
            const sessionId = currentUser.sessionId;
            // Initialize activeSessions if it doesn't exist
            if (!userCredentials.guest.activeSessions) {
                userCredentials.guest.activeSessions = [];
            }
            const index = userCredentials.guest.activeSessions.indexOf(sessionId);
            if (index > -1) {
                userCredentials.guest.activeSessions.splice(index, 1);
                saveUserCredentials();
            }
        }
        
        currentUser = null;
        localStorage.removeItem('currentUser');
        
        if (isGuest) {
            setGuestMode(false);
            isGuest = false;
        } else {
            setAdminMode(false);
        }
        
        showNotification("Logged out successfully", "success");
        setTimeout(() => location.reload(), 500);
    }
}

// Open reset password modal (from login screen)
function openResetPasswordModal() {
    const loginModal = document.getElementById('adminLoginModal');
    if (loginModal) loginModal.classList.remove('show');
    
    let modal = document.getElementById('resetPasswordModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'resetPasswordModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="modal-close" onclick="closeResetPasswordModal()">&times;</span>
                <h3><i class="fas fa-key"></i> Reset Password</h3>
                <p style="color: var(--text-muted); margin-bottom: 20px;">Choose which password to reset:</p>
                <form id="resetPasswordForm">
                    <div class="form-group">
                        <label>
                            <i class="fas fa-user-shield"></i> Account Type
                        </label>
                        <select id="resetAccountType" required style="width: 100%; padding: 0.75rem; border: 2px solid var(--border); border-radius: 8px; font-size: 1rem; background: var(--card-bg); color: var(--text-primary);">
                            <option value="">Select account type...</option>
                            <option value="admin">Admin</option>
                            <option value="guest">User</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="resetOldPassword">
                            <i class="fas fa-lock"></i> Current Password
                        </label>
                    <div class="password-input-container">
                        <input type="password" id="resetOldPassword" placeholder="Enter current password" required>
                        <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('resetOldPassword')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="resetNewPassword">
                            <i class="fas fa-lock"></i> New Password
                        </label>
                    <div class="password-input-container">
                            <input type="password" id="resetNewPassword" placeholder="Enter new password (min 8 mixing characters)" required>
                            <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('resetNewPassword')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="resetConfirmPassword">
                            <i class="fas fa-lock"></i> Confirm New Password
                        </label>
                        <div class="password-input-container">
                            <input type="password" id="resetConfirmPassword" placeholder="Confirm new password" required>
                            <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('resetConfirmPassword')">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeResetPasswordModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i> Reset Password
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        const form = document.getElementById('resetPasswordForm');
        form.addEventListener('submit', handleResetPassword);
    }
    
    modal.classList.add('show');
}

// Close reset password modal
function closeResetPasswordModal() {
    const modal = document.getElementById('resetPasswordModal');
    if (modal) {
        modal.classList.remove('show');
        const form = document.getElementById('resetPasswordForm');
        if (form) form.reset();
    }
    
    const loginModal = document.getElementById('adminLoginModal');
    if (loginModal) loginModal.classList.add('show');
}

// Handle reset password
async function handleResetPassword(e) {
    e.preventDefault();
    
    const accountType = document.getElementById('resetAccountType').value;
    const oldPassword = document.getElementById('resetOldPassword').value.trim();
    const newPassword = document.getElementById('resetNewPassword').value.trim();
    const confirmPassword = document.getElementById('resetConfirmPassword').value.trim();
    
    if (!accountType) {
        showNotification("Please select account type", "error");
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification("New passwords don't match", "error");
        return;
    }
    
    if (newPassword.length < 8) {
        showNotification("Password must be at least 8 mixing characters", "error");
        return;
    }
    
    if (accountType === 'admin') {
        const valid = await verifyPassword(oldPassword, userCredentials.admin.password);
        if (!valid) {
            showNotification("Current admin password is incorrect", "error");
            return;
        }
        
        userCredentials.admin.password = await hashPassword(newPassword);
        saveUserCredentials();
        showNotification("✅ Admin password reset successfully!", "success");
        closeResetPasswordModal();
        
    } else if (accountType === 'guest') {
        const valid = await verifyPassword(oldPassword, userCredentials.guest.password);
        if (!valid) {
            showNotification("Current User password is incorrect", "error");
            return;
        }
        
        userCredentials.guest.password = await hashPassword(newPassword);
        saveUserCredentials();
        showNotification("✅ User password reset successfully!", "success");
        closeResetPasswordModal();
    }
}
// ✅ Toggle password visibility
    function togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const button = input.nextElementSibling;
        const icon = button.querySelector('i');
        
    if (input.type === 'password') {
           input.type = 'text';
           icon.classList.remove('fa-eye');
           icon.classList.add('fa-eye-slash');
    } else {
           input.type = 'password';
           icon.classList.remove('fa-eye-slash');
           icon.classList.add('fa-eye');
    }
}

// ========================================
// POC MANAGEMENT SYSTEM - ADMIN ONLY
// ========================================

// ========================================
// AUTO-DETECT GROUP FROM FIREBASE CONFIG
// ========================================
function detectGroupID() {
    // Try to detect from Firebase database URL
    if (typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL) {
        const url = firebaseConfig.databaseURL;
        
        // Extract group ID from URL (gc1, gc2, gc3, etc.)
        const match = url.match(/workschedulemanager-gc(\d+)/i);
        if (match) {
            return 'gc' + match[1];
        }
        
        // Fallback: check for other patterns
        if (url.includes('gc1')) return 'gc1';
        if (url.includes('gc2')) return 'gc2';
        if (url.includes('gc3')) return 'gc3';
    }
    
    // Fallback: try to detect from page URL or title
    const pageTitle = document.title || '';
    const pageURL = window.location.pathname || '';
    
    if (pageTitle.includes('G1') || pageURL.includes('group1') || pageURL.includes('gc1')) return 'gc1';
    if (pageTitle.includes('G2') || pageURL.includes('group2') || pageURL.includes('gc2')) return 'gc2';
    if (pageTitle.includes('G3') || pageURL.includes('group3') || pageURL.includes('gc3')) return 'gc3';
    
    // Default to gc1 if cannot detect
    return 'gc1';
}

// Detect current group
const CURRENT_GROUP = detectGroupID();

// ✅ Initialize password system now that CURRENT_GROUP is defined
PASSWORD_STORAGE_KEY = `userCredentials_${CURRENT_GROUP}`;
userCredentials = JSON.parse(localStorage.getItem(PASSWORD_STORAGE_KEY)) || {
    admin: {
        password: 'admin123',
        role: 'admin'
    },
    guest: {
        password: 'guest123',
        maxUsers: 2,
        activeSessions: []
    }
};

// 🔒 Auto-migrate plain-text passwords to SHA-256 hashes on first load
(async () => {
    const migrated = await migrateCredentialsToHashed(userCredentials);
    if (migrated) {
        localStorage.setItem(PASSWORD_STORAGE_KEY, JSON.stringify(userCredentials));
        if (typeof savePasswordsToFirebase === 'function') savePasswordsToFirebase();
    }
})();

// ========================================
// 🔒 FIREBASE PASSWORD SYNC FUNCTIONS
// ========================================

const PASSWORD_FIREBASE_KEY = `passwords_${CURRENT_GROUP}`;

// Load passwords from Firebase
function loadPasswordsFromFirebase(callback) {
    if (typeof window.database === 'undefined' || typeof database === 'undefined') {
        if (callback) callback(null);
        return;
    }
    
    
    try {
        database.ref(PASSWORD_FIREBASE_KEY).once('value')
        .then((snapshot) => {
            const firebasePasswords = snapshot.val();
            if (firebasePasswords) {
                // Migrate any plain-text passwords from Firebase
                migrateCredentialsToHashed(firebasePasswords).then(migrated => {
                    userCredentials = firebasePasswords;
                    localStorage.setItem(PASSWORD_STORAGE_KEY, JSON.stringify(userCredentials));
                    if (migrated) {
                        if (typeof savePasswordsToFirebase === 'function') savePasswordsToFirebase();
                    }
                    if (callback) callback(firebasePasswords);
                });
            } else {
                // Save defaults to Firebase
                savePasswordsToFirebase();
                if (callback) callback(null);
            }
        })
        .catch((error) => {
            if (callback) callback(null);
        });
    } catch (error) {
        if (callback) callback(null);
    }
}

// Save passwords to Firebase
function savePasswordsToFirebase() {
    if (typeof window.database === 'undefined' || typeof database === 'undefined' || !userCredentials) {
        return;
    }
    
    try {
        database.ref(PASSWORD_FIREBASE_KEY).set(userCredentials)
            .then(() => {
            })
            .catch((error) => {
            });
    } catch (error) {
    }
}

// Setup real-time password listener
function setupPasswordSyncListener() {
    if (typeof window.database === 'undefined' || typeof database === 'undefined') {
        return;
    }
    
    
    try {
        database.ref(PASSWORD_FIREBASE_KEY).on('value', (snapshot) => {
            const firebasePasswords = snapshot.val();
            
            if (firebasePasswords) {
                
                // Migrate and update local credentials
                migrateCredentialsToHashed(firebasePasswords).then(migrated => {
                    userCredentials = firebasePasswords;
                    localStorage.setItem(PASSWORD_STORAGE_KEY, JSON.stringify(userCredentials));
                    if (migrated && typeof savePasswordsToFirebase === 'function') {
                        savePasswordsToFirebase();
                    }
                });
                
                // Show notification to non-admin users
                if (typeof isAdmin !== 'undefined' && !isAdmin) {
                    showNotification('🔐 Password settings updated by admin', 'info');
                }
            }
        }, (error) => {
        });
    } catch (error) {
    }
}

// Initialize password system with Firebase sync
function initializePasswordSystem() {
    
    // Try to load from Firebase first
    loadPasswordsFromFirebase((firebasePasswords) => {
        if (firebasePasswords) {
        } else {
        }
        
        // Setup real-time sync listener
        setupPasswordSyncListener();
    });
}

// Make savePasswordsToFirebase globally available
window.savePasswordsToFirebase = savePasswordsToFirebase;

// Default POC names
const DEFAULT_POC_NAMES = {
    team1: "Gayathiri",
    team2: "Ajay"
};

// Storage key - NOW GROUP-SPECIFIC
const POC_STORAGE_KEY = `teamPOCNames_${CURRENT_GROUP}`;
const POC_FIREBASE_KEY = `pocNames_${CURRENT_GROUP}`;

// Global POC data
let pocNames = {
    team1: DEFAULT_POC_NAMES.team1,
    team2: DEFAULT_POC_NAMES.team2
};

// ========================================
// INITIALIZE POC SYSTEM
// ========================================
function initializePOCSystem() {
    
    // Load POC names from storage
    loadPOCNamesFromStorage();
    
    // Display POC names
    updatePOCDisplay();
    
    // Add edit buttons for admin only
    if (typeof isAdmin !== 'undefined' && isAdmin) {
        addPOCEditButtons();
    } else {
    }
}

// ========================================
// LOAD POC NAMES
// ========================================
function loadPOCNamesFromStorage() {
    // Try Firebase first
    if (typeof window.database !== 'undefined' && typeof database !== 'undefined') {
        try {
            database.ref(POC_FIREBASE_KEY).once('value')
                .then(snapshot => {
                    const data = snapshot.val();
                    if (data) {
                        pocNames = data;
                        updatePOCDisplay();
                    } else {
                        // Try localStorage
                        loadPOCFromLocalStorage();
                    }
                })
                .catch(err => {
                    loadPOCFromLocalStorage();
                });
        } catch (error) {
            loadPOCFromLocalStorage();
        }
    } else {
        // Use localStorage only
        loadPOCFromLocalStorage();
    }
}

function loadPOCFromLocalStorage() {
    const stored = localStorage.getItem(POC_STORAGE_KEY);
    if (stored) {
        try {
            pocNames = JSON.parse(stored);
        } catch (e) {
            pocNames = { ...DEFAULT_POC_NAMES };
        }
    } else {
        pocNames = { ...DEFAULT_POC_NAMES };
    }
    updatePOCDisplay();
}

// ========================================
// SAVE POC NAMES
// ========================================
function savePOCNamesToStorage() {
    // Save to localStorage
    localStorage.setItem(POC_STORAGE_KEY, JSON.stringify(pocNames));
    
    // Save to Firebase if available
    if (typeof window.database !== 'undefined' && typeof database !== 'undefined') {
        try {
            database.ref(POC_FIREBASE_KEY).set(pocNames)
                .then(() => {
                })
                .catch(err => {
                });
        } catch (error) {
        }
    }
}

// ========================================
// UPDATE POC DISPLAY
// ========================================
function updatePOCDisplay() {
    const pocElements = document.querySelectorAll('.poc-name');
    
    if (pocElements.length >= 2) {
        // Update Team1 POC
        pocElements[0].textContent = pocNames.team1;
        pocElements[0].setAttribute('data-team', 'team1');
        
        // Update Team2 POC
        pocElements[1].textContent = pocNames.team2;
        pocElements[1].setAttribute('data-team', 'team2');
        
    } else {
    }
}

// ========================================
// ADD EDIT BUTTONS (ADMIN ONLY)
// ========================================
function addPOCEditButtons() {
    const pocElements = document.querySelectorAll('.poc-name');
    
    pocElements.forEach(pocElement => {
        // Skip if button already exists
        if (pocElement.nextElementSibling && pocElement.nextElementSibling.classList.contains('poc-edit-btn')) {
            return;
        }
        
        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'poc-edit-btn admin-only';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Edit POC Name (Admin Only)';
        
        // Inline styles to avoid CSS conflicts
        editBtn.style.cssText = `
            margin-left: 8px;
            padding: 4px 8px;
            background: var(--primary-color, #3b82f6);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
            opacity: 0.8;
            vertical-align: middle;
        `;
        
        // Hover effects
        editBtn.addEventListener('mouseenter', () => {
            editBtn.style.opacity = '1';
            editBtn.style.transform = 'scale(1.1)';
        });
        
        editBtn.addEventListener('mouseleave', () => {
            editBtn.style.opacity = '0.8';
            editBtn.style.transform = 'scale(1)';
        });
        
        // Click handler
        const teamKey = pocElement.getAttribute('data-team');
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openPOCEditModal(teamKey);
        });
        
        // Insert button after POC name
        pocElement.parentNode.insertBefore(editBtn, pocElement.nextSibling);
    });
}

// ========================================
// OPEN EDIT MODAL
// ========================================
function openPOCEditModal(teamKey) {
    const teamLabel = teamKey === 'team1' ? 'Team 1' : 'Team 2';
    const currentName = pocNames[teamKey];
    
    // Remove existing modal if any
    const existingModal = document.getElementById('pocEditModalOverlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'pocEditModalOverlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 100000;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        max-width: 450px;
        width: 90%;
        animation: slideIn 0.3s ease;
    `;
    
    modalContent.innerHTML = `
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        </style>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: #333; font-size: 20px; font-weight: 600;">
                <i class="fas fa-user-edit" style="color: var(--primary-color, #3b82f6); margin-right: 8px;"></i>
                Edit ${teamLabel} POC
            </h3>
            <button id="pocModalClose" style="
                background: none;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: #999;
                transition: color 0.2s;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">&times;</button>
        </div>
        
        <div style="margin-bottom: 25px;">
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500; font-size: 14px;">
                POC Name:
            </label>
            <input 
                type="text" 
                id="pocNameInput" 
                value="${currentName}"
                placeholder="Enter POC name"
                style="
                    width: 100%;
                    padding: 12px 15px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 16px;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                    font-family: inherit;
                "
            />
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="pocCancelBtn" style="
                padding: 10px 20px;
                background: #e5e7eb;
                color: #333;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
                transition: background 0.2s;
            ">Cancel</button>
            <button id="pocSaveBtn" style="
                padding: 10px 20px;
                background: var(--primary-color, #3b82f6);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
                transition: background 0.2s;
            "><i class="fas fa-save"></i> Save</button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Focus on input
    setTimeout(() => {
        const input = document.getElementById('pocNameInput');
        if (input) {
            input.focus();
            input.select();
            
            // Focus styling
            input.addEventListener('focus', () => {
                input.style.borderColor = 'var(--primary-color, #3b82f6)';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#e5e7eb';
            });
            
            // Enter key to save
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    savePOCEdit(teamKey);
                }
            });
        }
    }, 100);
    
    // Button hover effects
    const closeBtn = document.getElementById('pocModalClose');
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#333');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#999');
    
    const cancelBtn = document.getElementById('pocCancelBtn');
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#d1d5db');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = '#e5e7eb');
    
    const saveBtn = document.getElementById('pocSaveBtn');
    saveBtn.addEventListener('mouseenter', () => saveBtn.style.background = '#2563eb');
    saveBtn.addEventListener('mouseleave', () => saveBtn.style.background = 'var(--primary-color, #3b82f6)');
    
    // Event listeners
    closeBtn.addEventListener('click', closePOCEditModal);
    cancelBtn.addEventListener('click', closePOCEditModal);
    saveBtn.addEventListener('click', () => savePOCEdit(teamKey));
    
    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closePOCEditModal();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            closePOCEditModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}

// ========================================
// CLOSE EDIT MODAL
// ========================================
function closePOCEditModal() {
    const modal = document.getElementById('pocEditModalOverlay');
    if (modal) {
        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    }
}

// ========================================
// SAVE POC EDIT
// ========================================
function savePOCEdit(teamKey) {
    const input = document.getElementById('pocNameInput');
    const newName = input.value.trim();
    
    if (!newName) {
        // Show error - highlight input
        input.style.borderColor = '#ef4444';
        input.style.animation = 'shake 0.3s ease';
        
        // Use existing notification system if available
        if (typeof showNotification === 'function') {
            showNotification('POC name cannot be empty', 'error');
        } else {
            alert('POC name cannot be empty');
        }
        
        setTimeout(() => {
            input.style.borderColor = '#e5e7eb';
        }, 2000);
        
        input.focus();
        return;
    }
    
    // Update POC name
    pocNames[teamKey] = newName;
    
    // Save to storage
    savePOCNamesToStorage();
    
    // Update display
    updatePOCDisplay();
    
    // Close modal
    closePOCEditModal();
    
    // Show success notification
    const teamLabel = teamKey === 'team1' ? 'Team 1' : 'Team 2';
    if (typeof showNotification === 'function') {
        showNotification(`${teamLabel} POC updated to: ${newName}`, 'success');
    }
    
}

// ========================================
// RESET POC NAMES (UTILITY)
// ========================================
function resetPOCNamesToDefault() {
    if (typeof isAdmin === 'undefined' || !isAdmin) {
        return;
    }
    
    if (!confirm('Reset POC names to default values?\n\nTeam1: Gayathiri\nTeam2: Ajay')) {
        return;
    }
    
    pocNames = { ...DEFAULT_POC_NAMES };
    savePOCNamesToStorage();
    updatePOCDisplay();
    
    if (typeof showNotification === 'function') {
        showNotification('POC names reset to default', 'success');
    }
    
}

// ========================================
// EXPORT TO WINDOW
// ========================================
window.initializePOCSystem = initializePOCSystem;
window.openPOCEditModal = openPOCEditModal;
window.closePOCEditModal = closePOCEditModal;
window.savePOCEdit = savePOCEdit;
window.resetPOCNamesToDefault = resetPOCNamesToDefault;
window.pocNames = pocNames;

// ========================================
// AUTO-INITIALIZE
// ========================================
// Wait for DOM and other scripts to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Delay initialization to ensure other scripts are loaded
        setTimeout(initializePOCSystem, 1000);
    });
} else {
    setTimeout(initializePOCSystem, 1000);
}

// ==========================================
// 🔒 INITIALIZE PASSWORD SYSTEM WITH FIREBASE SYNC
// ==========================================

// Wait for Firebase to be ready before initializing password system
function tryInitializePasswordSystem() {
    if (typeof window.database !== 'undefined') {
        if (typeof initializePasswordSystem === 'function') {
            initializePasswordSystem();
        }
    } else {
        setTimeout(tryInitializePasswordSystem, 500);
    }
}

// Start password system initialization
setTimeout(tryInitializePasswordSystem, 1000);

// ==========================================
// FIREBASE LOADING TIMEOUT NOTIFICATION
// ==========================================

(function() {
    'use strict';
    
    let loadingCheckInterval = null;
    let loadingStartTime = null;
    let notificationShown = false;
    const LOADING_TIMEOUT = 10000; // 10 seconds
    const CHECK_INTERVAL = 1000; // Check every 1 second
    
    // Check if skeleton loading is visible
    function isSkeletonLoading() {
        const skeletonElements = document.querySelectorAll('.skeleton, .skeleton-loader, [class*="skeleton"]');
        for (let element of skeletonElements) {
            const style = window.getComputedStyle(element);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                return true;
            }
        }
        return false;
    }
    
    // Check if main content is visible
    function isMainContentVisible() {
        const mainContent = document.querySelector('#scheduleContainer, .schedule-container, main, [role="main"]');
        if (!mainContent) return false;
        const style = window.getComputedStyle(mainContent);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }
    
    // Create and show on-screen notification
    function createOnScreenNotification() {
        // Find existing notifications to stack properly
        const existingNotifications = document.querySelectorAll('[id^="firebase-loading-notification"]');
        let topOffset = 20; // Default top position
        
        // Calculate stack position (don't remove existing, stack below it)
        existingNotifications.forEach(notif => {
            if (notif.style.display !== 'none') {
                const rect = notif.getBoundingClientRect();
                const currentTop = parseInt(notif.style.top) || 20;
                topOffset = Math.max(topOffset, currentTop + rect.height + 15); // 15px gap between notifications
            }
        });
        
        // Create unique ID with timestamp
        const uniqueId = 'firebase-loading-notification-' + Date.now();
        const notification = document.createElement('div');
        notification.id = uniqueId;
        notification.className = 'firebase-notification';
        const isMobile = window.innerWidth <= 768;
        
        notification.style.cssText = `
            position: fixed;
            top: ${isMobile ? topOffset + 'px' : topOffset + 'px'};
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
            color: white;
            padding: ${isMobile ? '16px 20px' : '20px 28px'};
            border-radius: 12px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1);
            z-index: 999999;
            max-width: ${isMobile ? '95%' : '90%'};
            width: auto;
            min-width: ${isMobile ? '280px' : '300px'};
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: ${isMobile ? '14px' : '15px'};
            line-height: 1.6;
            animation: slideDownBounce 0.5s ease-out;
            backdrop-filter: blur(10px);
            transition: top 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: ${isMobile ? '12px' : '15px'}; flex-wrap: wrap;">
                <div style="font-size: ${isMobile ? '28px' : '32px'}; animation: rotate 2s linear infinite;">⏳</div>
                <div style="text-align: left;">
                    <div style="font-weight: 700; font-size: ${isMobile ? '15px' : '16px'}; margin-bottom: 4px;">Database Loading</div>
                    <div style="font-weight: 400; font-size: ${isMobile ? '13px' : '14px'}; opacity: 0.95;">
                        It will take some time. Please refresh the page.
                    </div>
                </div>
            </div>
        `;
        
        // Add animations (only once)
        if (!document.getElementById('firebase-loading-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'firebase-loading-notification-styles';
            style.textContent = `
                @keyframes slideDownBounce {
                    0% {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-30px) scale(0.9);
                    }
                    60% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(5px) scale(1.02);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                }
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes slideUpFade {
                    from {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-30px) scale(0.9);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds with repositioning
        setTimeout(() => {
            notification.style.animation = 'slideUpFade 0.4s ease-out forwards';
            setTimeout(() => {
                notification.remove();
                // Reposition remaining notifications
                repositionNotifications();
            }, 400);
        }, 10000);
    }
    
    // Reposition all notifications when one is removed
    function repositionNotifications() {
        const notifications = document.querySelectorAll('.firebase-notification');
        let currentTop = 20;
        
        notifications.forEach((notif) => {
            if (notif.style.display !== 'none') {
                notif.style.top = currentTop + 'px';
                const rect = notif.getBoundingClientRect();
                currentTop += rect.height + 15; // 15px gap
            }
        });
    }
    
    // Show loading timeout notification
    function showLoadingTimeoutNotification() {
        if (notificationShown) return;
        createOnScreenNotification();
        notificationShown = true;
    }
    
    // Monitor loading state
    function monitorLoadingState() {
        const skeletonVisible = isSkeletonLoading();
        const mainContentVisible = isMainContentVisible();
        const currentTime = Date.now();
        
        if (skeletonVisible && !mainContentVisible) {
            if (!loadingStartTime) {
                loadingStartTime = currentTime;
            }
            
            const elapsedTime = currentTime - loadingStartTime;
            
            if (elapsedTime >= LOADING_TIMEOUT && !notificationShown) {
                showLoadingTimeoutNotification();
            }
        } else {
            if (loadingStartTime && mainContentVisible) {
                stopMonitoring();
            }
        }
    }
    
    // Start monitoring
    function startMonitoring() {
        if (loadingCheckInterval) return;
        loadingStartTime = null;
        notificationShown = false;
        monitorLoadingState();
        loadingCheckInterval = setInterval(monitorLoadingState, CHECK_INTERVAL);
    }
    
    // Stop monitoring
    function stopMonitoring() {
        if (loadingCheckInterval) {
            clearInterval(loadingCheckInterval);
            loadingCheckInterval = null;
            loadingStartTime = null;
        }
    }
    
    // Initialize
    function initialize() {
        setTimeout(startMonitoring, 500);
    }
    
    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    
})();

// =============================
// FIREBASE LOADING NOTIFICATION 
// =============================

(function() {
    'use strict';
    
    let loadingCheckInterval = null;
    let loadingStartTime = null;
    let notificationShown = false;
    const LOADING_TIMEOUT = 10000; // 10 seconds
    const CHECK_INTERVAL = 1000; // Check every 1 second
    
    // Check if skeleton loading is visible
    function isSkeletonLoading() {
        const skeletonElements = document.querySelectorAll('.skeleton, .skeleton-loader, [class*="skeleton"]');
        for (let element of skeletonElements) {
            const style = window.getComputedStyle(element);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                return true;
            }
        }
        return false;
    }
    
    // Check if main content is visible
    function isMainContentVisible() {
        const mainContent = document.querySelector('#scheduleContainer, .schedule-container, main, [role="main"]');
        if (!mainContent) return false;
        const style = window.getComputedStyle(mainContent);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }
    
    // Create notification
    function createOnScreenNotification() {
        // Find existing notifications to stack properly
        const existingNotifications = document.querySelectorAll('[id^="firebase-loading-notification"]');
        let topOffset = 20;
        
        // Calculate stack position
        existingNotifications.forEach(notif => {
            if (notif.style.display !== 'none') {
                const rect = notif.getBoundingClientRect();
                const currentTop = parseInt(notif.style.top) || 20;
                topOffset = Math.max(topOffset, currentTop + rect.height + 15);
            }
        });
        
        const uniqueId = 'firebase-loading-notification-' + Date.now();
        const notification = document.createElement('div');
        notification.id = uniqueId;
        notification.className = 'firebase-notification';
        const isMobile = window.innerWidth <= 768;
        
        notification.style.cssText = `
            position: fixed;
            top: ${topOffset}px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
            color: white;
            padding: ${isMobile ? '16px 20px' : '20px 28px'};
            border-radius: 12px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1);
            z-index: 999999;
            max-width: ${isMobile ? '95%' : '90%'};
            width: auto;
            min-width: ${isMobile ? '280px' : '300px'};
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: ${isMobile ? '14px' : '15px'};
            line-height: 1.6;
            animation: slideDownBounce 0.5s ease-out;
            backdrop-filter: blur(10px);
            transition: top 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: ${isMobile ? '12px' : '15px'}; flex-wrap: wrap;">
                <div style="font-size: ${isMobile ? '28px' : '32px'}; animation: rotate 2s linear infinite;">⏳</div>
                <div style="text-align: left;">
                    <div style="font-weight: 700; font-size: ${isMobile ? '15px' : '16px'}; margin-bottom: 4px;">Database Loading</div>
                    <div style="font-weight: 400; font-size: ${isMobile ? '13px' : '14px'}; opacity: 0.95;">
                        It will take some time. Please refresh the page.
                    </div>
                </div>
            </div>
        `;
        
        // Add animations (only once)
        if (!document.getElementById('firebase-loading-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'firebase-loading-notification-styles';
            style.textContent = `
                @keyframes slideDownBounce {
                    0% {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-30px) scale(0.9);
                    }
                    60% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(5px) scale(1.02);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                }
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes slideUpFade {
                    from {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-30px) scale(0.9);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            notification.style.animation = 'slideUpFade 0.4s ease-out forwards';
            setTimeout(() => {
                notification.remove();
                repositionNotifications();
            }, 400);
        }, 10000);
    }
    
    // Reposition notifications when one is removed
    function repositionNotifications() {
        const notifications = document.querySelectorAll('.firebase-notification');
        let currentTop = 20;
        
        notifications.forEach((notif) => {
            if (notif.style.display !== 'none') {
                notif.style.top = currentTop + 'px';
                const rect = notif.getBoundingClientRect();
                currentTop += rect.height + 15;
            }
        });
    }
    
    // Show notification
    function showLoadingTimeoutNotification() {
        if (notificationShown) return;
        createOnScreenNotification();
        notificationShown = true;
    }
    
    // Monitor loading state
    function monitorLoadingState() {
        const skeletonVisible = isSkeletonLoading();
        const mainContentVisible = isMainContentVisible();
        const currentTime = Date.now();
        
        if (skeletonVisible && !mainContentVisible) {
            if (!loadingStartTime) {
                loadingStartTime = currentTime;
            }
            
            const elapsedTime = currentTime - loadingStartTime;
            
            if (elapsedTime >= LOADING_TIMEOUT && !notificationShown) {
                showLoadingTimeoutNotification();
            }
        } else {
            if (loadingStartTime && mainContentVisible) {
                stopMonitoring();
            }
        }
    }
    
    // Start monitoring
    function startMonitoring() {
        if (loadingCheckInterval) return;
        loadingStartTime = null;
        notificationShown = false;
        monitorLoadingState();
        loadingCheckInterval = setInterval(monitorLoadingState, CHECK_INTERVAL);
    }
    
    // Stop monitoring
    function stopMonitoring() {
        if (loadingCheckInterval) {
            clearInterval(loadingCheckInterval);
            loadingCheckInterval = null;
            loadingStartTime = null;
        }
    }
    
    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(startMonitoring, 500));
    } else {
        setTimeout(startMonitoring, 500);
    }
    
})();

// ==========================================
// PLATFORM & TASK MANAGER (ADMIN ONLY)
// Add/Remove Platforms and Additional Tasks
// ==========================================

(function() {
    'use strict';
    
    // Storage keys
    const CUSTOM_PLATFORMS_KEY = 'customPlatforms';
    const CUSTOM_TASKS_KEY = 'customAdditionalTasks';
    
    // Load custom platforms and tasks from localStorage
    let customPlatforms = JSON.parse(localStorage.getItem(CUSTOM_PLATFORMS_KEY)) || null;
    let customTasks = JSON.parse(localStorage.getItem(CUSTOM_TASKS_KEY)) || null;
    
    // Apply custom platforms if they exist
    function applyCustomPlatforms() {
        if (customPlatforms && typeof platforms !== 'undefined') {
            platforms.main = customPlatforms.main || platforms.main;
            platforms.common = customPlatforms.common || platforms.common;
            platforms.grouped = customPlatforms.grouped || platforms.grouped;
        }
    }
    
    // Initialize on page load
    function initPlatformTaskManager() {
        if (!isAdmin) return;
        
        // Apply custom platforms
        applyCustomPlatforms();
        
        // Add management buttons
        addManagementButtons();
        
    }
    
    // Add management buttons to the UI
    function addManagementButtons() {
        const scheduleControls = document.querySelector('.schedule-controls .schedule-actions');
        if (!scheduleControls) return;
        
        // Check if buttons already exist
        if (document.getElementById('managePlatformsBtn')) return;
        
        // Platform Management Button
        const platformBtn = document.createElement('button');
        platformBtn.id = 'managePlatformsBtn';
        platformBtn.className = 'btn btn-primary btn-small admin-only';
        platformBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Manage Platforms';
        platformBtn.onclick = openPlatformManager;
        platformBtn.style.marginLeft = '10px';
        scheduleControls.appendChild(platformBtn);
        
        // Task Management Button
        const taskBtn = document.createElement('button');
        taskBtn.id = 'manageTasksBtn';
        taskBtn.className = 'btn btn-primary btn-small admin-only';
        taskBtn.innerHTML = '<i class="fas fa-tasks"></i> Manage Tasks';
        taskBtn.onclick = openTaskManager;
        taskBtn.style.marginLeft = '10px';
        scheduleControls.appendChild(taskBtn);
    }
    
    // ========================================
    // PLATFORM MANAGER MODAL
    // ========================================
    
    function openPlatformManager() {
        // Get current platforms
        const currentPlatforms = customPlatforms || {
            main: [...platforms.main],
            common: [...platforms.common],
            grouped: [...platforms.grouped]
        };
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'platformManagerModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3><i class="fas fa-server"></i> Manage Platforms</h3>
                    <button class="modal-close" onclick="closePlatformManager()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Main Platforms -->
                    <div class="platform-section">
                        <h4 style="color: var(--primary-color); margin-bottom: 15px;">
                            <i class="fas fa-star"></i> Main Platforms
                        </h4>
                        <div id="mainPlatformsList" class="platform-list">
                            ${currentPlatforms.main.map((p, i) => `
                                <div class="platform-item">
                                    <input type="text" value="${p}" data-category="main" data-index="${i}" 
                                           class="platform-input" />
                                    <button class="btn-icon btn-danger" onclick="removePlatform('main', ${i})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-secondary btn-small" onclick="addNewPlatform('main')" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Add Main Platform
                        </button>
                    </div>
                    
                    <hr style="margin: 25px 0; border-color: var(--border-color);">
                    
                    <!-- Common Platforms -->
                    <div class="platform-section">
                        <h4 style="color: var(--primary-color); margin-bottom: 15px;">
                            <i class="fas fa-layer-group"></i> Common Platforms
                        </h4>
                        <div id="commonPlatformsList" class="platform-list">
                            ${currentPlatforms.common.map((p, i) => `
                                <div class="platform-item">
                                    <input type="text" value="${p}" data-category="common" data-index="${i}" 
                                           class="platform-input" />
                                    <button class="btn-icon btn-danger" onclick="removePlatform('common', ${i})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-secondary btn-small" onclick="addNewPlatform('common')" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Add Common Platform
                        </button>
                    </div>
                    
                    <hr style="margin: 25px 0; border-color: var(--border-color);">
                    
                    <!-- Grouped Platforms -->
                    <div class="platform-section">
                        <h4 style="color: var(--primary-color); margin-bottom: 15px;">
                            <i class="fas fa-object-group"></i> Grouped Platforms
                        </h4>
                        <div id="groupedPlatformsList" class="platform-list">
                            ${currentPlatforms.grouped.map((p, i) => `
                                <div class="platform-item">
                                    <input type="text" value="${p}" data-category="grouped" data-index="${i}" 
                                           class="platform-input" />
                                    <button class="btn-icon btn-danger" onclick="removePlatform('grouped', ${i})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-secondary btn-small" onclick="addNewPlatform('grouped')" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Add Grouped Platform
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closePlatformManager()">Cancel</button>
                    <button class="btn btn-danger" onclick="resetPlatformsToDefault()">
                        <i class="fas fa-undo"></i> Reset to Default
                    </button>
                    <button class="btn btn-primary" onclick="savePlatforms()">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add custom styles
        addPlatformManagerStyles();
    }
    
    function closePlatformManager() {
        const modal = document.getElementById('platformManagerModal');
        if (modal) modal.remove();
    }
    
    function addNewPlatform(category) {
        const listId = category + 'PlatformsList';
        const list = document.getElementById(listId);
        if (!list) return;
        
        const currentItems = list.querySelectorAll('.platform-item').length;
        
        const newItem = document.createElement('div');
        newItem.className = 'platform-item';
        newItem.innerHTML = `
            <input type="text" value="New Platform" data-category="${category}" data-index="${currentItems}" 
                   class="platform-input" autofocus />
            <button class="btn-icon btn-danger" onclick="removePlatform('${category}', ${currentItems})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        list.appendChild(newItem);
        newItem.querySelector('input').select();
    }
    
    function removePlatform(category, index) {
        const listId = category + 'PlatformsList';
        const list = document.getElementById(listId);
        if (!list) return;
        
        const items = list.querySelectorAll('.platform-item');
        if (items[index]) {
            items[index].remove();
            
            // Re-index remaining items
            list.querySelectorAll('.platform-item').forEach((item, i) => {
                item.querySelector('input').setAttribute('data-index', i);
                item.querySelector('button').setAttribute('onclick', `removePlatform('${category}', ${i})`);
            });
        }
    }
    
    function savePlatforms() {
        const newPlatforms = {
            main: [],
            common: [],
            grouped: []
        };
        
        // Collect all platform values
        document.querySelectorAll('.platform-input').forEach(input => {
            const category = input.getAttribute('data-category');
            const value = input.value.trim();
            if (value && newPlatforms[category]) {
                newPlatforms[category].push(value);
            }
        });
        
        // Validate
        if (newPlatforms.main.length === 0) {
            showNotification('❌ At least one main platform is required', 'error');
            return;
        }
        
        // Save to localStorage
        localStorage.setItem(CUSTOM_PLATFORMS_KEY, JSON.stringify(newPlatforms));
        customPlatforms = newPlatforms;
        
        // Apply to global platforms object
        platforms.main = newPlatforms.main;
        platforms.common = newPlatforms.common;
        platforms.grouped = newPlatforms.grouped;
        
        // Sync to Firebase if available
        if (window.hasDatabase && window.hasDatabase()) {
            database.ref('customPlatforms').set(newPlatforms)
                .then(() => {})
                .catch(err => {});
        }
        
        closePlatformManager();
        showNotification('✅ Platforms saved successfully! Regenerating schedule...', 'success');
        
        // Regenerate current schedule
        setTimeout(() => {
            const dateInput = document.getElementById('scheduleDate');
            if (dateInput && dateInput.value) {
                const currentDate = new Date(dateInput.value);
                generateDailySchedule(currentDate);
            }
        }, 500);
    }
    
    function resetPlatformsToDefault() {
        if (!confirm('Reset all platforms to default? This will remove all custom platforms.')) return;
        
        localStorage.removeItem(CUSTOM_PLATFORMS_KEY);
        customPlatforms = null;
        
        // Reset to original defaults
        platforms.main = ["SIEM", "XDR", "Forti EDR"];
        platforms.common = ["CrowdStrike EDR", "NDR", "Netskope"];
        platforms.grouped = ["Sophos XDR", "Trend Vision One", "Cloudflare", "Acronis EDR"];
        
        // Remove from Firebase
        if (window.hasDatabase && window.hasDatabase()) {
            database.ref('customPlatforms').remove();
        }
        
        closePlatformManager();
        showNotification('✅ Platforms reset to default! Regenerating schedule...', 'success');
        
        // Regenerate schedule
        setTimeout(() => {
            const dateInput = document.getElementById('scheduleDate');
            if (dateInput && dateInput.value) {
                const currentDate = new Date(dateInput.value);
                generateDailySchedule(currentDate);
            }
        }, 500);
    }
    
    // ========================================
    // TASK MANAGER MODAL
    // ========================================
    
    function openTaskManager() {
        // Get current tasks (default tasks)
        const defaultTasks = [
            "Email Handle",
            "Follow Up Remainder",
            "SIEM Device Status",
            "HO PPT Update",
            "Handover Presentation",
            "Handover Summary"
        ];
        
        const currentTasks = customTasks || [...defaultTasks];
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'taskManagerModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3><i class="fas fa-tasks"></i> Manage Additional Tasks</h3>
                    <button class="modal-close" onclick="closeTaskManager()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        <i class="fas fa-info-circle"></i> Add, remove, or rename additional tasks
                    </p>
                    <div id="tasksList" class="platform-list">
                        ${currentTasks.map((t, i) => `
                            <div class="platform-item">
                                <input type="text" value="${t}" data-index="${i}" class="task-input" />
                                <button class="btn-icon btn-danger" onclick="removeTask(${i})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-secondary btn-small" onclick="addNewTask()" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Add New Task
                    </button>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeTaskManager()" style="margin-top: 15px;">Cancel</button>
                    <button class="btn btn-danger" onclick="resetTasksToDefault()">
                        <i class="fas fa-undo"></i> Reset to Default
                    </button>
                    <button class="btn btn-primary" onclick="saveTasks()">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        addPlatformManagerStyles();
    }
    
    function closeTaskManager() {
        const modal = document.getElementById('taskManagerModal');
        if (modal) modal.remove();
    }
    
    function addNewTask() {
        const list = document.getElementById('tasksList');
        if (!list) return;
        
        const currentItems = list.querySelectorAll('.platform-item').length;
        
        const newItem = document.createElement('div');
        newItem.className = 'platform-item';
        newItem.innerHTML = `
            <input type="text" value="New Task" data-index="${currentItems}" class="task-input" autofocus />
            <button class="btn-icon btn-danger" onclick="removeTask(${currentItems})">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        list.appendChild(newItem);
        newItem.querySelector('input').select();
    }
    
    function removeTask(index) {
        const list = document.getElementById('tasksList');
        if (!list) return;
        
        const items = list.querySelectorAll('.platform-item');
        if (items.length <= 1) {
            showNotification('❌ At least one task is required', 'error');
            return;
        }
        
        if (items[index]) {
            items[index].remove();
            
            // Re-index
            list.querySelectorAll('.platform-item').forEach((item, i) => {
                item.querySelector('input').setAttribute('data-index', i);
                item.querySelector('button').setAttribute('onclick', `removeTask(${i})`);
            });
        }
    }
    
    function saveTasks() {
        const newTasks = [];
        
        document.querySelectorAll('.task-input').forEach(input => {
            const value = input.value.trim();
            if (value) {
                newTasks.push(value);
            }
        });
        
        if (newTasks.length === 0) {
            showNotification('❌ At least one task is required', 'error');
            return;
        }
        
        // Save to localStorage
        localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(newTasks));
        customTasks = newTasks;
        
        // Sync to Firebase
        if (window.hasDatabase && window.hasDatabase()) {
            database.ref('customAdditionalTasks').set(newTasks)
                .then(() => {})
                .catch(err => {});
        }
        
        closeTaskManager();
        showNotification('✅ Tasks saved successfully! Regenerating schedule...', 'success');
        
        // Regenerate schedule
        setTimeout(() => {
            const dateInput = document.getElementById('scheduleDate');
            if (dateInput && dateInput.value) {
                const currentDate = new Date(dateInput.value);
                generateDailySchedule(currentDate);
            }
        }, 500);
    }
    
    function resetTasksToDefault() {
        if (!confirm('Reset all tasks to default?')) return;
        
        localStorage.removeItem(CUSTOM_TASKS_KEY);
        customTasks = null;
        
        if (window.hasDatabase && window.hasDatabase()) {
            database.ref('customAdditionalTasks').remove();
        }
        
        closeTaskManager();
        showNotification('✅ Tasks reset to default! Regenerating schedule...', 'success');
        
        setTimeout(() => {
            const dateInput = document.getElementById('scheduleDate');
            if (dateInput && dateInput.value) {
                const currentDate = new Date(dateInput.value);
                generateDailySchedule(currentDate);
            }
        }, 500);
    }
    
    // Get custom tasks for schedule generation
    function getAdditionalTasksList() {
        return customTasks || [
            "Email Handle",
            "Follow Up Remainder",
            "SIEM Device Status",
            "HO PPT Update",
            "Handover Presentation",
            "Handover Summary"
        ];
    }
    
    // ========================================
    // STYLES
    // ========================================
    
    function addPlatformManagerStyles() {
        if (document.getElementById('platformManagerStyles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'platformManagerStyles';
        styles.textContent = `
            .platform-section {
                margin-bottom: 20px;
            }
            
            .platform-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .platform-item {
                display: flex;
                gap: 10px;
                align-items: center;
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            .platform-input,
            .task-input {
                flex: 1;
                padding: 10px;
                border: 2px solid var(--border-color);
                border-radius: 8px;
                font-size: 14px;
                background: var(--bg-primary);
                color: var(--text-primary);
                transition: all 0.2s ease;
            }
            
            .platform-input:focus,
            .task-input:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            
            .btn-icon {
                padding: 8px 12px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .btn-icon:hover {
                transform: scale(1.05);
            }
            
            .btn-danger {
                background: #ef4444;
                color: white;
            }
            
            .btn-danger:hover {
                background: #dc2626;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    // ========================================
    // EXPORT FUNCTIONS
    // ========================================
    
    window.openPlatformManager = openPlatformManager;
    window.closePlatformManager = closePlatformManager;
    window.addNewPlatform = addNewPlatform;
    window.removePlatform = removePlatform;
    window.savePlatforms = savePlatforms;
    window.resetPlatformsToDefault = resetPlatformsToDefault;
    
    window.openTaskManager = openTaskManager;
    window.closeTaskManager = closeTaskManager;
    window.addNewTask = addNewTask;
    window.removeTask = removeTask;
    window.saveTasks = saveTasks;
    window.resetTasksToDefault = resetTasksToDefault;
    window.getAdditionalTasksList = getAdditionalTasksList;
    
    window.initPlatformTaskManager = initPlatformTaskManager;
    
    // Load from Firebase on init
    if (window.hasDatabase && window.hasDatabase()) {
        database.ref('customPlatforms').once('value').then(snapshot => {
            const firebaseData = snapshot.val();
            if (firebaseData) {
                localStorage.setItem(CUSTOM_PLATFORMS_KEY, JSON.stringify(firebaseData));
                customPlatforms = firebaseData;
                applyCustomPlatforms();
            }
        });
        
        database.ref('customAdditionalTasks').once('value').then(snapshot => {
            const firebaseData = snapshot.val();
            if (firebaseData) {
                localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(firebaseData));
                customTasks = firebaseData;
            }
        });
    }
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initPlatformTaskManager, 1000);
        });
    } else {
        setTimeout(initPlatformTaskManager, 1000);
    }
    
    
})();

// ===================================================
// ENHANCED AI LEARNING SYSTEM v2.0
// ✅ WITH MANUAL TRAIN AI BUTTON CONTROL
// ===================================================

// Learning configuration
const AI_LEARNING_CONFIG = {
    TRAINING_WINDOW_DAYS: 14,
    MIN_PATTERNS_REQUIRED: 5,
    CONFIDENCE_THRESHOLD: 0.6,
    ENABLE_LEARNING: true,
    AUTO_TRAIN_ON_EDIT: false  // ✅ NEW: Controlled by Train AI button
};

// Pattern storage
let learnedPatterns = JSON.parse(localStorage.getItem('learnedPatterns')) || {
    platformAssignments: {},
    apprenticePairings: {},
    taskAssignments: {},
    weeklyRotation: {},
    lastUpdated: null,
    totalSchedules: 0
};

// ✅ NEW: Training state control
let aiTrainingEnabled = JSON.parse(localStorage.getItem('aiTrainingEnabled')) || false;

// ===================================================
// CORE LEARNING FUNCTIONS
// ===================================================

function analyzeAndLearnPatterns() {
    if (!AI_LEARNING_CONFIG.ENABLE_LEARNING) return;

    console.log('\n🧠 AI LEARNING: Analyzing schedule history...');

    const now = getNowSGT();
    const trainingPeriodStart = new Date(now);
    trainingPeriodStart.setDate(trainingPeriodStart.getDate() - AI_LEARNING_CONFIG.TRAINING_WINDOW_DAYS);

    const trainingSchedules = [];
    for (const [dateStr, schedule] of Object.entries(scheduleHistory)) {
        const scheduleDate = new Date(dateStr);
        if (scheduleDate >= trainingPeriodStart && scheduleDate <= now) {
            trainingSchedules.push({ date: dateStr, ...schedule });
        }
    }

    console.log(`📊 Found ${trainingSchedules.length} schedules in last ${AI_LEARNING_CONFIG.TRAINING_WINDOW_DAYS} days`);

    if (trainingSchedules.length < AI_LEARNING_CONFIG.MIN_PATTERNS_REQUIRED) {
        console.log('⚠️ Not enough data to learn patterns');
        return;
    }

    learnedPatterns.platformAssignments = {};
    learnedPatterns.apprenticePairings = {};
    learnedPatterns.taskAssignments = {};
    learnedPatterns.weeklyRotation = {};

    trainingSchedules.forEach(schedule => {
        learnFromSchedule(schedule);
    });

    calculateConfidenceScores();

    learnedPatterns.lastUpdated = now.toISOString();
    learnedPatterns.totalSchedules = trainingSchedules.length;
    localStorage.setItem('learnedPatterns', JSON.stringify(learnedPatterns));

    console.log('✅ AI Learning complete!');
    console.log('📈 Learned patterns:', {
        platforms: Object.keys(learnedPatterns.platformAssignments).length,
        pairings: Object.keys(learnedPatterns.apprenticePairings).length,
        tasks: Object.keys(learnedPatterns.taskAssignments).length
    });
}

function learnFromSchedule(schedule) {
    const scheduleDate = new Date(schedule.date);
    const dayOfWeek = scheduleDate.getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

    if (schedule.platforms) {
        Object.entries(schedule.platforms).forEach(([platform, assignment]) => {
            const sa = assignment.inCharge;
            const apprentice = assignment.responsibility;

            if (sa === 'All SAs' || sa === 'TBD' || sa === 'No SA Available') return;

            if (!learnedPatterns.platformAssignments[platform]) {
                learnedPatterns.platformAssignments[platform] = {};
            }
            if (!learnedPatterns.platformAssignments[platform][sa]) {
                learnedPatterns.platformAssignments[platform][sa] = { count: 0, days: [] };
            }
            learnedPatterns.platformAssignments[platform][sa].count++;
            learnedPatterns.platformAssignments[platform][sa].days.push(dayName);

            if (apprentice && apprentice !== 'All Apprentice' && apprentice !== 'N/A') {
                const pairingKey = `${sa}`;
                if (!learnedPatterns.apprenticePairings[pairingKey]) {
                    learnedPatterns.apprenticePairings[pairingKey] = {};
                }
                if (!learnedPatterns.apprenticePairings[pairingKey][apprentice]) {
                    learnedPatterns.apprenticePairings[pairingKey][apprentice] = 0;
                }
                learnedPatterns.apprenticePairings[pairingKey][apprentice]++;
            }

            const weekKey = `${platform}_${dayName}`;
            if (!learnedPatterns.weeklyRotation[weekKey]) {
                learnedPatterns.weeklyRotation[weekKey] = {};
            }
            if (!learnedPatterns.weeklyRotation[weekKey][sa]) {
                learnedPatterns.weeklyRotation[weekKey][sa] = 0;
            }
            learnedPatterns.weeklyRotation[weekKey][sa]++;
        });
    }

    if (schedule.tasks) {
        Object.entries(schedule.tasks).forEach(([taskName, assigned]) => {
            if (assigned && assigned !== 'TBD') {
                if (!learnedPatterns.taskAssignments[taskName]) {
                    learnedPatterns.taskAssignments[taskName] = {};
                }
                if (!learnedPatterns.taskAssignments[taskName][assigned]) {
                    learnedPatterns.taskAssignments[taskName][assigned] = 0;
                }
                learnedPatterns.taskAssignments[taskName][assigned]++;
            }
        });
    }
}

function calculateConfidenceScores() {
    Object.keys(learnedPatterns.platformAssignments).forEach(platform => {
        const saAssignments = learnedPatterns.platformAssignments[platform];
        const total = Object.values(saAssignments).reduce((sum, data) => sum + data.count, 0);

        Object.keys(saAssignments).forEach(sa => {
            saAssignments[sa].confidence = saAssignments[sa].count / total;
        });
    });

    Object.keys(learnedPatterns.apprenticePairings).forEach(sa => {
        const pairings = learnedPatterns.apprenticePairings[sa];
        const total = Object.values(pairings).reduce((sum, count) => sum + count, 0);

        const pairingsWithConfidence = {};
        Object.keys(pairings).forEach(apprentice => {
            pairingsWithConfidence[apprentice] = {
                count: pairings[apprentice],
                confidence: pairings[apprentice] / total
            };
        });
        learnedPatterns.apprenticePairings[sa] = pairingsWithConfidence;
    });

    Object.keys(learnedPatterns.taskAssignments).forEach(task => {
        const assignments = learnedPatterns.taskAssignments[task];
        const total = Object.values(assignments).reduce((sum, count) => sum + count, 0);

        const assignmentsWithConfidence = {};
        Object.keys(assignments).forEach(assigned => {
            assignmentsWithConfidence[assigned] = {
                count: assignments[assigned],
                confidence: assignments[assigned] / total
            };
        });
        learnedPatterns.taskAssignments[task] = assignmentsWithConfidence;
    });
}

// ===================================================
// AI-POWERED SCHEDULE GENERATION
// ===================================================

function generateScheduleWithAI(date) {
    console.log('\n🤖 AI-POWERED SCHEDULE GENERATION');

    const schedule = {
        date: date.toISOString().split('T')[0],
        shift: getCurrentShift(date),
        platforms: {},
        tasks: {},
        aiGenerated: true,
        confidence: 0
    };

    const dateStr = schedule.date;
    const dayOfWeek = date.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];

    const availableSAs = getAvailableSAsForDate(date).filter(sa => {
        const key = `${sa}_SA`;
        return !availabilityOverrides[key];
    });

    const availableApps = getAvailableApprenticesForDate(date).filter(app => {
        const key = `${app}_Apprentice`;
        return !availabilityOverrides[key];
    });

    console.log(`📅 Generating for ${dayName}`);
    console.log(`✅ Available: ${availableSAs.length} SAs, ${availableApps.length} Apprentices`);

    if (availableSAs.length === 0) {
        console.log('❌ No SAs available');
        [...platforms.main, ...platforms.common, ...platforms.grouped].forEach(p => {
            schedule.platforms[p] = { inCharge: 'No SA Available', responsibility: 'N/A' };
        });
        return schedule;
    }

    const usedSAs = [];
    let totalConfidence = 0;
    let assignmentCount = 0;

    platforms.main.forEach(platform => {
        const assignment = assignPlatformWithAI(platform, dayName, availableSAs, usedSAs, availableApps);
        schedule.platforms[platform] = assignment;
        if (assignment.confidence) {
            totalConfidence += assignment.confidence;
            assignmentCount++;
        }
        console.log(`  ${platform}: ${assignment.inCharge} (confidence: ${(assignment.confidence * 100).toFixed(1)}%)`);
    });

    const remainingSAs = availableSAs.filter(sa => !usedSAs.includes(sa));

    if (dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
        platforms.common.forEach(platform => {
            schedule.platforms[platform] = { inCharge: 'All SAs', responsibility: 'All Apprentice' };
        });
    } else {
        platforms.common.forEach((platform, idx) => {
            let sa = remainingSAs[idx % remainingSAs.length] || availableSAs[0];
            schedule.platforms[platform] = { inCharge: sa, responsibility: 'All Apprentice' };
        });
    }

    let groupedIndex = 0;
    platforms.grouped.forEach(platform => {
        if (platform === 'Acronis EDR') {
            schedule.platforms[platform] = { 
                inCharge: schedule.platforms['NDR']?.inCharge || 'All SAs', 
                responsibility: 'All Apprentice' 
            };
        } else {
            const sa = remainingSAs[groupedIndex % remainingSAs.length] || 'TBD';
            schedule.platforms[platform] = { inCharge: sa, responsibility: 'All Apprentice' };
            groupedIndex++;
        }
    });

    schedule.tasks = assignTasksWithAI(dayOfWeek, remainingSAs, availableApps);

    schedule.confidence = assignmentCount > 0 ? totalConfidence / assignmentCount : 0;
    console.log(`\n📊 Overall AI Confidence: ${(schedule.confidence * 100).toFixed(1)}%`);

    return schedule;
}

function assignPlatformWithAI(platform, dayName, availableSAs, usedSAs, availableApps) {
    const weekKey = `${platform}_${dayName}`;

    if (learnedPatterns.weeklyRotation[weekKey]) {
        const candidates = learnedPatterns.weeklyRotation[weekKey];
        const availableCandidates = Object.entries(candidates)
            .filter(([sa]) => availableSAs.includes(sa) && !usedSAs.includes(sa))
            .sort((a, b) => b[1] - a[1]);

        if (availableCandidates.length > 0) {
            const bestSA = availableCandidates[0][0];
            const confidence = availableCandidates[0][1] / Object.values(candidates).reduce((a, b) => a + b, 0);
            usedSAs.push(bestSA);
            const apprentice = getApprenticeForSA(bestSA, availableApps);

            return {
                inCharge: bestSA,
                responsibility: apprentice,
                confidence: confidence,
                source: 'AI_Weekly_Pattern'
            };
        }
    }

    if (learnedPatterns.platformAssignments[platform]) {
        const candidates = Object.entries(learnedPatterns.platformAssignments[platform])
            .filter(([sa]) => availableSAs.includes(sa) && !usedSAs.includes(sa))
            .sort((a, b) => b[1].confidence - a[1].confidence);

        if (candidates.length > 0) {
            const bestSA = candidates[0][0];
            const confidence = candidates[0][1].confidence;
            usedSAs.push(bestSA);
            const apprentice = getApprenticeForSA(bestSA, availableApps);

            return {
                inCharge: bestSA,
                responsibility: apprentice,
                confidence: confidence,
                source: 'AI_Platform_Pattern'
            };
        }
    }

    const bestSA = availableSAs.find(sa => !usedSAs.includes(sa)) || availableSAs[0];
    usedSAs.push(bestSA);
    const apprentice = getApprenticeForSA(bestSA, availableApps);

    return {
        inCharge: bestSA,
        responsibility: apprentice,
        confidence: 0,
        source: 'Workload_Fallback'
    };
}

function getApprenticeForSA(sa, availableApps) {
    if (learnedPatterns.apprenticePairings[sa]) {
        const pairings = Object.entries(learnedPatterns.apprenticePairings[sa])
            .filter(([apprentice]) => {
                const apps = apprentice.split('/').map(a => a.trim());
                return apps.every(app => availableApps.includes(app));
            })
            .sort((a, b) => b[1].confidence - a[1].confidence);

        if (pairings.length > 0 && pairings[0][1].confidence >= AI_LEARNING_CONFIG.CONFIDENCE_THRESHOLD) {
            return pairings[0][0];
        }
    }

    if (teamData.responsibilities[sa] && teamData.responsibilities[sa] !== 'All Apprentice') {
        return teamData.responsibilities[sa];
    }

    return smartApprenticeAssignment(sa, availableApps, '', 0, 3);
}

function assignTasksWithAI(dayOfWeek, remainingSAs, availableApps) {
    const tasks = {};

    Object.keys(learnedPatterns.taskAssignments).forEach(taskName => {
        const assignments = Object.entries(learnedPatterns.taskAssignments[taskName])
            .filter(([assigned]) => {
                const people = assigned.split('/').map(p => p.trim());
                return people.every(person => 
                    remainingSAs.includes(person) || availableApps.includes(person)
                );
            })
            .sort((a, b) => b[1].confidence - a[1].confidence);

        if (assignments.length > 0 && assignments[0][1].confidence >= AI_LEARNING_CONFIG.CONFIDENCE_THRESHOLD) {
            tasks[taskName] = assignments[0][0];
        }
    });

    if (!tasks["Email Handle"] && remainingSAs[0] && availableApps[0]) {
        tasks["Email Handle"] = `${remainingSAs[0]} / ${availableApps[0]}`;
    }
    if (!tasks["Follow Up Remainder"] && availableApps[0]) {
        tasks["Follow Up Remainder"] = availableApps[0];
    }
    if (!tasks["SIEM Device Status"] && remainingSAs[1] && availableApps[1]) {
        tasks["SIEM Device Status"] = `${remainingSAs[1] || remainingSAs[0]} / ${availableApps[1] || availableApps[0]}`;
    }
    if (!tasks["HO PPT Update"] && remainingSAs[0] && availableApps[0]) {
        tasks["HO PPT Update"] = `${remainingSAs[0]} / ${availableApps[0]} / ${availableApps[1] || ''}`.trim();
    }
    if (!tasks["Handover Presentation"]) {
        tasks["Handover Presentation"] = (dayOfWeek === 1 || dayOfWeek === 0) ? POC_NAME : (remainingSAs[0] || 'TBD');
    }
    if (!tasks["Handover Summary"] && availableApps[availableApps.length - 1]) {
        tasks["Handover Summary"] = availableApps[availableApps.length - 1];
    }

    return tasks;
}

// ===================================================
// UI & CONTROLS
// ===================================================

function addAILearningControls() {
    if (!isAdmin) return;

    const scheduleControls = document.querySelector('.schedule-controls .schedule-actions');
    if (scheduleControls && !document.getElementById('aiLearningControls')) {
        const controlsHTML = `
            <button id="trainAIBtn" class="btn ${aiTrainingEnabled ? 'btn-success' : 'btn-secondary'} btn-small admin-only" 
                    onclick="toggleAITraining()" title="${aiTrainingEnabled ? 'AI Training: ON' : 'AI Training: OFF'}">
                <i class="fas fa-brain"></i> ${aiTrainingEnabled ? 'AI Training: ON' : 'AI Training: OFF'}
            </button>
            <button id="viewPatternsBtn" class="btn btn-secondary btn-small admin-only" onclick="viewLearnedPatterns()">
                <i class="fas fa-chart-line"></i> View Patterns
            </button>
            <button id="clearAIBtn" class="btn btn-secondary btn-small admin-only" onclick="clearLearnedPatterns()">
                <i class="fas fa-eraser"></i> Clear AI Data
            </button>
        `;

        const div = document.createElement('div');
        div.id = 'aiLearningControls';
        div.style.cssText = 'display: flex; gap: 0.5rem; flex-wrap: wrap;';
        div.innerHTML = controlsHTML;
        scheduleControls.appendChild(div);
    }
}

// ✅ NEW: Toggle AI training on/off
function toggleAITraining() {
    if (!isAdmin) {
        showNotification('Admin access required', 'error');
        return;
    }

    aiTrainingEnabled = !aiTrainingEnabled;
    localStorage.setItem('aiTrainingEnabled', JSON.stringify(aiTrainingEnabled));

    const btn = document.getElementById('trainAIBtn');
    if (btn) {
        btn.className = `btn ${aiTrainingEnabled ? 'btn-success' : 'btn-secondary'} btn-small admin-only`;
        btn.innerHTML = `<i class="fas fa-brain"></i> ${aiTrainingEnabled ? 'AI Training: ON' : 'AI Training: OFF'}`;
        btn.title = aiTrainingEnabled ? 'AI Training: ON' : 'AI Training: OFF';
    }

    AI_LEARNING_CONFIG.AUTO_TRAIN_ON_EDIT = aiTrainingEnabled;

    if (aiTrainingEnabled) {
        showNotification('AI Training enabled - will learn from edits', 'success');
        analyzeAndLearnPatterns();
    } else {
        showNotification('AI Training paused', 'info');
    }
}

function viewLearnedPatterns() {
    if (!isAdmin) return;

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.style.cssText = 'display: flex; z-index: 9999;';

    const platformsHTML = Object.entries(learnedPatterns.platformAssignments)
        .slice(0, 5)
        .map(([platform, sas]) => {
            const topSA = Object.entries(sas).sort((a, b) => b[1].confidence - a[1].confidence)[0];
            return `<li><strong>${platform}</strong>: ${topSA[0]} (${(topSA[1].confidence * 100).toFixed(1)}% confidence)</li>`;
        })
        .join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h3><i class="fas fa-brain"></i> AI Learned Patterns</h3>
            <div style="margin-top: 1rem;">
                <p><strong>Training Status:</strong> ${aiTrainingEnabled ? '✅ Active' : '⏸️ Paused'}</p>
                <p><strong>Last Updated:</strong> ${learnedPatterns.lastUpdated ? new Date(learnedPatterns.lastUpdated).toLocaleString() : 'Never'}</p>
                <p><strong>Training Data:</strong> ${learnedPatterns.totalSchedules} schedules</p>
                <hr style="margin: 1rem 0;">
                <h4>Top Platform Assignments:</h4>
                <ul style="margin-top: 0.5rem;">${platformsHTML || '<li>No patterns learned yet</li>'}</ul>
                <hr style="margin: 1rem 0;">
                <p style="color: var(--text-secondary); font-size: 0.9rem;">
                    ${aiTrainingEnabled ? 'The AI is actively learning from your manual edits.' : 'Enable AI Training to start learning from edits.'}
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function clearLearnedPatterns() {
    if (!isAdmin) return;

    if (!confirm('Clear all AI learned patterns?')) return;

    learnedPatterns = {
        platformAssignments: {},
        apprenticePairings: {},
        taskAssignments: {},
        weeklyRotation: {},
        lastUpdated: null,
        totalSchedules: 0
    };

    localStorage.setItem('learnedPatterns', JSON.stringify(learnedPatterns));
    showNotification('AI patterns cleared', 'success');
}

// ✅ MODIFIED: Only train if enabled
function onScheduleEdited(schedule) {
    if (!aiTrainingEnabled) {
        console.log('⏸️ AI Training paused - skipping learning');
        return;
    }

    console.log('📝 Schedule edited manually - triggering AI learning...');
    setTimeout(() => {
        analyzeAndLearnPatterns();
        showNotification('AI learned from your edit!', 'success', { type: 'info', bgColor: '#10b981' });
    }, 1000);
}

// Add CSS for toggle button states
const aiStyles = `
<style id="aiLearningStyles">
.btn-success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
}

.btn-success:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: translateY(-2px);
}
</style>
`;

if (!document.getElementById('aiLearningStyles')) {
    document.head.insertAdjacentHTML('beforeend', aiStyles);
}

console.log('%c🧠 AI Learning System v2.0 Loaded', 'color: #10b981; font-weight: bold; font-size: 14px');
console.log('%c🎛️ Manual control via Train AI button', 'color: #3b82f6; font-size: 12px');

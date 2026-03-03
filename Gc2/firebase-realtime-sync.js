// ==========================================
// FIREBASE REAL-TIME SYNCHRONIZATION
// Auto-updates all devices when admin makes changes
// Fixes: schedule + tasks real-time display on all devices
// ==========================================

(function() {
    'use strict';

    let listenersAttached = false;
    let currentScheduleListener = null;
    let hasEverConnected = false;

    // ========================================
    // SAFE localStorage WRAPPER
    // Handles groupStorage.js key prefixing (gc1_/gc2_/gc3_)
    // and browser tracking prevention blocks silently
    // ========================================
    function safeSetItem(key, value) {
        try { localStorage.setItem(key, value); } catch(e) {}
    }

    // ========================================
    // CORE: Apply a Firebase schedule to the page
    // Updates BOTH the platforms table AND the tasks section.
    // This is the only function that should update the display on non-admin devices.
    // Never calls generateDailySchedule — that reads stale localStorage.
    // ========================================
    function applyScheduleToPage(schedule, dateStr) {
        if (!schedule) return;

        // Update in-memory + localStorage cache
        if (typeof scheduleHistory !== 'undefined') {
            scheduleHistory[dateStr] = schedule;
            safeSetItem('scheduleHistory', JSON.stringify(scheduleHistory));
        }

        // Only update display if this date is currently visible
        const dateInput = document.getElementById('scheduleDate');
        if (!dateInput || dateInput.value !== dateStr) return;

        console.log('SYNC: applying schedule + tasks from Firebase for', dateStr);

        // displaySchedule() renders both the platforms table AND calls
        // displayAdditionalTasks() internally — so one call updates everything
        if (typeof displaySchedule === 'function') {
            displaySchedule(schedule);
        }

        if (typeof updateCurrentShiftInfo === 'function') {
            updateCurrentShiftInfo(new Date(dateStr + 'T00:00:00'));
        }

        if (typeof isAdmin !== 'undefined' && !isAdmin) {
            if (typeof showNotification === 'function') {
                showNotification('📋 Schedule updated by admin', 'info');
            }
        }
    }

    // ========================================
    // FETCH + DISPLAY: Re-fetch current date from Firebase then display
    // Used when availability/leave/member settings change.
    // Replaces the old pattern of calling generateDailySchedule() which
    // re-reads localStorage (wrong group prefix or stale data) and overwrites
    // whatever Firebase just pushed.
    // ========================================
    function fetchAndDisplayCurrentSchedule() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        const dateInput = document.getElementById('scheduleDate');
        if (!dateInput || !dateInput.value) return;
        const dateStr = dateInput.value;

        database.ref('schedules/' + dateStr).once('value')
            .then((snapshot) => {
                const schedule = snapshot.val();
                if (schedule) {
                    console.log('SYNC: fetched latest schedule from Firebase for', dateStr);
                    applyScheduleToPage(schedule, dateStr);
                }
            })
            .catch((err) => console.error('SYNC: fetch error:', err));
    }

    // ========================================
    // REAL-TIME SCHEDULE + TASKS LISTENER
    // .on('value') fires IMMEDIATELY with current data on attach,
    // then again every time admin saves a change (platforms or tasks).
    // This is what makes all devices update without refreshing.
    // ========================================
    function setupScheduleListener(dateStr) {
        if (!window.hasDatabase || !window.hasDatabase()) {
            console.log('WARNING: Firebase not available - real-time sync disabled');
            return;
        }

        // Skip if already listening to this exact date - prevents duplicate listeners
        if (currentScheduleListener === dateStr) {
            console.log('SYNC: already listening for', dateStr);
            return;
        }

        // Detach previous date listener before attaching new one
        if (currentScheduleListener) {
            database.ref('schedules/' + currentScheduleListener).off('value');
            console.log('SYNC: detached listener for', currentScheduleListener);
        }

        currentScheduleListener = dateStr;
        console.log('SYNC: listening for schedule + task changes on', dateStr);

        database.ref('schedules/' + dateStr).on('value', (snapshot) => {
            const schedule = snapshot.val();
            if (!schedule) return;

            console.log('SYNC: schedule/tasks updated from Firebase for', dateStr);
            applyScheduleToPage(schedule, dateStr);

        }, (error) => {
            console.error('SYNC: schedule listener error:', error);
        });
    }

    // ========================================
    // REAL-TIME TEAM DATA SYNC
    // ========================================
    function setupTeamDataListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        console.log('SYNC: listening for team data changes');

        database.ref('teamData').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof teamData === 'undefined') return;
            console.log('SYNC: team data updated from Firebase');
            Object.assign(teamData, data);
            safeSetItem('teamData', JSON.stringify(teamData));
            if (typeof updateTeamMembersDisplay === 'function') updateTeamMembersDisplay();
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('👥 Team members updated', 'info');
        }, (err) => { console.error('SYNC: team data error:', err); });
    }

    // ========================================
    // REAL-TIME AVAILABILITY SYNC
    // ========================================
    function setupAvailabilityListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        console.log('SYNC: listening for availability changes');

        database.ref('availabilityOverrides').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof availabilityOverrides === 'undefined') return;
            console.log('SYNC: availability updated from Firebase');
            availabilityOverrides = data;
            safeSetItem('availabilityOverrides', JSON.stringify(availabilityOverrides));
            fetchAndDisplayCurrentSchedule();
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('📅 Availability updated', 'info');
        }, (err) => { console.error('SYNC: availability error:', err); });
    }

    // ========================================
    // REAL-TIME MEMBER AVAILABILITY SETTINGS SYNC
    // ========================================
    function setupMemberAvailabilityListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        console.log('SYNC: listening for member availability settings');

        database.ref('memberAvailabilitySettings').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof memberAvailabilitySettings === 'undefined') return;
            console.log('SYNC: member availability settings updated from Firebase');
            Object.assign(memberAvailabilitySettings, data);
            safeSetItem('memberAvailabilitySettings', JSON.stringify(memberAvailabilitySettings));
            fetchAndDisplayCurrentSchedule();
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('⚙️ Working schedules updated', 'info');
        }, (err) => { console.error('SYNC: member availability error:', err); });
    }

    // ========================================
    // REAL-TIME LEAVE MANAGEMENT SYNC
    // ========================================
    function setupLeaveManagementListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        console.log('SYNC: listening for leave management changes');

        // Using 'leaveSettings' to match saveLeaveSettingsToFirebase()
        database.ref('leaveSettings').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof monthlyLeaveSettings === 'undefined') return;
            console.log('SYNC: leave settings updated from Firebase');
            Object.assign(monthlyLeaveSettings, data);
            safeSetItem('monthlyLeaveSettings', JSON.stringify(monthlyLeaveSettings));
            if (typeof syncWorkingSchedulesWithLeave === 'function') syncWorkingSchedulesWithLeave();
            fetchAndDisplayCurrentSchedule();
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('🏖️ Leave calendar updated', 'info');
        }, (err) => { console.error('SYNC: leave error:', err); });
    }

    // ========================================
    // INITIALIZE ALL LISTENERS
    // ========================================
    function initializeRealtimeSync() {
        if (listenersAttached) {
            console.log('SYNC: listeners already attached');
            return;
        }
        if (!window.hasDatabase || !window.hasDatabase()) {
            console.log('SYNC: Firebase not available - skipping');
            return;
        }

        console.log('SYNC: initializing all real-time listeners...');

        setupTeamDataListener();
        setupAvailabilityListener();
        setupMemberAvailabilityListener();
        setupLeaveManagementListener();

        // Wait for the date input to be populated before attaching schedule listener
        function waitForDateAndAttach() {
            const dateInput = document.getElementById('scheduleDate');
            if (dateInput && dateInput.value) {
                setupScheduleListener(dateInput.value);

                // Switch listener when user browses to a different date
                // Flag prevents adding duplicate listeners if re-init is called
                if (!dateInput._syncChangeAttached) {
                    dateInput.addEventListener('change', function() {
                        if (this.value) {
                            console.log('SYNC: date changed to', this.value, '- switching listener');
                            currentScheduleListener = null;
                            setupScheduleListener(this.value);
                        }
                    });
                    dateInput._syncChangeAttached = true;
                }
            } else {
                setTimeout(waitForDateAndAttach, 300);
            }
        }
        waitForDateAndAttach();

        listenersAttached = true;
        console.log('SYNC: initialized - schedules and tasks will update on all devices instantly');
    }

    // ========================================
    // CONNECTION MONITOR
    // Re-attaches all listeners after a network disconnect/reconnect.
    // IMPORTANT: Firebase emits .info/connected = false briefly on startup
    // before the first real connection. hasEverConnected flag prevents this
    // from resetting listenersAttached and causing duplicate initialization.
    // ========================================
    function setupConnectionMonitor() {
        if (!window.hasDatabase || !window.hasDatabase()) return;

        database.ref('.info/connected').on('value', (snapshot) => {
            const isConnected = snapshot.val() === true;

            if (isConnected) {
                console.log('SYNC: Firebase connected');
                if (!hasEverConnected) {
                    // First real connection — startup already handled by tryInitialize
                    hasEverConnected = true;
                } else {
                    // This is a reconnect after a real network drop
                    console.log('SYNC: reconnected - re-attaching all listeners');
                    listenersAttached = false;
                    initializeRealtimeSync();
                    // Force re-attach schedule listener for currently viewed date
                    const dateInput = document.getElementById('scheduleDate');
                    if (dateInput && dateInput.value) {
                        currentScheduleListener = null;
                        setupScheduleListener(dateInput.value);
                    }
                }
            } else {
                // Ignore the initial false before first connect
                if (hasEverConnected) {
                    console.log('SYNC: Firebase disconnected - will re-sync on reconnect');
                    listenersAttached = false;
                }
            }
        });
    }

    // ========================================
    // EXPORT FUNCTIONS
    // ========================================
    window.realtimeSync = {
        initialize: initializeRealtimeSync,
        setupScheduleListener: setupScheduleListener,
        detachListeners: function() {
            if (!window.hasDatabase || !window.hasDatabase()) return;
            console.log('SYNC: detaching all listeners');
            database.ref('teamData').off('value');
            database.ref('availabilityOverrides').off('value');
            database.ref('memberAvailabilitySettings').off('value');
            database.ref('leaveSettings').off('value');
            database.ref('.info/connected').off('value');
            if (currentScheduleListener) {
                database.ref('schedules/' + currentScheduleListener).off('value');
            }
            listenersAttached = false;
            currentScheduleListener = null;
            console.log('SYNC: all listeners detached');
        }
    };

    // ========================================
    // AUTO-INITIALIZE WHEN PAGE LOADS
    // ========================================
    function tryInitialize() {
        if (window.hasDatabase && window.hasDatabase()) {
            console.log('SYNC: Firebase ready - starting real-time sync');
            initializeRealtimeSync();
            setupConnectionMonitor();
        } else {
            console.log('SYNC: waiting for Firebase...');
            setTimeout(tryInitialize, 500);
        }
    }

    setTimeout(tryInitialize, 1000);

    console.log('%cFirebase Real-Time Sync Loaded', 'color:#10b981;font-weight:bold;font-size:14px');
    console.log('%c  Schedules + tasks sync instantly across all devices', 'color:#3b82f6;font-size:12px');

})();

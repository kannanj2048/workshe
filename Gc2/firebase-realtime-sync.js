// ==========================================
// FIREBASE REAL-TIME SYNCHRONIZATION
// ==========================================

(function() {
    'use strict';

    let listenersAttached = false;
    let currentScheduleListener = null;
    let hasEverConnected = false;

    function safeSetItem(key, value) {
        try { localStorage.setItem(key, value); } catch(e) {}
    }

    function applyScheduleToPage(schedule, dateStr) {
        if (!schedule) return;
        if (typeof scheduleHistory !== 'undefined') {
            scheduleHistory[dateStr] = schedule;
            safeSetItem('scheduleHistory', JSON.stringify(scheduleHistory));
        }
        const dateInput = document.getElementById('scheduleDate');
        if (!dateInput || dateInput.value !== dateStr) return;
        if (typeof window._markRealtimeSynced === 'function') window._markRealtimeSynced();
        console.log('SYNC: displaying schedule+tasks from Firebase for', dateStr);
        if (typeof displaySchedule === 'function') displaySchedule(schedule);
        if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(new Date(dateStr + 'T00:00:00'));
        if (typeof isAdmin !== 'undefined' && !isAdmin)
            if (typeof showNotification === 'function') showNotification('Schedule updated by admin', 'info');
    }

    function fetchAndDisplayCurrentSchedule() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        const dateInput = document.getElementById('scheduleDate');
        if (!dateInput || !dateInput.value) return;
        const dateStr = dateInput.value;
        database.ref('schedules/' + dateStr).once('value')
            .then((snapshot) => { const s = snapshot.val(); if (s) applyScheduleToPage(s, dateStr); })
            .catch((err) => console.error('SYNC fetch error:', err));
    }

    function setupScheduleListener(dateStr) {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        if (currentScheduleListener === dateStr) return;
        if (currentScheduleListener) database.ref('schedules/' + currentScheduleListener).off('value');
        currentScheduleListener = dateStr;
        console.log('SYNC: listening on', dateStr);
        database.ref('schedules/' + dateStr).on('value', (snapshot) => {
            const schedule = snapshot.val();
            if (schedule) applyScheduleToPage(schedule, dateStr);
        }, (error) => { console.error('SYNC schedule listener error:', error); });
    }

    function setupTeamDataListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        database.ref('teamData').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof teamData === 'undefined') return;
            Object.assign(teamData, data);
            safeSetItem('teamData', JSON.stringify(teamData));
            if (typeof updateTeamMembersDisplay === 'function') updateTeamMembersDisplay();
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('Team members updated', 'info');
        }, (err) => { console.error('SYNC team error:', err); });
    }

    function setupAvailabilityListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        database.ref('availabilityOverrides').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof availabilityOverrides === 'undefined') return;
            availabilityOverrides = data;
            safeSetItem('availabilityOverrides', JSON.stringify(availabilityOverrides));
            fetchAndDisplayCurrentSchedule();
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('Availability updated', 'info');
        }, (err) => { console.error('SYNC availability error:', err); });
    }

    function setupMemberAvailabilityListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        database.ref('memberAvailabilitySettings').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof memberAvailabilitySettings === 'undefined') return;
            Object.assign(memberAvailabilitySettings, data);
            safeSetItem('memberAvailabilitySettings', JSON.stringify(memberAvailabilitySettings));
            fetchAndDisplayCurrentSchedule();
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('Working schedules updated', 'info');
        }, (err) => { console.error('SYNC member availability error:', err); });
    }

    function setupLeaveManagementListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        database.ref('leaveSettings').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof monthlyLeaveSettings === 'undefined') return;
            Object.assign(monthlyLeaveSettings, data);
            safeSetItem('monthlyLeaveSettings', JSON.stringify(monthlyLeaveSettings));
            if (typeof syncWorkingSchedulesWithLeave === 'function') syncWorkingSchedulesWithLeave();
            fetchAndDisplayCurrentSchedule();
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('Leave calendar updated', 'info');
        }, (err) => { console.error('SYNC leave error:', err); });
    }

    function initializeRealtimeSync() {
        if (listenersAttached) return;
        if (!window.hasDatabase || !window.hasDatabase()) return;
        console.log('SYNC: initializing...');
        setupTeamDataListener();
        setupAvailabilityListener();
        setupMemberAvailabilityListener();
        setupLeaveManagementListener();
        function waitForDateAndAttach() {
            const dateInput = document.getElementById('scheduleDate');
            if (dateInput && dateInput.value) {
                setupScheduleListener(dateInput.value);
                if (!dateInput._syncChangeAttached) {
                    dateInput.addEventListener('change', function() {
                        if (this.value) { currentScheduleListener = null; setupScheduleListener(this.value); }
                    });
                    dateInput._syncChangeAttached = true;
                }
            } else { setTimeout(waitForDateAndAttach, 300); }
        }
        waitForDateAndAttach();
        listenersAttached = true;
        console.log('SYNC: ready');
    }

    function setupConnectionMonitor() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        database.ref('.info/connected').on('value', (snapshot) => {
            const isConnected = snapshot.val() === true;
            if (isConnected) {
                if (!hasEverConnected) { hasEverConnected = true; }
                else {
                    listenersAttached = false;
                    initializeRealtimeSync();
                    const di = document.getElementById('scheduleDate');
                    if (di && di.value) { currentScheduleListener = null; setupScheduleListener(di.value); }
                }
            } else { if (hasEverConnected) listenersAttached = false; }
        });
    }

    window.realtimeSync = {
        initialize: initializeRealtimeSync,
        setupScheduleListener: setupScheduleListener,
        detachListeners: function() {
            if (!window.hasDatabase || !window.hasDatabase()) return;
            database.ref('teamData').off('value');
            database.ref('availabilityOverrides').off('value');
            database.ref('memberAvailabilitySettings').off('value');
            database.ref('leaveSettings').off('value');
            database.ref('.info/connected').off('value');
            if (currentScheduleListener) database.ref('schedules/' + currentScheduleListener).off('value');
            listenersAttached = false; currentScheduleListener = null;
        }
    };

    function tryInitialize() {
        if (window.hasDatabase && window.hasDatabase()) { initializeRealtimeSync(); setupConnectionMonitor(); }
        else setTimeout(tryInitialize, 500);
    }
    setTimeout(tryInitialize, 1000);

    console.log('%cFirebase Real-Time Sync Loaded', 'color:#10b981;font-weight:bold;font-size:14px');
    console.log('%c  Schedules+tasks sync instantly on all devices', 'color:#3b82f6;font-size:12px');
})();

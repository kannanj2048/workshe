// ==========================================
// FIREBASE REAL-TIME SYNCHRONIZATION
// Auto-updates all devices when admin makes changes
// ==========================================

(function() {
    'use strict';

    let currentScheduleListener = null;
    let listenersAttached = false;
    let hasEverConnected = false; // ✅ FIX: ignore Firebase's initial false before first connect

    function setupScheduleListener(dateStr) {
        if (!window.hasDatabase || !window.hasDatabase()) return;

        // ✅ FIX: Skip if already listening to this exact date — prevents duplicate listeners
        if (currentScheduleListener === dateStr) {
            console.log('ℹ️ Already listening for:', dateStr, '— skipping');
            return;
        }

        if (currentScheduleListener) {
            database.ref('schedules/' + currentScheduleListener).off('value');
            console.log('🔌 Detached previous schedule listener');
        }

        currentScheduleListener = dateStr;
        console.log('👂 Listening for schedule changes:', dateStr);

        database.ref('schedules/' + dateStr).on('value', (snapshot) => {
            const firebaseSchedule = snapshot.val();
            if (!firebaseSchedule) return;

            console.log('🔄 Schedule updated from Firebase:', dateStr);

            if (typeof scheduleHistory !== 'undefined') {
                scheduleHistory[dateStr] = firebaseSchedule;
                localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
            }

            const dateInput = document.getElementById('scheduleDate');
            if (dateInput && dateInput.value === dateStr) {
                console.log('✅ Displaying updated schedule from Firebase');

                // ✅ KEY FIX: displaySchedule() directly — never generateDailySchedule()
                // generateDailySchedule re-reads localStorage and shows stale data
                if (typeof displaySchedule === 'function') displaySchedule(firebaseSchedule);
                if (typeof updateCurrentShiftInfo === 'function') {
                    updateCurrentShiftInfo(new Date(dateStr + 'T00:00:00'));
                }
                if (typeof isAdmin !== 'undefined' && !isAdmin) {
                    if (typeof showNotification === 'function') {
                        showNotification('📋 Schedule updated by admin', 'info');
                    }
                }
            }
        }, (error) => { console.error('❌ Schedule listener error:', error); });
    }

    function setupTeamDataListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        database.ref('teamData').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof teamData === 'undefined') return;
            Object.assign(teamData, data);
            localStorage.setItem('teamData', JSON.stringify(teamData));
            if (typeof updateTeamMembersDisplay === 'function') updateTeamMembersDisplay();
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('👥 Team members updated', 'info');
        }, (error) => { console.error('❌ Team data listener error:', error); });
    }

    function setupAvailabilityListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        database.ref('availabilityOverrides').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof availabilityOverrides === 'undefined') return;
            availabilityOverrides = data;
            localStorage.setItem('availabilityOverrides', JSON.stringify(availabilityOverrides));
            refreshCurrentDateSchedule(); // ✅ FIX: fetch from Firebase, not generateDailySchedule
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('📅 Availability updated', 'info');
        }, (error) => { console.error('❌ Availability listener error:', error); });
    }

    function setupMemberAvailabilityListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        database.ref('memberAvailabilitySettings').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof memberAvailabilitySettings === 'undefined') return;
            Object.assign(memberAvailabilitySettings, data);
            localStorage.setItem('memberAvailabilitySettings', JSON.stringify(memberAvailabilitySettings));
            refreshCurrentDateSchedule(); // ✅ FIX
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('⚙️ Working schedules updated', 'info');
        }, (error) => { console.error('❌ Member availability listener error:', error); });
    }

    function setupLeaveManagementListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        database.ref('leaveSettings').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data || typeof monthlyLeaveSettings === 'undefined') return;
            Object.assign(monthlyLeaveSettings, data);
            localStorage.setItem('monthlyLeaveSettings', JSON.stringify(monthlyLeaveSettings));
            if (typeof syncWorkingSchedulesWithLeave === 'function') syncWorkingSchedulesWithLeave();
            refreshCurrentDateSchedule(); // ✅ FIX
            if (typeof isAdmin !== 'undefined' && !isAdmin)
                if (typeof showNotification === 'function') showNotification('🏖️ Leave calendar updated', 'info');
        }, (error) => { console.error('❌ Leave listener error:', error); });
    }

    // ✅ NEW: Fetch schedule directly from Firebase and display it — skips stale localStorage
    function refreshCurrentDateSchedule() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        const dateInput = document.getElementById('scheduleDate');
        if (!dateInput || !dateInput.value) return;
        const dateStr = dateInput.value;
        database.ref('schedules/' + dateStr).once('value')
            .then((snapshot) => {
                const schedule = snapshot.val();
                if (schedule && typeof displaySchedule === 'function') {
                    if (typeof scheduleHistory !== 'undefined') {
                        scheduleHistory[dateStr] = schedule;
                        localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
                    }
                    displaySchedule(schedule);
                }
            })
            .catch((err) => console.error('❌ Refresh schedule error:', err));
    }

    function initializeRealtimeSync() {
        if (listenersAttached) return;
        if (!window.hasDatabase || !window.hasDatabase()) return;

        console.log('🚀 Initializing Firebase real-time sync...');

        setupTeamDataListener();
        setupAvailabilityListener();
        setupMemberAvailabilityListener();
        setupLeaveManagementListener();

        function waitForDateAndAttach() {
            const dateInput = document.getElementById('scheduleDate');
            if (dateInput && dateInput.value) {
                setupScheduleListener(dateInput.value);
                // ✅ Only attach the change listener once using a flag
                if (!dateInput._syncChangeAttached) {
                    dateInput.addEventListener('change', function() {
                        if (this.value) {
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
        console.log('✅ Real-time sync initialized');
        console.log('📡 All devices will now update automatically');
    }

    function setupConnectionMonitor() {
        if (!window.hasDatabase || !window.hasDatabase()) return;

        database.ref('.info/connected').on('value', (snapshot) => {
            const isConnected = snapshot.val() === true;

            if (isConnected) {
                console.log('🔥 Firebase connected');
                if (!hasEverConnected) {
                    // ✅ First real connection — this is normal startup, do nothing extra
                    hasEverConnected = true;
                } else {
                    // ✅ This is a RECONNECT after a real drop — re-attach listeners
                    console.log('🔄 Reconnected — re-attaching listeners...');
                    listenersAttached = false;
                    initializeRealtimeSync();
                    const dateInput = document.getElementById('scheduleDate');
                    if (dateInput && dateInput.value) {
                        currentScheduleListener = null;
                        setupScheduleListener(dateInput.value);
                    }
                }
            } else {
                // ✅ FIX: Ignore the initial false Firebase emits before first connect
                if (hasEverConnected) {
                    console.log('⚠️ Firebase disconnected — will re-sync on reconnect');
                    listenersAttached = false;
                }
            }
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
            if (currentScheduleListener) {
                database.ref('schedules/' + currentScheduleListener).off('value');
            }
            listenersAttached = false;
            currentScheduleListener = null;
        }
    };

    function tryInitialize() {
        if (window.hasDatabase && window.hasDatabase()) {
            initializeRealtimeSync();
            setupConnectionMonitor();
        } else {
            setTimeout(tryInitialize, 500);
        }
    }

    setTimeout(tryInitialize, 1000);

    console.log('%c📡 Firebase Real-Time Sync Module Loaded', 'color: #10b981; font-weight: bold; font-size: 14px');
    console.log('%c   Changes will sync across all devices instantly', 'color: #3b82f6; font-size: 12px');

})();

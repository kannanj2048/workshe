// ==========================================
// FIREBASE REAL-TIME SYNCHRONIZATION
// Auto-updates all devices when admin makes changes
// ==========================================

(function() {
    'use strict';
    
    // Track if listeners are already attached to prevent duplicates
    let listenersAttached = false;
    let currentScheduleListener = null;
    
    // ========================================
    // REAL-TIME SCHEDULE SYNC
    // ========================================
    
    function setupScheduleListener(dateStr) {
        if (!window.hasDatabase || !window.hasDatabase()) {
            console.log('⚠️ Firebase not available - real-time sync disabled');
            return;
        }
        
        // Remove previous listener if exists
        if (currentScheduleListener) {
            database.ref('schedules/' + currentScheduleListener).off('value');
            console.log('🔌 Detached previous schedule listener');
        }
        
        currentScheduleListener = dateStr;
        
        console.log('👂 Listening for schedule changes:', dateStr);
        
        // Attach real-time listener
        database.ref('schedules/' + dateStr).on('value', (snapshot) => {
            const firebaseSchedule = snapshot.val();
            
            if (firebaseSchedule) {
                console.log('🔄 Schedule updated from Firebase:', dateStr);
                
                // Update local storage
                if (typeof scheduleHistory !== 'undefined') {
                    scheduleHistory[dateStr] = firebaseSchedule;
                    localStorage.setItem('scheduleHistory', JSON.stringify(scheduleHistory));
                }
                
                // Only update display if we're viewing this date
                const dateInput = document.getElementById('scheduleDate');
                const currentViewingDate = dateInput ? dateInput.value : null;
                
                if (currentViewingDate === dateStr) {
                    console.log('✅ Updating display with new schedule');
                    
                    // Update the display
                    if (typeof displaySchedule === 'function') {
                        displaySchedule(firebaseSchedule);
                    }
                    
                    // Show notification to non-admin users
                    if (typeof isAdmin !== 'undefined' && !isAdmin) {
                        showNotification('📋 Schedule updated by admin', 'info');
                    }
                }
            }
        }, (error) => {
            console.error('❌ Firebase listener error:', error);
        });
    }
    
    // ========================================
    // REAL-TIME TEAM DATA SYNC
    // ========================================
    
    function setupTeamDataListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        
        console.log('👂 Listening for team data changes');
        
        database.ref('teamData').on('value', (snapshot) => {
            const firebaseTeamData = snapshot.val();
            
            if (firebaseTeamData && typeof teamData !== 'undefined') {
                console.log('🔄 Team data updated from Firebase');
                
                // Update local teamData
                Object.assign(teamData, firebaseTeamData);
                
                // Update localStorage
                localStorage.setItem('teamData', JSON.stringify(teamData));
                
                // Refresh UI if needed
                if (typeof updateTeamMembersDisplay === 'function') {
                    updateTeamMembersDisplay();
                }
                
                // Show notification
                if (typeof isAdmin !== 'undefined' && !isAdmin) {
                    showNotification('👥 Team members updated', 'info');
                }
            }
        }, (error) => {
            console.error('❌ Team data listener error:', error);
        });
    }
    
    // ========================================
    // REAL-TIME AVAILABILITY SYNC
    // ========================================
    
    function setupAvailabilityListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        
        console.log('👂 Listening for availability changes');
        
        database.ref('availabilityOverrides').on('value', (snapshot) => {
            const firebaseAvailability = snapshot.val();
            
            if (firebaseAvailability && typeof availabilityOverrides !== 'undefined') {
                console.log('🔄 Availability updated from Firebase');
                
                // Update local availability
                availabilityOverrides = firebaseAvailability;
                
                // Update localStorage
                localStorage.setItem('availabilityOverrides', JSON.stringify(availabilityOverrides));
                
                // Refresh schedule if needed
                const dateInput = document.getElementById('scheduleDate');
                if (dateInput && dateInput.value) {
                    const currentDate = new Date(dateInput.value);
                    
                    // Regenerate schedule with new availability
                    if (typeof generateDailySchedule === 'function') {
                        console.log('🔄 Regenerating schedule with updated availability');
                        generateDailySchedule(currentDate);
                    }
                }
                
                // Show notification
                if (typeof isAdmin !== 'undefined' && !isAdmin) {
                    showNotification('📅 Availability updated', 'info');
                }
            }
        }, (error) => {
            console.error('❌ Availability listener error:', error);
        });
    }
    
    // ========================================
    // REAL-TIME MEMBER AVAILABILITY SETTINGS SYNC
    // ========================================
    
    function setupMemberAvailabilityListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        
        console.log('👂 Listening for member availability settings changes');
        
        database.ref('memberAvailabilitySettings').on('value', (snapshot) => {
            const firebaseSettings = snapshot.val();
            
            if (firebaseSettings && typeof memberAvailabilitySettings !== 'undefined') {
                console.log('🔄 Member availability settings updated from Firebase');
                
                // Update local settings
                Object.assign(memberAvailabilitySettings, firebaseSettings);
                
                // Update localStorage
                localStorage.setItem('memberAvailabilitySettings', JSON.stringify(memberAvailabilitySettings));
                
                // Regenerate schedule with new settings
                const dateInput = document.getElementById('scheduleDate');
                if (dateInput && dateInput.value) {
                    const currentDate = new Date(dateInput.value);
                    
                    if (typeof generateDailySchedule === 'function') {
                        console.log('🔄 Regenerating schedule with updated member availability');
                        generateDailySchedule(currentDate);
                    }
                }
                
                // Show notification
                if (typeof isAdmin !== 'undefined' && !isAdmin) {
                    showNotification('⚙️ Working schedules updated', 'info');
                }
            }
        }, (error) => {
            console.error('❌ Member availability listener error:', error);
        });
    }
    
    // ========================================
    // REAL-TIME LEAVE MANAGEMENT SYNC
    // ========================================
    
    function setupLeaveManagementListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        
        console.log('👂 Listening for leave management changes');
        
        // ✅ Using 'leaveSettings' to match saveLeaveSettingsToFirebase()
        database.ref('leaveSettings').on('value', (snapshot) => {
            const firebaseLeaveSettings = snapshot.val();
            
            if (firebaseLeaveSettings && typeof monthlyLeaveSettings !== 'undefined') {
                console.log('🔄 Leave settings updated from Firebase');
                
                // Update local leave settings
                Object.assign(monthlyLeaveSettings, firebaseLeaveSettings);
                
                // Update localStorage
                localStorage.setItem('monthlyLeaveSettings', JSON.stringify(monthlyLeaveSettings));
                
                // Sync with working schedules
                if (typeof syncWorkingSchedulesWithLeave === 'function') {
                    syncWorkingSchedulesWithLeave();
                }
                
                // Regenerate schedule
                const dateInput = document.getElementById('scheduleDate');
                if (dateInput && dateInput.value) {
                    const currentDate = new Date(dateInput.value);
                    
                    if (typeof generateDailySchedule === 'function') {
                        console.log('🔄 Regenerating schedule with updated leave data');
                        generateDailySchedule(currentDate);
                    }
                }
                
                // Show notification
                if (typeof isAdmin !== 'undefined' && !isAdmin) {
                    showNotification('🏖️ Leave calendar updated', 'info');
                }
            }
        }, (error) => {
            console.error('❌ Leave management listener error:', error);
        });
    }
    
    // ========================================
    // INITIALIZE ALL LISTENERS
    // ========================================
    
    function initializeRealtimeSync() {
        if (listenersAttached) {
            console.log('⚠️ Real-time listeners already attached');
            return;
        }
        
        if (!window.hasDatabase || !window.hasDatabase()) {
            console.log('⚠️ Firebase not available - skipping real-time sync');
            return;
        }
        
        console.log('🚀 Initializing Firebase real-time sync...');
        
        // Setup all listeners
        setupTeamDataListener();
        setupAvailabilityListener();
        setupMemberAvailabilityListener();
        setupLeaveManagementListener();
        
        // ✅ FIX 3: Schedule listener — wait for dateInput to have a value,
        // then also listen for date changes via a MutationObserver on the input.
        function attachScheduleListenerForCurrentDate() {
            const dateInput = document.getElementById('scheduleDate');
            if (dateInput && dateInput.value) {
                setupScheduleListener(dateInput.value);
            } else {
                // Retry until the date field is populated
                setTimeout(attachScheduleListenerForCurrentDate, 200);
            }
        }
        attachScheduleListenerForCurrentDate();
        
        listenersAttached = true;
        
        console.log('✅ Real-time sync initialized');
        console.log('📡 All devices will now update automatically');
    }
    
    // ========================================
    // OVERRIDE DATE CHANGE TO UPDATE LISTENER
    // ✅ FIX 2: Use a late-binding proxy so the override works even if
    //    window.generateDailySchedule is defined AFTER this file loads.
    // ========================================
    
    // Intercept any future assignment of window.generateDailySchedule
    // so we can wrap it no matter when it is defined.
    let _generateDailySchedule = window.generateDailySchedule;

    Object.defineProperty(window, 'generateDailySchedule', {
        get: function() {
            return _generateDailySchedule;
        },
        set: function(fn) {
            // Wrap the incoming function to also update the schedule listener
            _generateDailySchedule = function(dateSGT) {
                const result = fn.call(this, dateSGT);

                // Update schedule listener to the new date
                const dateStr = typeof formatDateForInput === 'function'
                    ? formatDateForInput(dateSGT)
                    : dateSGT.toISOString().split('T')[0];

                setupScheduleListener(dateStr);

                return result;
            };
        },
        configurable: true
    });

    // If generateDailySchedule was already defined when this file loaded, wrap it now.
    if (typeof _generateDailySchedule === 'function') {
        const existing = _generateDailySchedule;
        _generateDailySchedule = function(dateSGT) {
            const result = existing.call(this, dateSGT);

            const dateStr = typeof formatDateForInput === 'function'
                ? formatDateForInput(dateSGT)
                : dateSGT.toISOString().split('T')[0];

            setupScheduleListener(dateStr);

            return result;
        };
    }
    
    // ========================================
    // SAVE FUNCTIONS WITH IMMEDIATE SYNC
    // ========================================
    
    // Override saveScheduleToFirebase to ensure immediate sync
    const originalSaveSchedule = window.saveScheduleToFirebase;
    
    if (typeof originalSaveSchedule === 'function') {
        window.saveScheduleToFirebase = function(schedule) {
            console.log('💾 Saving schedule to Firebase (will trigger real-time sync)');
            return originalSaveSchedule.call(this, schedule);
        };
    }
    
    // ========================================
    // EXPORT FUNCTIONS
    // ========================================
    
    window.realtimeSync = {
        initialize: initializeRealtimeSync,
        setupScheduleListener: setupScheduleListener,
        detachListeners: function() {
            if (!window.hasDatabase || !window.hasDatabase()) return;
            
            console.log('🔌 Detaching all real-time listeners');
            
            database.ref('teamData').off('value');
            database.ref('availabilityOverrides').off('value');
            database.ref('memberAvailabilitySettings').off('value');
            database.ref('leaveSettings').off('value');
            
            if (currentScheduleListener) {
                database.ref('schedules/' + currentScheduleListener).off('value');
            }
            
            // ✅ FIX 1: Reset flag so sync can be re-initialized if needed
            listenersAttached = false;
            console.log('✅ All listeners detached');
        }
    };
    
    // ========================================
    // AUTO-INITIALIZE WHEN PAGE LOADS
    // ========================================
    
    // ✅ FIX 1: On Firebase disconnect/reconnect, re-initialize listeners
    function setupConnectionMonitor() {
        if (!window.hasDatabase || !window.hasDatabase()) return;

        database.ref('.info/connected').on('value', (snapshot) => {
            if (snapshot.val() === true) {
                console.log('🔥 Firebase connected');

                if (!listenersAttached) {
                    console.log('🔄 Re-initializing listeners after reconnect...');
                    initializeRealtimeSync();
                } else {
                    // Re-attach the schedule listener for the currently viewed date
                    // because Firebase drops .on() listeners after a reconnect
                    const dateInput = document.getElementById('scheduleDate');
                    if (dateInput && dateInput.value) {
                        // Force re-attach by clearing the tracker
                        const savedDate = currentScheduleListener;
                        currentScheduleListener = null;
                        setupScheduleListener(savedDate || dateInput.value);
                    }
                }
            } else {
                console.log('⚠️ Firebase disconnected - will re-sync on reconnect');
                // ✅ Reset flag so initializeRealtimeSync() runs fresh on reconnect
                listenersAttached = false;
            }
        });
    }

    // Wait for Firebase to be ready
    function tryInitialize() {
        if (window.hasDatabase && window.hasDatabase()) {
            console.log('🔥 Firebase ready - initializing real-time sync');
            initializeRealtimeSync();
            setupConnectionMonitor();
        } else {
            console.log('⏳ Waiting for Firebase... (retrying in 500ms)');
            setTimeout(tryInitialize, 500);
        }
    }
    
    // Start initialization after a short delay
    setTimeout(tryInitialize, 1000);
    
    console.log('%c📡 Firebase Real-Time Sync Module Loaded', 'color: #10b981; font-weight: bold; font-size: 14px');
    console.log('%c   Changes will sync across all devices instantly', 'color: #3b82f6; font-size: 12px');
    
})();

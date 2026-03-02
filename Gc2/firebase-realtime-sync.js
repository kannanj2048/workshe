// ==========================================
// FIREBASE REAL-TIME SYNCHRONIZATION
// Auto-updates all devices when admin makes changes
// ==========================================

(function() {
    'use strict';
    
    // Track if listeners are already attached to prevent duplicates
    let listenersAttached = false;
    let currentScheduleListener = null;

    // ✅ FIX 1: Track whether the initial Firebase "on value" fire has been processed.
    // Firebase always fires once immediately on attach. We use this flag to skip
    // that first fire so we don't overwrite the schedule the admin just saved.
    let scheduleListenerInitialFired = false;
    
    // ========================================
    // REAL-TIME SCHEDULE SYNC
    // ========================================
    
    function setupScheduleListener(dateStr) {
        if (!window.hasDatabase || !window.hasDatabase()) {
            console.log('⚠️ Firebase not available - real-time sync disabled');
            return;
        }

        // ✅ FIX 2: Don't skip re-attaching if the date changes.
        // Old code checked listenersAttached globally and returned early,
        // which blocked the listener from moving to the new date.
        if (currentScheduleListener === dateStr) {
            // Already listening to this exact date — nothing to do
            return;
        }
        
        // Remove previous listener if exists
        if (currentScheduleListener) {
            database.ref('schedules/' + currentScheduleListener).off('value');
            console.log('🔌 Detached previous schedule listener for:', currentScheduleListener);
        }
        
        currentScheduleListener = dateStr;
        scheduleListenerInitialFired = false; // ✅ Reset flag for the new date
        
        console.log('👂 Listening for schedule changes:', dateStr);
        
        // Attach real-time listener
        database.ref('schedules/' + dateStr).on('value', (snapshot) => {

            // ✅ FIX 3: Skip the very first immediate fire.
            // Firebase always fires on attach even if nothing changed.
            // This initial fire would overwrite whatever generateDailySchedule just displayed.
            if (!scheduleListenerInitialFired) {
                scheduleListenerInitialFired = true;
                console.log('🔔 Schedule listener attached for:', dateStr, '(initial fire skipped)');
                return;
            }

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
                    console.log('✅ Updating display with new schedule data');
                    
                    // ✅ FIX 4: Call displaySchedule for the main schedule table
                    if (typeof displaySchedule === 'function') {
                        displaySchedule(firebaseSchedule);
                    }

                    // ✅ FIX 5: Also re-render the additional tasks section.
                    // The tasks are stored inside the schedule object (firebaseSchedule.tasks
                    // or firebaseSchedule.additionalTasks). displaySchedule should handle this,
                    // but if your app has a separate render function for tasks, call it here too.
                    if (typeof displayAdditionalTasks === 'function' && firebaseSchedule.additionalTasks) {
                        displayAdditionalTasks(firebaseSchedule.additionalTasks);
                    }

                    // Re-apply drag order for admin after display update
                    if (typeof isAdmin !== 'undefined' && isAdmin) {
                        if (typeof loadAndApplyPlatformOrder === 'function') {
                            setTimeout(loadAndApplyPlatformOrder, 50);
                        }
                        if (typeof loadAndApplyTaskOrder === 'function') {
                            setTimeout(loadAndApplyTaskOrder, 50);
                        }
                        if (typeof initDragAndDrop === 'function') {
                            setTimeout(initDragAndDrop, 100);
                        }
                    }
                    
                    // Show notification to non-admin users
                    if (typeof isAdmin !== 'undefined' && !isAdmin) {
                        if (typeof showNotification === 'function') {
                            showNotification('📋 Schedule updated by admin', 'info');
                        }
                    }
                }
            }
        }, (error) => {
            console.error('❌ Firebase schedule listener error:', error);
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
        
        // ✅ FIX 6: Setup schedule listener for the currently displayed date.
        // Also hook the date input change so the listener moves when the user
        // navigates to a different date.
        const dateInput = document.getElementById('scheduleDate');
        if (dateInput) {
            if (dateInput.value) {
                setupScheduleListener(dateInput.value);
            }

            // ✅ When the admin/user changes the date, re-attach the listener
            // to the new date so syncing continues to work.
            dateInput.addEventListener('change', function() {
                if (this.value) {
                    setupScheduleListener(this.value);
                }
            });
        }
        
        listenersAttached = true;
        
        console.log('✅ Real-time sync initialized');
        console.log('📡 All devices will now update automatically');
    }
    
    // ========================================
    // ✅ FIX 7: Hook into generateDailySchedule AFTER it is defined.
    // The old code captured window.generateDailySchedule at parse time,
    // which was undefined because firebase-config.js defines it later.
    // We use a MutationObserver-style poll to wait until it is ready.
    // ========================================

    function hookGenerateDailySchedule() {
        const original = window.generateDailySchedule;
        if (typeof original !== 'function') return false;

        window.generateDailySchedule = function(dateSGT) {
            // Call the original function first
            const result = original.call(this, dateSGT);

            // After generating, update the schedule listener to the new date
            const dateStr = typeof formatDateForInput === 'function'
                ? formatDateForInput(dateSGT)
                : dateSGT.toISOString().split('T')[0];

            // ✅ Use a small delay so the schedule is fully saved to Firebase
            // before we reset the "initial fire" flag on the new listener.
            setTimeout(() => {
                setupScheduleListener(dateStr);
            }, 300);

            return result;
        };

        console.log('✅ generateDailySchedule hooked for real-time sync');
        return true;
    }

    // Poll until generateDailySchedule is available, then hook it
    function waitAndHook() {
        if (!hookGenerateDailySchedule()) {
            setTimeout(waitAndHook, 100);
        }
    }
    waitAndHook();

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
            
            listenersAttached = false;
            currentScheduleListener = null;
            console.log('✅ All listeners detached');
        }
    };
    
    // ========================================
    // AUTO-INITIALIZE WHEN PAGE LOADS
    // ========================================
    
    // Wait for Firebase to be ready
    function tryInitialize() {
        if (window.hasDatabase && window.hasDatabase()) {
            console.log('🔥 Firebase ready - initializing real-time sync');
            initializeRealtimeSync();
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

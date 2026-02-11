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
    // REAL-TIME PASSWORD SYNC
    // ========================================
    
    function setupPasswordListener() {
        if (!window.hasDatabase || !window.hasDatabase()) return;
        
        console.log('👂 Listening for password changes');
        
        // ✅ FIXED: Safely get password key with fallback detection
        function getPasswordKey() {
            // First: Try window.CURRENT_GROUP (set in script.js)
            if (typeof window.CURRENT_GROUP !== 'undefined' && window.CURRENT_GROUP) {
                return `passwords_${window.CURRENT_GROUP}`;
            }
            
            // Second: Try to detect from Firebase URL
            if (typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL) {
                const url = firebaseConfig.databaseURL;
                const match = url.match(/workschedulemanager-gc(\d+)/i);
                if (match) {
                    const group = `gc${match[1]}`;
                    console.log(`🔍 Detected group from Firebase URL: ${group}`);
                    return `passwords_${group}`;
                }
                
                // Check for direct mentions in URL
                if (url.includes('gc1')) return 'passwords_gc1';
                if (url.includes('gc2')) return 'passwords_gc2';
                if (url.includes('gc3')) return 'passwords_gc3';
            }
            
            // Third: Try to detect from page
            const pageTitle = document.title || '';
            const pageURL = window.location.pathname || '';
            
            if (pageTitle.includes('G1') || pageURL.includes('group1') || pageURL.includes('gc1')) {
                return 'passwords_gc1';
            }
            if (pageTitle.includes('G2') || pageURL.includes('group2') || pageURL.includes('gc2')) {
                return 'passwords_gc2';
            }
            if (pageTitle.includes('G3') || pageURL.includes('group3') || pageURL.includes('gc3')) {
                return 'passwords_gc3';
            }
            
            // Final fallback
            console.warn('⚠️ Could not detect group, defaulting to gc1');
            return 'passwords_gc1';
        }
        
        const passwordKey = getPasswordKey();
        console.log('🔑 Password Firebase key:', passwordKey);
        
        database.ref(passwordKey).on('value', (snapshot) => {
            const firebasePasswords = snapshot.val();
            
            if (firebasePasswords && typeof userCredentials !== 'undefined' && userCredentials !== null) {
                console.log('🔄 Passwords updated from Firebase');
                
                // Update local credentials
                Object.assign(userCredentials, firebasePasswords);
                
                // Update localStorage with correct group key
                const group = window.CURRENT_GROUP || passwordKey.replace('passwords_', '');
                const storageKey = `userCredentials_${group}`;
                localStorage.setItem(storageKey, JSON.stringify(userCredentials));
                
                // Show notification to non-admin users
                if (typeof isAdmin !== 'undefined' && !isAdmin) {
                    showNotification('🔐 Password settings updated', 'info');
                }
            }
        }, (error) => {
            console.error('❌ Password listener error:', error);
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
        setupPasswordListener();  // ✅ Added password listener
        
        // Setup schedule listener for current date
        const dateInput = document.getElementById('scheduleDate');
        if (dateInput && dateInput.value) {
            setupScheduleListener(dateInput.value);
        }
        
        listenersAttached = true;
        
        console.log('✅ Real-time sync initialized');
        console.log('📡 All devices will now update automatically');
    }
    
    // ========================================
    // OVERRIDE DATE CHANGE TO UPDATE LISTENER
    // ========================================
    
    // Store original generateDailySchedule
    const originalGenerateDailySchedule = window.generateDailySchedule;
    
    if (typeof originalGenerateDailySchedule === 'function') {
        window.generateDailySchedule = function(dateSGT) {
            // Call original function
            const result = originalGenerateDailySchedule.call(this, dateSGT);
            
            // Update schedule listener to new date
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
            database.ref('leaveSettings').off('value');  // ✅ Corrected path
            
            // ✅ Detach password listener
            if (typeof window.CURRENT_GROUP !== 'undefined' && window.CURRENT_GROUP) {
                database.ref(`passwords_${window.CURRENT_GROUP}`).off('value');
            } else {
                // Fallback: try to detect and detach
                const url = firebaseConfig?.databaseURL || '';
                const match = url.match(/workschedulemanager-gc(\d+)/i);
                if (match) {
                    database.ref(`passwords_gc${match[1]}`).off('value');
                } else {
                    database.ref('passwords_gc1').off('value');
                }
            }
            
            if (currentScheduleListener) {
                database.ref('schedules/' + currentScheduleListener).off('value');
            }
            
            listenersAttached = false;
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

// ========================================
// GROUP-SPECIFIC STORAGE SYSTEM
// Fixes localStorage sharing issue between groups
// ========================================

(function() {
    'use strict';
    
    // ========================================
    // AUTO-DETECT CURRENT GROUP
    // ========================================
    function detectCurrentGroup() {
        // Method 1: Check Firebase config (most reliable)
        if (typeof firebaseConfig !== 'undefined' && firebaseConfig.databaseURL) {
            const url = firebaseConfig.databaseURL;
            const match = url.match(/gc(\d+)/i);
            if (match) {
                return 'gc' + match[1];
            }
        }
        
        // Method 2: Check page title
        const title = document.title || '';
        const titleMatch = title.match(/G(\d+)|Group\s*(\d+)/i);
        if (titleMatch) {
            return 'gc' + (titleMatch[1] || titleMatch[2]);
        }
        
        // Method 3: Check URL path
        const path = window.location.pathname || '';
        const pathMatch = path.match(/group(\d+)|gc(\d+)/i);
        if (pathMatch) {
            return 'gc' + (pathMatch[1] || pathMatch[2]);
        }
        
        // Method 4: Check URL search params
        const params = new URLSearchParams(window.location.search);
        if (params.has('group')) {
            return 'gc' + params.get('group');
        }
        
        // Fallback
        console.warn('⚠️ Could not detect group, defaulting to gc1');
        return 'gc1';
    }
    
    // Detect and store group ID
    window.CURRENT_GROUP_ID = detectCurrentGroup();
    console.log(`🎯 Detected Group: ${window.CURRENT_GROUP_ID}`);
    
    // ========================================
    // GROUP-SPECIFIC STORAGE WRAPPER
    // ========================================
    
    const originalLocalStorage = {
        getItem: localStorage.getItem.bind(localStorage),
        setItem: localStorage.setItem.bind(localStorage),
        removeItem: localStorage.removeItem.bind(localStorage),
        clear: localStorage.clear.bind(localStorage),
        key: localStorage.key.bind(localStorage)
    };
    
    // Keys that should be GROUP-SPECIFIC
    const GROUP_SPECIFIC_KEYS = [
        'currentUser',           // Admin/Guest login status
        'userCredentials',       // Passwords
        'isAdmin',              // Admin flag
        'teamData',             // Team members
        'scheduleHistory',      // Generated schedules
        'availabilityOverrides', // Availability settings
        'assignmentHistory',    // Assignment tracking
        'shiftSchedule',        // Shift times
        'memberAvailabilitySettings', // Member schedules
        'monthlyLeaveSettings', // Leave management
        'learnedPatterns',      // AI learning data
        'teamPOCNames',         // POC names (legacy)
        'workingSchedules',     // Working schedules
        'leaveRequests',        // Leave requests
        'customPlatformOrder',  // Platform order
        'customTaskOrder'       // Task order
    ];
    
    // Keys that should be GLOBAL (shared across groups)
    const GLOBAL_KEYS = [
        'theme',                // UI theme preference
        'language',            // Language preference
        'lastVisitedGroup'     // Navigation helper
    ];
    
    // Helper: Add group prefix to key if needed
    function getStorageKey(key) {
        // Check if key already has group prefix
        if (key.startsWith('gc1_') || key.startsWith('gc2_') || key.startsWith('gc3_')) {
            return key;
        }
        
        // Check if this key should be group-specific
        const shouldBeGroupSpecific = GROUP_SPECIFIC_KEYS.some(pattern => {
            if (typeof pattern === 'string') {
                return key === pattern || key.startsWith(pattern + '_');
            }
            return false;
        });
        
        if (shouldBeGroupSpecific) {
            return `${window.CURRENT_GROUP_ID}_${key}`;
        }
        
        // Global key - no prefix
        return key;
    }
    
    // Override localStorage methods
    Storage.prototype.getItem = function(key) {
        const storageKey = getStorageKey(key);
        return originalLocalStorage.getItem(storageKey);
    };
    
    Storage.prototype.setItem = function(key, value) {
        const storageKey = getStorageKey(key);
        return originalLocalStorage.setItem(storageKey, value);
    };
    
    Storage.prototype.removeItem = function(key) {
        const storageKey = getStorageKey(key);
        return originalLocalStorage.removeItem(storageKey);
    };
    
    // Override key() method to return unprefixed keys
    Storage.prototype.key = function(index) {
        const fullKey = originalLocalStorage.key(index);
        if (fullKey && fullKey.startsWith(window.CURRENT_GROUP_ID + '_')) {
            return fullKey.substring(window.CURRENT_GROUP_ID.length + 1);
        }
        return fullKey;
    };
    
    // Override clear() to only clear current group's data
    Storage.prototype.clear = function() {
        const prefix = window.CURRENT_GROUP_ID + '_';
        const keysToRemove = [];
        
        for (let i = 0; i < originalLocalStorage.length; i++) {
            const key = originalLocalStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => originalLocalStorage.removeItem(key));
        console.log(`🗑️ Cleared ${keysToRemove.length} items for ${window.CURRENT_GROUP_ID}`);
    };
    
    // ========================================
    // MIGRATION HELPER
    // ========================================
    
    function migrateOldDataToGroup() {
        console.log('🔄 Checking for data migration...');
        
        let migratedCount = 0;
        
        GROUP_SPECIFIC_KEYS.forEach(key => {
            // Check if old key exists (without group prefix)
            const oldValue = originalLocalStorage.getItem(key);
            const newKey = `${window.CURRENT_GROUP_ID}_${key}`;
            const newValue = originalLocalStorage.getItem(newKey);
            
            // If old data exists but no new data, migrate it
            if (oldValue && !newValue) {
                originalLocalStorage.setItem(newKey, oldValue);
                migratedCount++;
                console.log(`✅ Migrated: ${key} → ${newKey}`);
            }
        });
        
        if (migratedCount > 0) {
            console.log(`✅ Migration complete: ${migratedCount} items migrated to ${window.CURRENT_GROUP_ID}`);
        } else {
            console.log('ℹ️ No data migration needed');
        }
    }
    
    // Run migration on first load
    migrateOldDataToGroup();
    
    // ========================================
    // DEBUG UTILITIES
    // ========================================
    
    window.showGroupStorage = function() {
        console.log(`\n📊 Storage for ${window.CURRENT_GROUP_ID}:`);
        console.log('='.repeat(50));
        
        const prefix = window.CURRENT_GROUP_ID + '_';
        const groupData = {};
        
        for (let i = 0; i < originalLocalStorage.length; i++) {
            const key = originalLocalStorage.key(i);
            if (key && key.startsWith(prefix)) {
                const cleanKey = key.substring(prefix.length);
                try {
                    groupData[cleanKey] = JSON.parse(originalLocalStorage.getItem(key));
                } catch (e) {
                    groupData[cleanKey] = originalLocalStorage.getItem(key);
                }
            }
        }
        
        console.table(groupData);
        console.log('='.repeat(50));
    };
    
    window.showAllGroupsStorage = function() {
        console.log('\n📊 Storage for ALL Groups:');
        console.log('='.repeat(50));
        
        ['gc1', 'gc2', 'gc3'].forEach(group => {
            const prefix = group + '_';
            const groupData = {};
            
            for (let i = 0; i < originalLocalStorage.length; i++) {
                const key = originalLocalStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    const cleanKey = key.substring(prefix.length);
                    groupData[cleanKey] = originalLocalStorage.getItem(key)?.substring(0, 50) + '...';
                }
            }
            
            if (Object.keys(groupData).length > 0) {
                console.log(`\n${group}:`);
                console.table(groupData);
            }
        });
        
        console.log('='.repeat(50));
    };
    
    window.clearGroupStorage = function(groupId) {
        const targetGroup = groupId || window.CURRENT_GROUP_ID;
        const prefix = targetGroup + '_';
        const keysToRemove = [];
        
        for (let i = 0; i < originalLocalStorage.length; i++) {
            const key = originalLocalStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }
        
        if (confirm(`Clear all data for ${targetGroup}? This will remove ${keysToRemove.length} items.`)) {
            keysToRemove.forEach(key => originalLocalStorage.removeItem(key));
            console.log(`✅ Cleared ${keysToRemove.length} items for ${targetGroup}`);
            location.reload();
        }
    };
    
    // ========================================
    // EXPORT
    // ========================================
    
    window.groupStorage = {
        getCurrentGroup: () => window.CURRENT_GROUP_ID,
        getStorageKey: getStorageKey,
        showGroupStorage: window.showGroupStorage,
        showAllGroupsStorage: window.showAllGroupsStorage,
        clearGroupStorage: window.clearGroupStorage,
        migrate: migrateOldDataToGroup
    };
    
    console.log('%c🔐 Group-Specific Storage Initialized', 'color: #10b981; font-weight: bold; font-size: 14px');
    console.log('%c   All localStorage is now group-isolated', 'color: #3b82f6; font-size: 12px');
    
})();

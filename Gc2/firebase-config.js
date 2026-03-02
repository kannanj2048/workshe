// 1) Firebase configuration JS SDK v7.20.0 
const firebaseConfig = {
  apiKey: "AIzaSyCQgRYZWoYQXBX4ynzEhsQ_ZR64SsICeVs",
  authDomain: "workschedulemanager-4e2a0.firebaseapp.com",
  databaseURL: "https://workschedulemanager-gc2-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "workschedulemanager-4e2a0",
  storageBucket: "workschedulemanager-4e2a0.firebasestorage.app",
  messagingSenderId: "184794549298",
  appId: "1:184794549298:web:734fe91e35a791b3a0402b",
  measurementId: "G-EH0HMB5VFZ"
};

// 2) Global database — on window so ALL modules always get the live reference
window.database = null;
window.firebaseReady = false;

// 3) Initialize Firebase SAFELY
function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      console.warn("⚠️ Firebase SDK not loaded - using localStorage only");
      return false;
    }

    firebase.initializeApp(firebaseConfig);
    window.database = firebase.database();
    window.firebaseReady = true;
    console.log("✅ Firebase READY");
    return true;
  } catch (error) {
    console.warn("⚠️ Firebase init failed:", error);
    return false;
  }
}

// 4) SAFE database check
window.hasDatabase = () => window.firebaseReady && window.database !== null;

// ========================================
// BULLETPROOF FIREBASE FUNCTIONS
// ========================================

function saveScheduleToFirebase(schedule) {
  if (!window.hasDatabase()) {
    console.log("⚠️ No Firebase - saved to localStorage only");
    return;
  }
  
  const dateKey = schedule.date;
  window.database.ref('schedules/' + dateKey).set(schedule)
    .then(() => console.log('✅ Schedule saved:', dateKey))
    .catch(err => console.error('❌ Save failed:', err));
}

function loadScheduleFromFirebase(date, callback) {
  if (!window.hasDatabase()) {
    console.log("⚠️ No Firebase - using localStorage");
    callback(null);
    return;
  }
  
  // ✅ CRITICAL FIX: Use formatDateForInput to preserve SGT date
  const dateStr = typeof formatDateForInput === 'function' 
    ? formatDateForInput(date) 
    : date.toISOString().split('T')[0];
  console.log("🔍 Loading schedule from Firebase:", dateStr);
  
  window.database.ref('schedules/' + dateStr).once('value')
    .then(snapshot => {
      const schedule = snapshot.val();
      console.log("📥 Firebase schedule:", schedule ? "FOUND" : "NOT FOUND");
      callback(schedule);
    })
    .catch(error => {
      console.warn('⚠️ Firebase load error (ignored):', error.message || error);
      callback(null);
    });
}

function saveTeamDataToFirebase() {
  if (!window.hasDatabase() || typeof teamData === 'undefined') return;
  window.database.ref('teamData').set(teamData)
    .catch(err => console.error('❌ Team save error:', err));
}

function loadTeamDataFromFirebase(callback) {
  if (!window.hasDatabase()) {
    if (callback) callback(null);
    return;
  }
  window.database.ref('teamData').once('value')
    .then(snapshot => {
      const data = snapshot.val();
      if (data && typeof teamData !== 'undefined') {
        Object.assign(teamData, data);
      }
      if (callback) callback(data);
    })
    .catch(err => {
      console.error('❌ Team load error:', err);
      if (callback) callback(null);
    });
}

function saveAvailabilityToFirebase() {
  if (!window.hasDatabase() || typeof availabilityOverrides === 'undefined') return;
  window.database.ref('availabilityOverrides').set(availabilityOverrides)
    .catch(err => console.error('❌ Availability save error:', err));
}

function loadAvailabilityFromFirebase(callback) {
  if (!window.hasDatabase()) {
    if (callback) callback(null);
    return;
  }
  window.database.ref('availabilityOverrides').once('value')
    .then(snapshot => {
      const data = snapshot.val();
      if (data) availabilityOverrides = data;
      if (callback) callback(data);
    })
    .catch(err => {
      console.error('❌ Availability load error:', err);
      if (callback) callback(null);
    });
}

// ========================================
// ✅ PERFECTLY SAFE generateDailySchedule
// ========================================
window.generateDailySchedule = function(dateSGT) {
  // ✅ CRITICAL FIX: Use formatDateForInput to preserve SGT date (not UTC)
  const dateStr = typeof formatDateForInput === 'function' 
    ? formatDateForInput(dateSGT) 
    : dateSGT.toISOString().split("T")[0];
  
  // ✅ CRITICAL: Update date input field FIRST to prevent display lag
  const dateInput = document.getElementById("scheduleDate");
  if (dateInput) {
    dateInput.value = dateStr;
  }
  
  // ✅ STEP 1: Refresh availability status BEFORE generating schedule
  console.log("🔄 Refreshing availability status before schedule generation...");
  if (typeof syncWorkingSchedulesWithLeave === 'function') {
    syncWorkingSchedulesWithLeave();
  }
  if (typeof updateAvailabilityStatus === 'function') {
    updateAvailabilityStatus();
  }
  
  // Always update display first (safe functions)
  if (typeof updateCurrentDayDisplay === 'function') {
    updateCurrentDayDisplay(dateSGT);
  }

  // Wait for generateScheduleForDate to be ready
  function tryGenerate() {
    if (typeof generateScheduleForDate === 'function') {
      console.log("✅ generateScheduleForDate READY - generating schedule for:", dateStr);
      
      // ✅ CRITICAL FIX: Check localStorage FIRST (faster than Firebase)
      let localSchedule = null;
      if (typeof scheduleHistory !== 'undefined' && scheduleHistory[dateStr]) {
        localSchedule = scheduleHistory[dateStr];
        console.log(`📋 Found schedule in localStorage for ${dateStr}`);
      }
      
      // ✅ FIX: Firebase is the SINGLE SOURCE OF TRUTH.
      // ALL devices read from Firebase.
      // ONLY admin device generates or saves a new schedule to Firebase.
      if (window.hasDatabase()) {
        loadScheduleFromFirebase(dateSGT, (firebaseSchedule) => {
          const userIsAdmin = (typeof isAdmin !== 'undefined' && isAdmin);

          if (firebaseSchedule) {
            // ✅ ALL devices: Firebase has a schedule — display it immediately
            console.log(`☁️ Using Firebase schedule for ${dateStr}`);
            scheduleHistory[dateStr] = firebaseSchedule;
            localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
            if (typeof displaySchedule === 'function') displaySchedule(firebaseSchedule);

          } else if (userIsAdmin && localSchedule) {
            // ✅ ADMIN ONLY: push existing localStorage schedule up to Firebase
            console.log(`💾 Admin syncing localStorage schedule to Firebase for ${dateStr}`);
            saveScheduleToFirebase(localSchedule);
            if (typeof displaySchedule === 'function') displaySchedule(localSchedule);

          } else if (userIsAdmin) {
            // ✅ ADMIN ONLY: generate a brand-new schedule and push to Firebase
            console.log(`🆕 Admin generating NEW schedule for ${dateStr}`);
            const newSchedule = generateScheduleForDate(dateSGT);
            scheduleHistory[dateStr] = newSchedule;
            localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
            saveScheduleToFirebase(newSchedule);
            if (typeof displaySchedule === 'function') displaySchedule(newSchedule);

          } else {
            // ⏳ NON-ADMIN: no Firebase schedule yet — show waiting message.
            // The real-time listener in firebase-realtime-sync.js will auto-display
            // as soon as admin generates and saves the schedule to Firebase.
            console.log(`⏳ No Firebase schedule for ${dateStr} — real-time listener will update when admin generates`);
            const tbody = document.getElementById('scheduleTableBody');
            if (tbody) {
              tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-secondary);font-size:15px;">⏳ Waiting for admin to generate schedule...<br><small style="opacity:0.6">This will update automatically</small></td></tr>';
            }
          }

          if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
        });
      } else {
        // No Firebase — localStorage only; only admin writes new schedules
        const userIsAdmin = (typeof isAdmin !== 'undefined' && isAdmin);
        let schedule = localSchedule;
        if (!schedule && userIsAdmin) {
          console.log(`🆕 Admin generating NEW schedule for ${dateStr} (no Firebase)`);
          schedule = generateScheduleForDate(dateSGT);
          scheduleHistory[dateStr] = schedule;
          localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
        }
        if (schedule && typeof displaySchedule === 'function') displaySchedule(schedule);
        if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
      }
    } else {
      // Retry in 50ms
      console.log("⏳ Waiting for generateScheduleForDate... (50ms)");
      setTimeout(tryGenerate, 50);
    }
  }
  
  tryGenerate();
};

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFirebase);
} else {
  initFirebase();
}

// window.database and window.firebaseReady are live — set in initFirebase()
window.saveScheduleToFirebase = saveScheduleToFirebase;
window.loadScheduleFromFirebase = loadScheduleFromFirebase;
window.saveTeamDataToFirebase = saveTeamDataToFirebase;
window.loadTeamDataFromFirebase = loadTeamDataFromFirebase;
window.saveAvailabilityToFirebase = saveAvailabilityToFirebase;
window.loadAvailabilityFromFirebase = loadAvailabilityFromFirebase;

console.log("✅ firebase-config.js - BULLETPROOF VERSION LOADED");

/*// ========================================
// 🔄 ONE-TIME DATA SYNC UTILITY
// ========================================
window.syncLocalToFirebase = function() {
    if (!window.hasDatabase()) {
        console.error("❌ Firebase not ready - cannot sync");
        return;
    }

    console.log("🔄 Starting full sync from localStorage to Firebase...");

    // 1. Sync Team Data
    const localTeam = localStorage.getItem('teamData');
    if (localTeam) {
        window.database.ref('teamData').set(JSON.parse(localTeam))
            .then(() => console.log("✅ Team Data synced to Firebase"))
            .catch(err => console.error("❌ Team sync failed:", err));
    }

    // 2. Sync Schedule History
    const localSchedules = localStorage.getItem('scheduleHistory');
    if (localSchedules) {
        window.database.ref('schedules').update(JSON.parse(localSchedules))
            .then(() => console.log("✅ Schedule History synced to Firebase"))
            .catch(err => console.error("❌ Schedule sync failed:", err));
    }
    
    // 3. Sync Availability Overrides
    const localAvail = localStorage.getItem('availabilityOverrides');
    if (localAvail) {
        window.database.ref('availabilityOverrides').set(JSON.parse(localAvail))
            .then(() => console.log("✅ Availability synced to Firebase"))
            .catch(err => console.error("❌ Availability sync failed:", err));
    }
};

// Export to window
window.syncLocalToFirebase = window.syncLocalToFirebase;

console.log("✅ firebase-config.js - BULLETPROOF VERSION LOADED");*/
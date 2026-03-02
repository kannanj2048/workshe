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

// 2) Global database
let database = null;
let firebaseReady = false;

// 3) Initialize Firebase SAFELY
function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      console.warn("⚠️ Firebase SDK not loaded - using localStorage only");
      return false;
    }

    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    firebaseReady = true;
    // ✅ Export to window NOW so all other scripts get the live reference
    window.database = database;
    window.firebaseReady = true;
    console.log("✅ Firebase READY");
    return true;
  } catch (error) {
    console.warn("⚠️ Firebase init failed:", error);
    return false;
  }
}

// 4) SAFE database check
window.hasDatabase = () => firebaseReady && database !== null;

// ========================================
// BULLETPROOF FIREBASE FUNCTIONS
// ========================================

// ✅ Safe localStorage writer - used by generateDailySchedule
// Falls back gracefully if safeSetScheduleHistory defined in script.js
function _safeSetScheduleHistory() {
  if (typeof safeSetScheduleHistory === 'function') {
    _safeSetScheduleHistory(); // use the full version from script.js if available
  } else {
    try {
      localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory));
    } catch(e) {
      console.warn("⚠️ localStorage write failed:", e.message);
    }
  }
}

function saveScheduleToFirebase(schedule) {
  if (!window.hasDatabase()) {
    console.log("⚠️ No Firebase - saved to localStorage only");
    return;
  }
  
  const dateKey = schedule.date;
  database.ref('schedules/' + dateKey).set(schedule)
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
  
  database.ref('schedules/' + dateStr).once('value')
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
  database.ref('teamData').set(teamData)
    .catch(err => console.error('❌ Team save error:', err));
}

function loadTeamDataFromFirebase(callback) {
  if (!window.hasDatabase()) {
    if (callback) callback(null);
    return;
  }
  database.ref('teamData').once('value')
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
  database.ref('availabilityOverrides').set(availabilityOverrides)
    .catch(err => console.error('❌ Availability save error:', err));
}

function loadAvailabilityFromFirebase(callback) {
  if (!window.hasDatabase()) {
    if (callback) callback(null);
    return;
  }
  database.ref('availabilityOverrides').once('value')
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
// generateDailySchedule — SINGLE SOURCE OF TRUTH
// Firebase is ALWAYS master. Local data is read-only cache.
// Only admin (or the midnight lock winner) may write to Firebase.
// ========================================
window.generateDailySchedule = function(dateSGT) {

  const dateStr = typeof formatDateForInput === 'function'
    ? formatDateForInput(dateSGT)
    : dateSGT.toISOString().split("T")[0];

  // Update date picker immediately
  const dateInput = document.getElementById("scheduleDate");
  if (dateInput) dateInput.value = dateStr;

  // Refresh availability before anything else
  if (typeof syncWorkingSchedulesWithLeave === 'function') syncWorkingSchedulesWithLeave();
  if (typeof updateAvailabilityStatus === 'function') updateAvailabilityStatus();
  if (typeof updateCurrentDayDisplay === 'function') updateCurrentDayDisplay(dateSGT);

  function tryGenerate() {
    if (typeof generateScheduleForDate !== 'function') {
      setTimeout(tryGenerate, 50);
      return;
    }

    if (window.hasDatabase()) {
      // ─────────────────────────────────────────────
      // FIREBASE PATH: always read Firebase first
      // ─────────────────────────────────────────────
      loadScheduleFromFirebase(dateSGT, (firebaseSchedule) => {

        if (firebaseSchedule) {
          // ✅ Firebase has a schedule → use it on ALL devices, no exceptions
          console.log("☁️ Using Firebase schedule for", dateStr);
          firebaseSchedule.shift = typeof getShiftForDate === 'function'
            ? getShiftForDate(dateSGT) : firebaseSchedule.shift;
          scheduleHistory[dateStr] = firebaseSchedule;
          _safeSetScheduleHistory();
          if (typeof displaySchedule === 'function') displaySchedule(firebaseSchedule);
          if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);

        } else {
          // Firebase has nothing for this date
          const localSchedule = (typeof scheduleHistory !== 'undefined') ? scheduleHistory[dateStr] : null;

          if (typeof isAdmin !== 'undefined' && isAdmin) {
            // ✅ Admin: generate new schedule and save it to Firebase
            // All other devices will get it via real-time listener
            const newSchedule = localSchedule || generateScheduleForDate(dateSGT);
            newSchedule.shift = typeof getShiftForDate === 'function'
              ? getShiftForDate(dateSGT) : newSchedule.shift;
            scheduleHistory[dateStr] = newSchedule;
            _safeSetScheduleHistory();
            saveScheduleToFirebase(newSchedule);
            console.log("🆕 Admin generated & saved schedule for", dateStr);
            if (typeof displaySchedule === 'function') displaySchedule(newSchedule);
            if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);

          } else if (localSchedule) {
            // ✅ Non-admin with local cache: show it but DO NOT upload
            // The real-time listener will push the correct one when admin generates
            console.log("💾 Non-admin showing cached schedule for", dateStr, "(not uploading)");
            if (typeof displaySchedule === 'function') displaySchedule(localSchedule);
            if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);

          } else {
            // ✅ Non-admin, no data at all: show empty state
            console.log("⏳ No schedule yet for", dateStr, "- waiting for admin");
            if (typeof displaySchedule === 'function') displaySchedule({ date: dateStr, platforms: {}, tasks: {} });
            if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
          }
        }
      });

    } else {
      // ─────────────────────────────────────────────
      // NO FIREBASE: use local only
      // ─────────────────────────────────────────────
      let schedule = (typeof scheduleHistory !== 'undefined') ? scheduleHistory[dateStr] : null;
      if (!schedule) {
        schedule = generateScheduleForDate(dateSGT);
        scheduleHistory[dateStr] = schedule;
        _safeSetScheduleHistory();
      }
      if (typeof displaySchedule === 'function') displaySchedule(schedule);
      if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
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

// Export everything safely
// ✅ NOTE: window.database and window.firebaseReady are set inside initFirebase()
// so they are always up-to-date. Do NOT export the local variables here as they are null at parse time.
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
        database.ref('teamData').set(JSON.parse(localTeam))
            .then(() => console.log("✅ Team Data synced to Firebase"))
            .catch(err => console.error("❌ Team sync failed:", err));
    }

    // 2. Sync Schedule History
    const localSchedules = localStorage.getItem('scheduleHistory');
    if (localSchedules) {
        database.ref('schedules').update(JSON.parse(localSchedules))
            .then(() => console.log("✅ Schedule History synced to Firebase"))
            .catch(err => console.error("❌ Schedule sync failed:", err));
    }
    
    // 3. Sync Availability Overrides
    const localAvail = localStorage.getItem('availabilityOverrides');
    if (localAvail) {
        database.ref('availabilityOverrides').set(JSON.parse(localAvail))
            .then(() => console.log("✅ Availability synced to Firebase"))
            .catch(err => console.error("❌ Availability sync failed:", err));
    }
};

// Export to window
window.syncLocalToFirebase = window.syncLocalToFirebase;

console.log("✅ firebase-config.js - BULLETPROOF VERSION LOADED");*/
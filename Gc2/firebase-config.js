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

// ========================================
// REALTIME SYNC GUARD
// When firebase-realtime-sync.js displays live data via .on('value'),
// it calls window._markRealtimeSynced().
// generateDailySchedule checks this and skips its display step so the
// stale .once() fetch never overwrites the live real-time data.
// ========================================
window._lastRealtimeSyncMs = 0;
window._markRealtimeSynced = function() {
  window._lastRealtimeSyncMs = Date.now();
};
window._realtimeSyncedRecently = function() {
  return (Date.now() - window._lastRealtimeSyncMs) < 3000;
};

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
// FIREBASE FUNCTIONS
// ========================================

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
  if (!window.hasDatabase()) { callback(null); return; }
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
      console.warn('⚠️ Firebase load error:', error.message || error);
      callback(null);
    });
}

function saveTeamDataToFirebase() {
  if (!window.hasDatabase() || typeof teamData === 'undefined') return;
  database.ref('teamData').set(teamData)
    .catch(err => console.error('❌ Team save error:', err));
}

function loadTeamDataFromFirebase(callback) {
  if (!window.hasDatabase()) { if (callback) callback(null); return; }
  database.ref('teamData').once('value')
    .then(snapshot => {
      const data = snapshot.val();
      if (data && typeof teamData !== 'undefined') Object.assign(teamData, data);
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
  if (!window.hasDatabase()) { if (callback) callback(null); return; }
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
// generateDailySchedule — FIXED
//
// ROOT CAUSE OF THE BUG:
// Every device (admin + non-admin) was calling generateScheduleForDate()
// when no Firebase schedule existed yet (e.g. at SGT midnight for the new day).
// Each device generates a DIFFERENT schedule (AI patterns vary) and writes it
// to Firebase — last writer wins, so all devices end up showing different data.
//
// THE FIX:
// 1. Non-admin/non-guest devices NEVER generate or write a new schedule.
//    They only READ from Firebase. If nothing is in Firebase yet, they wait
//    and show a "waiting for admin" message.
// 2. The realtime guard prevents the .once() fetch from overwriting data
//    that the .on() listener already displayed.
// ========================================
window.generateDailySchedule = function(dateSGT) {
  const dateStr = typeof formatDateForInput === 'function'
    ? formatDateForInput(dateSGT)
    : dateSGT.toISOString().split("T")[0];

  const dateInput = document.getElementById("scheduleDate");
  if (dateInput) dateInput.value = dateStr;

  if (typeof syncWorkingSchedulesWithLeave === 'function') syncWorkingSchedulesWithLeave();
  if (typeof updateAvailabilityStatus === 'function') updateAvailabilityStatus();
  if (typeof updateCurrentDayDisplay === 'function') updateCurrentDayDisplay(dateSGT);

  // ========================================
  // NON-ADMIN READ-ONLY MODE
  // Non-admin/non-guest devices only read from Firebase.
  // They never generate a new schedule or write to Firebase.
  // This prevents different devices generating conflicting schedules.
  // ========================================
  const userIsAdmin = (typeof isAdmin !== 'undefined' && isAdmin) ||
                      (typeof isGuest !== 'undefined' && isGuest);

  if (!userIsAdmin) {
    // Read-only: just fetch from Firebase and display, never write
    if (window.hasDatabase()) {
      loadScheduleFromFirebase(dateSGT, (firebaseSchedule) => {

        // Skip if real-time sync already showed fresh data
        if (window._realtimeSyncedRecently()) {
          if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
          return;
        }

        if (firebaseSchedule) {
          // Update cache
          if (typeof scheduleHistory !== 'undefined') {
            scheduleHistory[dateStr] = firebaseSchedule;
            try { localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory)); } catch(e) {}
          }
          if (typeof displaySchedule === 'function') displaySchedule(firebaseSchedule);
          if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
        } else {
          // No schedule in Firebase yet — show waiting message, don't generate
          console.log("⏳ No schedule in Firebase yet for", dateStr, "— waiting for admin");
          if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);

          // Show a placeholder in the table so the page doesn't look broken
          const tbody = document.getElementById("scheduleTableBody");
          if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;opacity:0.6;">
              <i class="fas fa-clock"></i> Waiting for admin to generate today's schedule...
            </td></tr>`;
          }
        }
      });
    } else {
      // No Firebase — use whatever is in localStorage cache
      if (typeof scheduleHistory !== 'undefined' && scheduleHistory[dateStr]) {
        if (typeof displaySchedule === 'function') displaySchedule(scheduleHistory[dateStr]);
      }
      if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
    }
    return; // Non-admin exits here — never reaches generate/write code below
  }

  // ========================================
  // ADMIN / GUEST SCHEDULE GENERATION
  // Only admin and guest devices reach this point.
  // They can generate new schedules and write to Firebase.
  // ========================================
  function tryGenerate() {
    if (typeof generateScheduleForDate !== 'function') {
      setTimeout(tryGenerate, 50);
      return;
    }

    let localSchedule = (typeof scheduleHistory !== 'undefined' && scheduleHistory[dateStr])
      ? scheduleHistory[dateStr] : null;

    if (window.hasDatabase()) {
      loadScheduleFromFirebase(dateSGT, (firebaseSchedule) => {

        // Skip display if real-time sync already pushed fresh data
        if (window._realtimeSyncedRecently()) {
          console.log("⏭️ Skipping display — real-time sync is live");
          if (firebaseSchedule && typeof scheduleHistory !== 'undefined') {
            scheduleHistory[dateStr] = firebaseSchedule;
            try { localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory)); } catch(e) {}
          }
          if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
          return;
        }

        let scheduleToDisplay = null;

        if (firebaseSchedule) {
          console.log(`☁️ Using Firebase schedule for ${dateStr}`);
          scheduleToDisplay = firebaseSchedule;
          scheduleHistory[dateStr] = firebaseSchedule;
          try { localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory)); } catch(e) {}
        } else if (localSchedule) {
          console.log(`💾 Uploading localStorage schedule to Firebase for ${dateStr}`);
          scheduleToDisplay = localSchedule;
          saveScheduleToFirebase(localSchedule);
        } else {
          console.log(`🆕 Generating NEW schedule for ${dateStr}`);
          scheduleToDisplay = generateScheduleForDate(dateSGT);
          scheduleHistory[dateStr] = scheduleToDisplay;
          try { localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory)); } catch(e) {}
          saveScheduleToFirebase(scheduleToDisplay);
        }

        if (typeof displaySchedule === 'function') displaySchedule(scheduleToDisplay);
        if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
      });
    } else {
      // No Firebase
      let schedule = localSchedule;
      if (!schedule) {
        schedule = generateScheduleForDate(dateSGT);
        scheduleHistory[dateStr] = schedule;
        try { localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory)); } catch(e) {}
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

// Export
window.database = database;
window.firebaseReady = firebaseReady;
window.saveScheduleToFirebase = saveScheduleToFirebase;
window.loadScheduleFromFirebase = loadScheduleFromFirebase;
window.saveTeamDataToFirebase = saveTeamDataToFirebase;
window.loadTeamDataFromFirebase = loadTeamDataFromFirebase;
window.saveAvailabilityToFirebase = saveAvailabilityToFirebase;
window.loadAvailabilityFromFirebase = loadAvailabilityFromFirebase;

console.log("✅ firebase-config.js — read-only for non-admin, realtime guard active");

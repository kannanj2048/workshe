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
// When firebase-realtime-sync.js updates the display via .on('value'),
// it calls window._markRealtimeSynced().
// generateDailySchedule then checks _realtimeSyncedRecently() and skips
// its own displaySchedule() call — preventing .once() stale cache from
// overwriting the fresh data the real-time listener just displayed.
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
      console.warn("Firebase SDK not loaded - using localStorage only");
      return false;
    }
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    firebaseReady = true;
    console.log("Firebase READY");
    return true;
  } catch (error) {
    console.warn("Firebase init failed:", error);
    return false;
  }
}

// 4) SAFE database check
window.hasDatabase = () => firebaseReady && database !== null;

function saveScheduleToFirebase(schedule) {
  if (!window.hasDatabase()) return;
  const dateKey = schedule.date;
  database.ref('schedules/' + dateKey).set(schedule)
    .then(() => console.log('Schedule saved:', dateKey))
    .catch(err => console.error('Save failed:', err));
}

function loadScheduleFromFirebase(date, callback) {
  if (!window.hasDatabase()) { callback(null); return; }
  const dateStr = typeof formatDateForInput === 'function'
    ? formatDateForInput(date)
    : date.toISOString().split('T')[0];
  console.log("Loading schedule from Firebase:", dateStr);
  database.ref('schedules/' + dateStr).once('value')
    .then(snapshot => { callback(snapshot.val()); })
    .catch(error => { console.warn('Firebase load error:', error.message || error); callback(null); });
}

function saveTeamDataToFirebase() {
  if (!window.hasDatabase() || typeof teamData === 'undefined') return;
  database.ref('teamData').set(teamData).catch(err => console.error('Team save error:', err));
}

function loadTeamDataFromFirebase(callback) {
  if (!window.hasDatabase()) { if (callback) callback(null); return; }
  database.ref('teamData').once('value')
    .then(snapshot => {
      const data = snapshot.val();
      if (data && typeof teamData !== 'undefined') Object.assign(teamData, data);
      if (callback) callback(data);
    })
    .catch(err => { console.error('Team load error:', err); if (callback) callback(null); });
}

function saveAvailabilityToFirebase() {
  if (!window.hasDatabase() || typeof availabilityOverrides === 'undefined') return;
  database.ref('availabilityOverrides').set(availabilityOverrides)
    .catch(err => console.error('Availability save error:', err));
}

function loadAvailabilityFromFirebase(callback) {
  if (!window.hasDatabase()) { if (callback) callback(null); return; }
  database.ref('availabilityOverrides').once('value')
    .then(snapshot => {
      const data = snapshot.val();
      if (data) availabilityOverrides = data;
      if (callback) callback(data);
    })
    .catch(err => { console.error('Availability load error:', err); if (callback) callback(null); });
}

// ========================================
// generateDailySchedule - FIXED
// Skips display if real-time sync already pushed fresh data
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

  function tryGenerate() {
    if (typeof generateScheduleForDate !== 'function') {
      setTimeout(tryGenerate, 50);
      return;
    }

    let localSchedule = (typeof scheduleHistory !== 'undefined' && scheduleHistory[dateStr])
      ? scheduleHistory[dateStr] : null;

    if (window.hasDatabase()) {
      loadScheduleFromFirebase(dateSGT, (firebaseSchedule) => {

        // REALTIME GUARD: real-time listener already showed fresh data — skip
        if (window._realtimeSyncedRecently()) {
          console.log("Skipping display — real-time sync is live");
          if (firebaseSchedule && typeof scheduleHistory !== 'undefined') {
            scheduleHistory[dateStr] = firebaseSchedule;
            try { localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory)); } catch(e) {}
          }
          if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
          return;
        }

        let scheduleToDisplay = null;
        if (firebaseSchedule) {
          scheduleToDisplay = firebaseSchedule;
          scheduleHistory[dateStr] = firebaseSchedule;
          try { localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory)); } catch(e) {}
        } else if (localSchedule) {
          scheduleToDisplay = localSchedule;
          saveScheduleToFirebase(localSchedule);
        } else {
          scheduleToDisplay = generateScheduleForDate(dateSGT);
          scheduleHistory[dateStr] = scheduleToDisplay;
          try { localStorage.setItem("scheduleHistory", JSON.stringify(scheduleHistory)); } catch(e) {}
          saveScheduleToFirebase(scheduleToDisplay);
        }

        if (typeof displaySchedule === 'function') displaySchedule(scheduleToDisplay);
        if (typeof updateCurrentShiftInfo === 'function') updateCurrentShiftInfo(dateSGT);
      });
    } else {
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFirebase);
} else {
  initFirebase();
}

window.database = database;
window.firebaseReady = firebaseReady;
window.saveScheduleToFirebase = saveScheduleToFirebase;
window.loadScheduleFromFirebase = loadScheduleFromFirebase;
window.saveTeamDataToFirebase = saveTeamDataToFirebase;
window.loadTeamDataFromFirebase = loadTeamDataFromFirebase;
window.saveAvailabilityToFirebase = saveAvailabilityToFirebase;
window.loadAvailabilityFromFirebase = loadAvailabilityFromFirebase;

console.log("firebase-config.js loaded with real-time sync guard");

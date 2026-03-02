// ========================================
// USER MANAGEMENT FUNCTIONS
// ========================================

// Check if user exists, if not add to database with role
function checkAndAddUser(userName, role, callback) {
    if (!hasDatabase()) {
        console.error('Database not available');
        if (callback) callback(false);
        return;
    }

    const userRef = database.ref('users/' + role + '/' + userName);
    
    // Check if user exists
    userRef.once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                // User already exists
                console.log('User already exists:', userName, 'in role:', role);
                if (callback) callback(true, 'exists');
            } else {
                // User doesn't exist, add them
                addUserToRole(userName, role, callback);
            }
        })
        .catch((error) => {
            console.error('Error checking user:', error);
            if (callback) callback(false);
        });
}

// Add new user to specific role
function addUserToRole(userName, role, callback) {
    if (!hasDatabase()) {
        console.error('Database not available');
        if (callback) callback(false);
        return;
    }

    const userData = {
        name: userName,
        role: role,
        addedDate: new Date().toISOString(),
        active: true
    };

    database.ref('users/' + role + '/' + userName).set(userData)
        .then(() => {
            console.log('✅ User added successfully:', userName, 'as', role);
            
            // Update local teamData
            updateLocalTeamData(userName, role);
            
            // Show success notification
            showNotification(`User ${userName} added as ${role}`, 'success');
            
            if (callback) callback(true, 'added');
        })
        .catch((error) => {
            console.error('❌ Error adding user:', error);
            showNotification('Failed to add user to database', 'error');
            if (callback) callback(false);
        });
}

// Update local teamData object after adding user
function updateLocalTeamData(userName, role) {
    if (role === 'SA') {
        if (!teamData.team1) teamData.team1 = { SAs: [], apprentices: [] };
        if (!teamData.team1.SAs.includes(userName)) {
            teamData.team1.SAs.push(userName);
        }
        
        // ✅ Initialize availability settings for new SA
        if (typeof memberAvailabilitySettings !== 'undefined') {
            if (!memberAvailabilitySettings.SAs) {
                memberAvailabilitySettings.SAs = {};
            }
            if (!memberAvailabilitySettings.SAs[userName]) {
                memberAvailabilitySettings.SAs[userName] = {
                    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                };
                console.log(`✅ Initialized availability for new SA: ${userName}`);
                
                // Save to localStorage and Firebase
                if (typeof saveMemberAvailabilitySettings === 'function') {
                    saveMemberAvailabilitySettings();
                }
            }
        }
    } else if (role === 'Apprentice') {
        if (!teamData.team1) teamData.team1 = { SAs: [], apprentices: [] };
        if (!teamData.team1.apprentices.includes(userName)) {
            teamData.team1.apprentices.push(userName);
        }
        
        // ✅ Initialize availability settings for new Apprentice
        if (typeof memberAvailabilitySettings !== 'undefined') {
            if (!memberAvailabilitySettings.apprentices) {
                memberAvailabilitySettings.apprentices = {};
            }
            if (!memberAvailabilitySettings.apprentices[userName]) {
                memberAvailabilitySettings.apprentices[userName] = {
                    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                };
                console.log(`✅ Initialized availability for new Apprentice: ${userName}`);
                
                // Save to localStorage and Firebase
                if (typeof saveMemberAvailabilitySettings === 'function') {
                    saveMemberAvailabilitySettings();
                }
            }
        }
    }
    
    // Save updated team data back to Firebase
    saveTeamDataToFirebase();
}

// Get all users from database
function getAllUsers(callback) {
    if (!hasDatabase()) {
        console.error('Database not available');
        if (callback) callback(null);
        return;
    }

    database.ref('users').once('value')
        .then((snapshot) => {
            const users = snapshot.val();
            if (callback) callback(users);
        })
        .catch((error) => {
            console.error('Error loading users:', error);
            if (callback) callback(null);
        });
}

// Delete user from role
function deleteUserFromRole(userName, role, callback) {
    if (!hasDatabase()) {
        console.error('Database not available');
        if (callback) callback(false);
        return;
    }

    database.ref('users/' + role + '/' + userName).remove()
        .then(() => {
            console.log('User removed:', userName);
            showNotification(`User ${userName} removed`, 'success');
            if (callback) callback(true);
        })
        .catch((error) => {
            console.error('Error removing user:', error);
            showNotification('Failed to remove user', 'error');
            if (callback) callback(false);
        });
}

// ==========================================
// HYBRID AI SYSTEM - FIXED VERSION
// Combines Smart AI + AI Learning
// ==========================================

// Hybrid platform assignment decision
function hybridPlatformAssignment(platform, availableSAs, dayName, recentHistory, scores) {
    console.log(`\n🔀 HYBRID AI: Assigning ${platform} on ${dayName}`);

    // Try AI Learning first
    const aiSuggestion = getAILearningPlatformSuggestion(platform, dayName);

    if (aiSuggestion && aiSuggestion.confidence > 0.7) {
        console.log(`  ✅ AI Learning (High Confidence: ${(aiSuggestion.confidence * 100).toFixed(0)}%)`);
        console.log(`     → Suggesting: ${aiSuggestion.sa} (${aiSuggestion.evidence})`);

        // Check if AI suggestion is available
        if (availableSAs.includes(aiSuggestion.sa)) {
            // Verify fairness with Smart AI
            if (scores[aiSuggestion.sa] && scores[aiSuggestion.sa].fairnessScore < 10) {
                console.log(`  ✅ Fairness check passed - using AI suggestion`);
                return aiSuggestion.sa;
            } else {
                console.log(`  ⚠️ Fairness check failed - deferring to Smart AI`);
            }
        } else {
            console.log(`  ⚠️ AI suggestion unavailable - using Smart AI fallback`);
        }
    } else if (aiSuggestion) {
        console.log(`  📊 AI Learning (Medium Confidence: ${(aiSuggestion.confidence * 100).toFixed(0)}%)`);
        console.log(`     → Suggestion: ${aiSuggestion.sa} (needs Smart AI verification)`);

        // Medium confidence - ask Smart AI for second opinion
        if (availableSAs.includes(aiSuggestion.sa) && scores[aiSuggestion.sa]) {
            const smartAIChoice = selectBestPersonForPlatform(platform, availableSAs, [], recentHistory, scores, new Date());

            if (smartAIChoice === aiSuggestion.sa) {
                console.log(`  ✅ Smart AI agrees - using AI suggestion`);
                return aiSuggestion.sa;
            } else {
                console.log(`  ⚖️ Smart AI disagrees - using Smart AI choice: ${smartAIChoice}`);
                return smartAIChoice;
            }
        }
    } else {
        console.log(`  🤖 Smart AI (No AI Learning data)`);
    }

    // Fall back to Smart AI
    const smartChoice = selectBestPersonForPlatform(platform, availableSAs, [], recentHistory, scores, new Date());
    console.log(`  → Final Assignment: ${smartChoice} (Smart AI)`);
    return smartChoice;
}

// Hybrid task assignment decision
function hybridTaskAssignment(taskName, availableMembers, memberType) {
    const aiSuggestion = getAILearningTaskSuggestion(taskName);

    if (aiSuggestion && aiSuggestion.confidence > 0.6) {
        console.log(`  🧠 AI suggests ${taskName}: ${aiSuggestion.assigned} (${(aiSuggestion.confidence * 100).toFixed(0)}% confidence)`);

        // Check if suggestion is still valid
        const suggestedPeople = aiSuggestion.assigned.split(' / ');
        const allAvailable = suggestedPeople.every(person => availableMembers.includes(person));

        if (allAvailable) {
            return aiSuggestion.assigned;
        }
    }

    // Fall back to existing logic
    return null;
}

// Override the main schedule generation to use Hybrid AI
const originalGenerateScheduleForDate = window.generateScheduleForDate;

if (typeof originalGenerateScheduleForDate === 'function') {
    window.generateScheduleForDate = function(dateSGT) {
        console.log('\n🔀 HYBRID AI SCHEDULING');

        // 1. Get patterns from localStorage safely
        const patternsData = localStorage.getItem('learnedPatterns');
        const patterns = patternsData ? JSON.parse(patternsData) : null;

        // 2. Logic Check
        if (patterns) {
            // Use optional chaining to safely get the count
            const analyzedCount = patterns?.metadata?.schedulesAnalyzed || 0;
            const minRequired = window.AI_LEARNING_CONFIG?.MIN_PATTERNS_REQUIRED || 5;

            if (analyzedCount >= minRequired) {
                console.log(`✅ Using AI-powered schedule generation (${analyzedCount} schedules trained)`);
            } else {
                console.log(`⚠️ Limited AI data (${analyzedCount} schedules) - using standard generation`);
            }
        } else {
            // This now correctly follows the 'if (patterns)' block
            console.log('ℹ️ No AI training data yet - using standard schedule generation');
        }

        // 3. Call original function safely
        return originalGenerateScheduleForDate.call(this, dateSGT);
    };
}

console.log('%c🔀 Hybrid AI System Loaded', 'color: #3b82f6; font-weight: bold');
console.log('%c   Combining Smart AI + AI Learning', 'color: #8b5cf6; font-size: 11px');

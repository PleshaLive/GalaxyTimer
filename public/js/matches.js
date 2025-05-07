// public/js/matches.js

// --- Constants ---
// URL of the external API providing the team list
const EXTERNAL_TEAMS_API_URL = 'https://waywayway-production.up.railway.app/api/teams';
// Base URL of the external site for constructing full logo paths
const EXTERNAL_BASE_URL = 'https://waywayway-production.up.railway.app';
// Path to a local default/placeholder logo within *this* project
const LOCAL_DEFAULT_LOGO_PATH = "/logos/none.png";

// --- State Variables ---
let teamsInitialized = false;
let teamsInitializationPromise = null;

// --- Initialization ---

/**
 * Initializes the matches module: fetches team list from the EXTERNAL API,
 * populates selects, and attaches event handlers.
 * @returns {Promise<void>} A promise that resolves when initialization is complete.
 */
export async function initMatches() {
    // Prevent multiple initializations
    if (teamsInitializationPromise) {
        return teamsInitializationPromise;
    }

    teamsInitializationPromise = new Promise(async (resolve, reject) => {
        console.log(`[Matches] Starting teams initialization from external API: ${EXTERNAL_TEAMS_API_URL}`);

        try {
            // Fetch team list from the external API
            const response = await fetch(EXTERNAL_TEAMS_API_URL);
            if (!response.ok) {
                // Handle HTTP errors (like 404, 500, or CORS errors if not configured)
                const errorText = await response.text(); // Try to get error text
                console.error(`[Matches] Failed to fetch teams from external API. Status: ${response.status}. Response: ${errorText}`);
                throw new Error(`HTTP error ${response.status} when fetching teams. Check API URL and CORS settings on ${EXTERNAL_BASE_URL}.`);
            }

            // The external API returns an object { teams: [...] } based on your provided server code
            const data = await response.json();
            const teamsList = data.teams; // Extract the array

            if (!Array.isArray(teamsList)) {
                 console.warn("[Matches] Received non-array 'teams' data from external API:", data);
                 throw new Error("Invalid data format received from external API (expected { teams: [...] }).");
            }

            if (teamsList.length === 0) {
                console.warn(`[Matches] Team list from ${EXTERNAL_TEAMS_API_URL} is empty.`);
            } else {
                console.log(`[Matches] Successfully fetched ${teamsList.length} teams from external API.`);
            }

            // Populate team select dropdowns with the fetched list
            populateTeamSelects(teamsList); // Pass the extracted array

            // Attach other event handlers (these functions remain unchanged)
            attachTeamLogoUpdates();
            attachWinnerButtons();
            attachStatusChangeHandlers();

            // Perform initial UI updates for match columns
            for (let m = 1; m <= 4; m++) {
                updateWinnerButtonLabels(m);
                refreshWinnerHighlight(m);
                const statusSelectElement = document.getElementById(`statusSelect${m}`);
                if (statusSelectElement) {
                    updateStatusColor(statusSelectElement);
                }
            }

            // Note: Real-time updates via Socket.IO ('teamsUpdate') from the *current*
            // server (localhost:3000) will NOT reflect changes made on the external
            // admin panel unless a relay mechanism is implemented between the servers.
            /*
            if (typeof io !== 'undefined') {
                const socket = io(); // Connects to localhost:3000
                socket.on('teamsUpdate', (updatedTeamsData) => {
                    console.log('[SOCKET][Matches] Received teamsUpdate:', updatedTeamsData);
                    // Assuming the event sends { teams: [...] }
                    const updatedTeamsList = Array.isArray(updatedTeamsData?.teams) ? updatedTeamsData.teams : [];
                    populateTeamSelects(updatedTeamsList);
                    for (let m = 1; m <= 4; m++) {
                        updateWinnerButtonLabels(m);
                    }
                 });
                 console.log('[Matches] Socket listener for "teamsUpdate" attached (listening to current server).');
            } else {
                 console.warn("[Matches] Socket.IO client not found. Real-time team updates might not work.");
            }
            */

            teamsInitialized = true;
            console.log("[Matches] Teams initialization completed using external API.");
            resolve(); // Initialization successful

        } catch (err) {
            console.error("[Matches] Error during initialization with external API:", err);
            // Attempt to show empty selects in case of error
            try { populateTeamSelects([]); } catch {}
            reject(err); // Initialization failed
        }
    });

    return teamsInitializationPromise;
}

/**
 * Checks if the team list has been initialized.
 * @returns {boolean} True if initialized, false otherwise.
 */
export function areTeamsInitialized() {
    return teamsInitialized;
}

// --- UI Population and Updates ---

/**
 * Populates team select dropdowns in all match columns.
 * Constructs full logo URLs using the external base URL.
 * @param {Array<object>} teamsList - Array of team objects { id, name, logo, score }.
 */
export function populateTeamSelects(teamsList) {
    // Create the default placeholder option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-"; // Placeholder text
    defaultOption.dataset.logo = LOCAL_DEFAULT_LOGO_PATH; // Use local placeholder image

    // Iterate through each match column (1 to 4)
    for (let m = 1; m <= 4; m++) {
        const sel1 = document.getElementById(`team1Select${m}`);
        const sel2 = document.getElementById(`team2Select${m}`);
        if (!sel1 || !sel2) continue; // Skip if selects not found

        // Store currently selected values before clearing
        const currentVal1 = sel1.value;
        const currentVal2 = sel2.value;

        // Clear existing options and add the default one
        sel1.innerHTML = "";
        sel2.innerHTML = "";
        sel1.appendChild(defaultOption.cloneNode(true));
        sel2.appendChild(defaultOption.cloneNode(true));

        // Add options for each team fetched from the external API
        teamsList.forEach(team => {
            if (!team.name) return; // Skip teams without a name

            const opt1 = document.createElement("option");
            opt1.value = team.name; // Use team name as the value
            opt1.textContent = team.name;

            // Construct the full, absolute URL for the logo
            let logoUrl = LOCAL_DEFAULT_LOGO_PATH; // Default to local placeholder
            if (team.logo && typeof team.logo === 'string') {
                if (team.logo.startsWith('/')) {
                    // If it's a relative path (e.g., /logos/team.png), prepend the external base URL
                    logoUrl = `${EXTERNAL_BASE_URL}${team.logo}`;
                } else if (team.logo.startsWith('http')) {
                    // If it's already an absolute URL, use it directly
                    logoUrl = team.logo;
                }
                // Add error handling for images
                opt1.dataset.logo = logoUrl;
            } else {
                 opt1.dataset.logo = LOCAL_DEFAULT_LOGO_PATH; // Ensure default if logo is missing/invalid
            }


            sel1.appendChild(opt1);
            const opt2 = opt1.cloneNode(true); // Clone for the second select
            sel2.appendChild(opt2);
        });

        // Restore previously selected values if they still exist in the new list
        if (Array.from(sel1.options).some(opt => opt.value === currentVal1)) {
            sel1.value = currentVal1;
        } else {
            sel1.value = ""; // Reset if previous selection is no longer valid
        }
         if (Array.from(sel2.options).some(opt => opt.value === currentVal2)) {
            sel2.value = currentVal2;
        } else {
            sel2.value = "";
        }
    }
    // console.log("[Matches] Team selects populated/repopulated using external data.");
}

/**
 * Updates the text on the winner selection buttons based on the current team selections.
 * @param {number} matchIndex - The index of the match (1-4).
 */
export function updateWinnerButtonLabels(matchIndex) {
    const sel1 = document.getElementById(`team1Select${matchIndex}`);
    const sel2 = document.getElementById(`team2Select${matchIndex}`);
    const name1 = sel1 && sel1.value ? sel1.value : "Team 1"; // Get name or default
    const name2 = sel2 && sel2.value ? sel2.value : "Team 2";

    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) return;
    const btn1 = matchColumn.querySelector('.winner-btn[data-team="TEAM1"]');
    const btn2 = matchColumn.querySelector('.winner-btn[data-team="TEAM2"]');

    // Using textContent is safer than innerHTML if you don't need HTML entities
    if (btn1) btn1.textContent = ` ${name1}`; // Update button text (keep space for icon if any)
    if (btn2) btn2.textContent = ` ${name2}`;
}

/**
 * Updates the visual highlight of the winner buttons based on the 'data-winner' attribute.
 * @param {number} matchIndex - The index of the match (1-4).
 */
export function refreshWinnerHighlight(matchIndex) {
    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) return;
    const winner = matchColumn.getAttribute("data-winner"); // "TEAM1", "TEAM2", or null
    matchColumn.querySelectorAll(".winner-btn").forEach(b => {
        b.classList.toggle("winner-selected", b.getAttribute("data-team") === winner);
    });
}

/**
 * Updates the background color and text color of the status select element.
 * @param {HTMLSelectElement} sel - The status select element.
 */
export function updateStatusColor(sel) {
    if (!sel) return;
    const v = sel.value.toUpperCase();
    let color, textColor;
    // Define colors based on status value
    switch (v) {
        case "UPCOM":    color = "var(--color-upcom)"; textColor = "var(--color-info-text)"; break;
        case "LIVE":     color = "var(--color-live)"; textColor = "var(--color-warning-text-on-bg)"; break;
        case "FINISHED": color = "var(--color-finished)"; textColor = "var(--color-finished-text-on-bg)"; break;
        default:         color = "var(--color-surface-light)"; textColor = 'var(--color-text-primary)';
    }
    // Apply styles
    sel.style.backgroundColor = color;
    sel.style.color = textColor;
    sel.style.borderColor = color; // Match border color
    // Add/remove classes for potentially more complex styling via CSS
    sel.classList.remove('status-upcom-selected', 'status-live-selected', 'status-finished-selected');
    if (v === 'UPCOM') sel.classList.add('status-upcom-selected');
    if (v === 'LIVE') sel.classList.add('status-live-selected');
    if (v === 'FINISHED') sel.classList.add('status-finished-selected');
}


// --- Event Handlers Setup ---

/**
 * Attaches 'change' event listeners to team select elements to update winner button labels.
 */
export function attachTeamLogoUpdates() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = document.getElementById("team1Select" + m);
        const sel2 = document.getElementById("team2Select" + m);
        if (!sel1 || !sel2) continue;
        const updateLabels = () => updateWinnerButtonLabels(m);
        sel1.addEventListener("change", updateLabels);
        sel2.addEventListener("change", updateLabels);
    }
}

/**
 * Attaches 'click' event listeners to winner buttons to toggle winner status.
 */
export function attachWinnerButtons() {
    document.querySelectorAll(".winner-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const matchColumn = btn.closest(".match-column");
            if (!matchColumn) return;
            const teamKey = btn.getAttribute("data-team");
            const matchIndex = parseInt(matchColumn.dataset.match, 10);
            const currentWinner = matchColumn.getAttribute("data-winner");

            if (currentWinner === teamKey) {
                matchColumn.removeAttribute("data-winner");
            } else {
                matchColumn.setAttribute("data-winner", teamKey);
            }
            refreshWinnerHighlight(matchIndex);
        });
    });
}

/**
 * Attaches 'change' event listeners to status select elements.
 */
export function attachStatusChangeHandlers() {
    for (let m = 1; m <= 4; m++) {
        const sel = document.getElementById("statusSelect" + m);
        if (!sel) continue;
        sel.addEventListener("change", () => {
            updateStatusColor(sel);
            const matchColumn = sel.closest('.match-column');
            if (matchColumn) {
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                if(sel.value) matchColumn.classList.add(`status-${sel.value.toLowerCase()}`);

                const mapRows = matchColumn.querySelectorAll('.map-row');
                if (mapRows.length >= 3) {
                    const thirdMapScoreInput = mapRows[2].querySelector('.map-score-input');
                    if (thirdMapScoreInput) {
                        if (sel.value === 'UPCOM' && thirdMapScoreInput.value === "") {
                            thirdMapScoreInput.value = `MATCH ${m}`;
                            thirdMapScoreInput.placeholder = `MATCH ${m}`;
                        } else if (sel.value !== 'UPCOM' && thirdMapScoreInput.value === `MATCH ${m}`) {
                            thirdMapScoreInput.value = "";
                            thirdMapScoreInput.placeholder = "-:-";
                        }
                    }
                }
            }
        });
    }
}

// --- Data Gathering ---

/**
 * Gathers all data for a single match column.
 * Reads the full logo URL from the dataset.
 * @param {number} matchIndex - The index of the match (1-4).
 * @returns {object | null} An object with match data or null if the column is not found.
 */
export function gatherSingleMatchData(matchIndex) {
    const m = matchIndex;
    const SCORE_REGEX = /^\d+:\d+$/;

    const column = document.querySelector(`.match-column[data-match="${m}"]`);
    if (!column) {
        console.error(`Could not find column for match ${m} when gathering data.`);
        return null;
    }

    const statusSelect = document.getElementById("statusSelect" + m);
    const statusText = statusSelect ? statusSelect.value.toUpperCase() : "";
    const timeInput = document.getElementById("timeInput" + m);
    const timeVal = timeInput ? timeInput.value.trim() : "";

    const selTeam1 = document.getElementById("team1Select" + m);
    const selTeam2 = document.getElementById("team2Select" + m);
    const team1Name = selTeam1 ? selTeam1.value : "";
    const team2Name = selTeam2 ? selTeam2.value : "";

    // Get FULL logo URL from the selected option's dataset
    const team1Logo = selTeam1 && selTeam1.selectedIndex >= 0 // Check if an option other than default is selected
        ? selTeam1.options[selTeam1.selectedIndex].dataset.logo || LOCAL_DEFAULT_LOGO_PATH
        : LOCAL_DEFAULT_LOGO_PATH;
    const team2Logo = selTeam2 && selTeam2.selectedIndex >= 0
        ? selTeam2.options[selTeam2.selectedIndex].dataset.logo || LOCAL_DEFAULT_LOGO_PATH
        : LOCAL_DEFAULT_LOGO_PATH;

    // Gather map data
    const maps = {};
    column.querySelectorAll(".map-row").forEach((row, i) => {
        const mapSelect = row.querySelector(".map-name-select");
        const scoreInput = row.querySelector(".map-score-input");
        maps[`MAP${i + 1}`] = mapSelect ? mapSelect.value : "";
        maps[`MAP${i + 1}_SCORE`] = scoreInput ? scoreInput.value.trim() : "";
    });

    // Auto-fill map scores (NEXT, DECIDER, MATCH X) based on status
    if (statusText === "LIVE") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        const isScore1Numeric = SCORE_REGEX.test(s1);
        const isScore2Numeric = SCORE_REGEX.test(s2);
        const isScore3Numeric = SCORE_REGEX.test(s3);
        if (isScore1Numeric && !isScore2Numeric) { maps.MAP2_SCORE = "NEXT"; maps.MAP3_SCORE = "DECIDER"; }
        else if (isScore1Numeric && isScore2Numeric && !isScore3Numeric) { maps.MAP3_SCORE = "NEXT"; }
    } else if (statusText === "FINISHED") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && (!s3 || !SCORE_REGEX.test(s3))) { maps.MAP3_SCORE = "DECIDER"; }
    } else if (statusText === "UPCOM") {
        if (!maps.MAP1_SCORE) maps.MAP1_SCORE = "NEXT";
        if (!maps.MAP3_SCORE || maps.MAP3_SCORE.startsWith("MATCH ")) { maps.MAP3_SCORE = `MATCH ${m}`; }
    }

    // Score icons (paths need to be valid within *this* project)
    // !! IMPORTANT: Adjust these paths if they are incorrect for your project setup !!
    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";
    const noneIconPath = "C:\\projects\\NewTimer\\files\\none.png"; // Example path
    const mpNoneIconPath = "C:\\projects\\NewTimer\\files\\mp_none.png"; // Example path
    const mpLIconPath = "C:\\projects\\NewTimer\\files\\mp_L.png"; // Example path
    const mpRIconPath = "C:\\projects\\NewTimer\\files\\mp_R.png"; // Example path

    if (statusText === "UPCOM") MP1_UPC = MP2_UPC = MP3_UPC = noneIconPath;
    else if (statusText === "LIVE") { MP1_LIVE = getScoreIcon(maps.MAP1_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath); MP2_LIVE = getScoreIcon(maps.MAP2_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath); MP3_LIVE = getScoreIcon(maps.MAP3_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath); }
    else if (statusText === "FINISHED") { MP1_FIN = getScoreIcon(maps.MAP1_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath); MP2_FIN = getScoreIcon(maps.MAP2_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath); MP3_FIN = getScoreIcon(maps.MAP3_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath); }

    // Finished status texts
    let finCest = "", finResult = "", finVictory = "";
    if (statusText === "FINISHED") { finCest = "cest"; finResult = "Result"; finVictory = "VICTORY"; }

    // Determine winner
    const winnerKey = column.getAttribute("data-winner") || "";
    let teamWinner = "";
    let teamWinnerLogo = LOCAL_DEFAULT_LOGO_PATH; // Use local default path
    if (statusText === "FINISHED" && winnerKey) {
        if (winnerKey === "TEAM1" && team1Name) { teamWinner = team1Name; teamWinnerLogo = team1Logo; } // team1Logo is full URL
        else if (winnerKey === "TEAM2" && team2Name) { teamWinner = team2Name; teamWinnerLogo = team2Logo; } // team2Logo is full URL
    }

    // Status-specific image paths (Adjust paths if needed)
    const liveStatusValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live.png" : noneIconPath;
    const liveBgValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\LIVEBG.png" : noneIconPath;
    const liveVs = statusText === "LIVE" ? "vs" : "";
    const liveCestValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\ongoing.png" : noneIconPath;
    const liveRectUp = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectUp.png" : noneIconPath;
    const liveRectLow = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectLow.png" : noneIconPath;

    const upcomCestValue = statusText === "UPCOM" && timeVal ? "cest" : "";
    const upcomRectUp = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\rectUp.png" : noneIconPath;
    const upcomRectLow = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\rectLow.png" : noneIconPath;
    const upcomVsMiniValue = statusText === "UPCOM" ? "vs" : "";
    const upcomVsBigValue = statusText === "UPCOM" ? "vs" : "";
    const upcomNextPhotoValue = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\bg_next_upcom.png" : "";

    const finRectUp = statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectUp.png" : noneIconPath;
    const finRectLow = statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectLow.png" : noneIconPath;

    // --- Construct status-specific objects ---
    const upcomObj = {
        UPCOM_MATCH_STATUS: statusText === "UPCOM" ? statusText : "",
        UPCOM_TIME: statusText === "UPCOM" ? (timeVal ? timeVal + " CEST" : "") : "",
        UPCOM_TEAM1: statusText === "UPCOM" ? team1Name : "", UPCOM_TEAM2: statusText === "UPCOM" ? team2Name : "",
        UPCOM_TEAM1_LOGO: statusText === "UPCOM" ? team1Logo : LOCAL_DEFAULT_LOGO_PATH, // Use full URL or local default
        UPCOM_TEAM2_LOGO: statusText === "UPCOM" ? team2Logo : LOCAL_DEFAULT_LOGO_PATH, // Use full URL or local default
        UPCOM_MAP1: statusText === "UPCOM" ? maps.MAP1 : "", UPCOM_MAP1_SCORE: statusText === "UPCOM" ? maps.MAP1_SCORE : "",
        UPCOM_MAP2: statusText === "UPCOM" ? maps.MAP2 : "", UPCOM_MAP2_SCORE: statusText === "UPCOM" ? maps.MAP2_SCORE : "",
        UPCOM_MAP3: statusText === "UPCOM" ? maps.MAP3 : "", UPCOM_MAP3_SCORE: statusText === "UPCOM" ? maps.MAP3_SCORE : "",
        UPCOM_Cest: upcomCestValue, UPCOM_RectangleUP: upcomRectUp, UPCOM_RectangleLOW: upcomRectLow,
        UPCOM_vs_mini: upcomVsMiniValue, UPCOM_vs_big: upcomVsBigValue, UPCOM_next: "", UPCOM_next_photo: upcomNextPhotoValue
    };
    const liveObj = {
        LIVE_MATCH_STATUS: statusText === "LIVE" ? statusText : "",
        LIVE_TIME: statusText === "LIVE" ? timeVal : "",
        LIVE_TEAM1: statusText === "LIVE" ? team1Name : "", LIVE_TEAM2: statusText === "LIVE" ? team2Name : "",
        LIVE_TEAM1_LOGO: statusText === "LIVE" ? team1Logo : LOCAL_DEFAULT_LOGO_PATH, // Use full URL or local default
        LIVE_TEAM2_LOGO: statusText === "LIVE" ? team2Logo : LOCAL_DEFAULT_LOGO_PATH, // Use full URL or local default
        LIVE_MAP1: statusText === "LIVE" ? maps.MAP1 : "", LIVE_MAP1_SCORE: statusText === "LIVE" ? maps.MAP1_SCORE : "",
        LIVE_MAP2: statusText === "LIVE" ? maps.MAP2 : "", LIVE_MAP2_SCORE: statusText === "LIVE" ? maps.MAP2_SCORE : "",
        LIVE_MAP3: statusText === "LIVE" ? maps.MAP3 : "", LIVE_MAP3_SCORE: statusText === "LIVE" ? maps.MAP3_SCORE : "",
        LIVE_Cest: liveCestValue, LIVE_VS: liveVs, LIVE_STATUS: liveStatusValue, LIVE_BG: liveBgValue,
        LIVE_RectangleUP: liveRectUp, LIVE_RectangleLOW: liveRectLow
    };
    const finishedObj = {
        FINISHED_MATCH_STATUS: statusText === "FINISHED" ? statusText : "",
        FINISHED_TIME: statusText === "FINISHED" ? (timeVal ? timeVal + " CEST" : "") : "",
        FINISHED_TEAM1: statusText === "FINISHED" ? team1Name : "", FINISHED_TEAM2: statusText === "FINISHED" ? team2Name : "",
        FINISHED_TEAM1_LOGO: statusText === "FINISHED" ? team1Logo : LOCAL_DEFAULT_LOGO_PATH, // Use full URL or local default
        FINISHED_TEAM2_LOGO: statusText === "FINISHED" ? team2Logo : LOCAL_DEFAULT_LOGO_PATH, // Use full URL or local default
        FINISHED_MAP1: statusText === "FINISHED" ? maps.MAP1 : "", FINISHED_MAP1_SCORE: statusText === "FINISHED" ? maps.MAP1_SCORE : "",
        FINISHED_MAP2: statusText === "FINISHED" ? maps.MAP2 : "", FINISHED_MAP2_SCORE: statusText === "FINISHED" ? maps.MAP2_SCORE : "",
        FINISHED_MAP3: statusText === "FINISHED" ? maps.MAP3 : "", FINISHED_MAP3_SCORE: statusText === "FINISHED" ? maps.MAP3_SCORE : "",
        FIN_RectangleUP: finRectUp, FIN_RectangleLOW: finRectLow
    };

    // Map-level logos (dynamic based on score)
    const perMapLogos = {};
    [1, 2, 3].forEach(i => {
        const sc = maps[`MAP${i}_SCORE`];
        const isNum = SCORE_REGEX.test(sc);
        const show = (statusText === "LIVE" || statusText === "FINISHED") && isNum;
        perMapLogos[`MAP${i}_TEAM1logo`] = show ? team1Logo : LOCAL_DEFAULT_LOGO_PATH; // Use full URL or local default
        perMapLogos[`MAP${i}_TEAM2logo`] = show ? team2Logo : LOCAL_DEFAULT_LOGO_PATH; // Use full URL or local default
    });

    // Match-level logos (dynamic based on status)
    const matchLogos = {};
    const showFinishedLogos = statusText === "FINISHED";
    const showLiveLogos = statusText === "LIVE";
    matchLogos[`FINISHED_TEAM1_LOGO_MATCH${m}`] = showFinishedLogos ? team1Logo : LOCAL_DEFAULT_LOGO_PATH; // Use full URL or local default
    matchLogos[`FINISHED_TEAM2_LOGO_MATCH${m}`] = showFinishedLogos ? team2Logo : LOCAL_DEFAULT_LOGO_PATH; // Use full URL or local default
    matchLogos[`LIVE_TEAM1_LOGO_MATCH${m}`] = showLiveLogos ? team1Logo : LOCAL_DEFAULT_LOGO_PATH;       // Use full URL or local default
    matchLogos[`LIVE_TEAM2_LOGO_MATCH${m}`] = showLiveLogos ? team2Logo : LOCAL_DEFAULT_LOGO_PATH;       // Use full URL or local default

    // Combine all parts into the final match object
    const matchObj = {
        ...upcomObj, ...liveObj, ...finishedObj,
        MP1_UPC, MP2_UPC, MP3_UPC,
        MP1_LIVE, MP2_LIVE, MP3_LIVE,
        MP1_FIN, MP2_FIN, MP3_FIN,
        Fin_cest: finCest, FIN_Result: finResult, FIN_VICTORY: finVictory,
        TEAMWINNER: teamWinner, TEAMWINNER_LOGO: teamWinnerLogo, // Use full URL or local default
        ...matchLogos, ...perMapLogos
    };

    return matchObj;
}

// --- Helper Functions ---

/**
 * Returns the path to the score icon based on the score string.
 * @param {string} scoreStr - Score string like "X:Y".
 * @param {string} leftWinPath - Path to the icon when left side wins.
 * @param {string} rightWinPath - Path to the icon when right side wins.
 * @param {string} defaultPath - Path to the default/tie icon.
 * @returns {string} Path to the appropriate icon.
 */
function getScoreIcon(scoreStr, leftWinPath, rightWinPath, defaultPath) {
    if (typeof scoreStr !== 'string') return defaultPath;
    const parts = scoreStr.split(":");
    if (parts.length !== 2) return defaultPath;
    const left = parseFloat(parts[0]);
    const right = parseFloat(parts[1]);
    if (isNaN(left) || isNaN(right)) return defaultPath;
    if (right > left) return rightWinPath;
    if (left > right) return leftWinPath;
    return defaultPath;
}
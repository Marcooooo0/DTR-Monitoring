// script.js - Supabase Integration
const REQUIRED_HOURS = 486;

// === SUPABASE CONFIGURATION ===
// Paste your details from Supabase > Project Settings > API
const SUPABASE_URL = "https://dfpfmrusefsipythjaiy.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmcGZtcnVzZWZzaXB5dGhqYWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjE5NzYsImV4cCI6MjA4Njk5Nzk3Nn0.2xdKBZIEkL8hf3gdhDRMzWPnXn2FhM5ZByGsEdXWI-M";

// RENAMED: Changed 'supabase' to 'supabaseClient' to fix the SyntaxError
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions for dates and times
const getTodayDate = () => new Date().toLocaleDateString('en-CA');
const getCurrentTime = () => new Date().toLocaleTimeString('en-GB', { hour12: false }); 

let globalActiveSession = null;

document.addEventListener("DOMContentLoaded", () => {
    fetchDashboardData();
    setInterval(updateLocalClock, 1000); 
    loadTasks();
    fetchWeather();

    document.getElementById("otDate").value = getTodayDate();

    // TIME IN ACTION
    document.getElementById("btnTimeIn").addEventListener("click", async () => {
        if(!confirm("Are you sure you want to Time In now?")) return;
        
        const { error } = await supabaseClient
            .from('attendance_log')
            .insert([{ date_of_attendance: getTodayDate(), time_in: getCurrentTime() }]);

        if (error) alert("Error Timing In: " + error.message);
        else fetchDashboardData();
    });

    // TIME OUT ACTION
    document.getElementById("btnTimeOut").addEventListener("click", async () => {
        if(!confirm("Are you sure you want to Time Out? This will finalize your hours for the day.")) return;
        if(!globalActiveSession) return;

        const timeOutTime = getCurrentTime();
        
        // Calculate Hours
        const startStamp = new Date(`1970-01-01T${globalActiveSession.time_in}Z`).getTime();
        const endStamp = new Date(`1970-01-01T${timeOutTime}Z`).getTime();
        let hoursWorked = (endStamp - startStamp) / 3600000;

        // Break logic and caps
        if (hoursWorked > 5) hoursWorked -= 1;
        if (hoursWorked > 8) hoursWorked = 8;
        if (hoursWorked < 0) hoursWorked = 0;

        const { error } = await supabaseClient
            .from('attendance_log')
            .update({ time_out: timeOutTime, regular_hours: hoursWorked.toFixed(2) })
            .eq('id', globalActiveSession.id);

        if (error) alert("Error Timing Out: " + error.message);
        else fetchDashboardData();
    });

    // OVERTIME DIRECT LOG SUBMISSION
    document.getElementById("otForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const date = document.getElementById("otDate").value;
        const start = document.getElementById("otStart").value;
        const end = document.getElementById("otEnd").value;

        const startStamp = new Date(`1970-01-01T${start}:00Z`).getTime();
        const endStamp = new Date(`1970-01-01T${end}:00Z`).getTime();
        
        if (endStamp <= startStamp) {
            alert("End time must be after Start time.");
            return;
        }

        const hoursRendered = ((endStamp - startStamp) / 3600000).toFixed(2);

        const { error } = await supabaseClient
            .from('overtime_logs')
            .insert([{ date_of_ot: date, time_start: start, time_end: end, hours_rendered: hoursRendered }]);

        if (error) {
            alert("Error saving OT: " + error.message);
        } else {
            document.getElementById("otStart").value = "";
            document.getElementById("otEnd").value = "";
            fetchDashboardData();
        }
    });

    // TO-DO LIST SUBMISSION
    document.getElementById("btnAddTask").addEventListener("click", () => {
        const input = document.getElementById("taskInput");
        if(!input.value.trim()) return;
        
        const tasks = JSON.parse(localStorage.getItem("internTasks")) || [];
        tasks.push({ text: input.value.trim(), done: false });
        localStorage.setItem("internTasks", JSON.stringify(tasks));
        
        input.value = "";
        loadTasks();
    });
});

/* =========================================
   SUPABASE FETCH & RENDER LOGIC
========================================= */
async function fetchDashboardData() {
    try {
        // Fetch Attendance
        const { data: logs, error: logError } = await supabaseClient
            .from('attendance_log')
            .select('*')
            .order('date_of_attendance', { ascending: false });

        // Fetch Overtime
        const { data: otLogs, error: otError } = await supabaseClient
            .from('overtime_logs')
            .select('*')
            .order('date_of_ot', { ascending: false });

        if (logError || otError) throw new Error("Database fetch error");

        // Calculations
        let totalRendered = 0;
        let todayStatus = 'not_started';
        globalActiveSession = null;
        const today = getTodayDate();

        logs.forEach(log => {
            totalRendered += parseFloat(log.regular_hours || 0);
            if (log.date_of_attendance === today) {
                if (!log.time_out) {
                    todayStatus = 'active';
                    globalActiveSession = log;
                } else {
                    todayStatus = 'completed';
                }
            }
        });

        let totalOT = 0;
        otLogs.forEach(ot => totalOT += parseFloat(ot.hours_rendered || 0));

        // Update UI
        updateGoalProgress(totalRendered);
        document.getElementById("uiOvertimeTotal").innerText = `Total OT: ${totalOT.toFixed(2)} hrs`;
        
        renderAttendanceTable(logs);
        renderOTTable(otLogs);
        updateClockButtons(todayStatus, globalActiveSession);

    } catch (error) {
        console.error("Fetch failed:", error);
        document.getElementById("clockStatus").innerText = "DATABASE ERROR";
        document.getElementById("clockStatus").style.color = "red";
    }
}

function updateClockButtons(status, activeSession) {
    const btnIn = document.getElementById("btnTimeIn");
    const btnOut = document.getElementById("btnTimeOut");
    const statusText = document.getElementById("clockStatus");

    btnIn.disabled = true;
    btnOut.disabled = true;

    if (status === 'not_started') {
        statusText.innerText = "READY TO START SHIFT";
        statusText.style.color = "#fff";
        btnIn.disabled = false;
    } else if (status === 'active') {
        statusText.innerText = `CLOCKED IN AT ${formatTime(activeSession.time_in)}`;
        statusText.style.color = "#fff";
        btnOut.disabled = false;
    } else if (status === 'completed') {
        statusText.innerText = "SHIFT COMPLETED FOR TODAY";
        statusText.style.color = "#888"; 
    }
}

// UI RENDERING UTILS
function updateGoalProgress(rendered) {
    const remaining = Math.max(REQUIRED_HOURS - rendered, 0);
    const percent = Math.min((rendered / REQUIRED_HOURS) * 100, 100).toFixed(1);

    document.getElementById("uiTotal").innerText = rendered.toFixed(2) + " hrs";
    document.getElementById("uiRemaining").innerText = remaining.toFixed(2) + " hrs";
    document.getElementById("uiPercent").innerText = percent + "%";
    
    const bar = document.getElementById("progressBar");
    bar.style.width = percent + "%";
    bar.innerText = percent + "%";
}

function renderAttendanceTable(logs) {
    const tbody = document.getElementById("logTableBody");
    tbody.innerHTML = "";
    if(logs.length === 0) { tbody.innerHTML = `<tr><td colspan="4">No logs found</td></tr>`; return; }

    logs.forEach(log => {
        tbody.innerHTML += `
            <tr>
                <td>${log.date_of_attendance}</td>
                <td>${formatTime(log.time_in)}</td>
                <td>${log.time_out ? formatTime(log.time_out) : '<em>Active</em>'}</td>
                <td><strong>${log.time_out ? log.regular_hours : '--'}</strong></td>
            </tr>
        `;
    });
}

function renderOTTable(logs) {
    const tbody = document.getElementById("otTableBody");
    tbody.innerHTML = "";
    if(logs.length === 0) { tbody.innerHTML = `<tr><td colspan="4">No overtime logged</td></tr>`; return; }

    logs.forEach(log => {
        tbody.innerHTML += `
            <tr>
                <td>${log.date_of_ot}</td>
                <td>${formatTime(log.time_start)}</td>
                <td>${formatTime(log.time_end)}</td>
                <td><strong>${log.hours_rendered}</strong></td>
            </tr>
        `;
    });
}

// WIDGETS & FORMATTING
async function fetchWeather() {
    try {
        const url = "https://api.open-meteo.com/v1/forecast?latitude=8.9475&longitude=125.5406&current_weather=true";
        const res = await fetch(url);
        const data = await res.json();
        const temp = data.current_weather.temperature;
        const code = data.current_weather.weathercode;
        
        document.getElementById("weatherTemp").innerText = `${temp}°C`;
        document.getElementById("weatherDesc").innerText = getWeatherText(code);
    } catch (e) {
        document.getElementById("weatherDesc").innerText = "Unavailable";
    }
}

function getWeatherText(code) {
    if(code === 0) return "Clear Sky";
    if(code <= 3) return "Partly Cloudy";
    if(code <= 48) return "Foggy";
    if(code <= 67) return "Rainy";
    if(code <= 77) return "Snowy";
    if(code <= 82) return "Rain Showers";
    if(code >= 95) return "Thunderstorm";
    return "Variable";
}

function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem("internTasks")) || [];
    const list = document.getElementById("taskList");
    list.innerHTML = "";
    if (tasks.length === 0) {
        list.innerHTML = `<li class="list-group-item text-secondary justify-content-center" style="font-size: 0.85rem;">No pending tasks</li>`;
        return;
    }
    tasks.forEach((task, index) => {
        list.innerHTML += `
            <li class="list-group-item">
                <span style="cursor:pointer;" onclick="toggleTask(${index})" class="${task.done ? 'task-done' : ''}">${task.text}</span>
                <button class="btn-del-task" onclick="deleteTask(${index})">&times;</button>
            </li>
        `;
    });
}

window.toggleTask = function(index) {
    const tasks = JSON.parse(localStorage.getItem("internTasks")) || [];
    tasks[index].done = !tasks[index].done;
    localStorage.setItem("internTasks", JSON.stringify(tasks));
    loadTasks();
};

window.deleteTask = function(index) {
    const tasks = JSON.parse(localStorage.getItem("internTasks")) || [];
    tasks.splice(index, 1);
    localStorage.setItem("internTasks", JSON.stringify(tasks));
    loadTasks();
};

function formatTime(timeString) {
    if (!timeString) return '';
    const [hour, minute] = timeString.split(':');
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minute} ${ampm}`;
}

function updateLocalClock() {
    const now = new Date();
    document.getElementById("liveClock").innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
}

/* =========================================
   FLUID BACKGROUND ANIMATION
========================================= */
const canvas = document.getElementById('fluidCanvas');
const ctx = canvas.getContext('2d');

let width, height, time = 0;

// Resize canvas to fill the window
function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Wave configurations
const waves = [
    { amplitude: 120, wavelength: 0.002, speed: 0.015, color: 'rgba(255, 255, 255, 0.05)' },
    { amplitude: 180, wavelength: 0.0015, speed: 0.01, color: 'rgba(255, 255, 255, 0.08)' },
    { amplitude: 80, wavelength: 0.003, speed: 0.02, color: 'rgba(255, 255, 255, 0.15)' },
    { amplitude: 250, wavelength: 0.001, speed: 0.008, color: 'rgba(200, 200, 200, 0.05)' }
];

function animateBackground() {
    // 1. Draw the static diagonal gradient (Black top-left, White bottom-right)
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#000000');
    bgGradient.addColorStop(0.5, '#111111');
    bgGradient.addColorStop(1, '#ffffff');
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw the flowing overlapping waves
    waves.forEach((wave, i) => {
        ctx.beginPath();
        // Start from bottom left
        ctx.moveTo(0, height);
        
        for (let x = 0; x <= width; x += 15) {
            // Calculate a diagonal slope so the waves go from bottom-left to top-right
            let diagonalOffset = (height / width) * x;
            let baseHeight = height - diagonalOffset;
            
            // Add the mathematical sine wave motion
            let y = baseHeight + Math.sin(x * wave.wavelength + time * wave.speed) * wave.amplitude + (i * 40);
            ctx.lineTo(x, y);
        }
        
        // Close the shape to the bottom right and fill it
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        
        ctx.fillStyle = wave.color;
        ctx.fill();
    });

    time++;
    requestAnimationFrame(animateBackground);
}

// Start the animation
animateBackground();
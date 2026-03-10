// reminder.js - Automated Daily Schedule, Accounts, & Local Weather

document.addEventListener('DOMContentLoaded', () => {
    checkPermissions();
    buildDailySchedule();
    initFluidBackground();
    fetchMainWeather(); // Fetch local weather for the main clock
    
    // Start the live clock and auto-strikeout loop
    setInterval(updateClockAndTasks, 1000);
    updateClockAndTasks(); // Run immediately on load
});

// Manage Notification Permissions
function checkPermissions() {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        document.getElementById("permissionAlert").style.display = "block";
    }
    
    document.getElementById("btnAllow")?.addEventListener('click', () => {
        Notification.requestPermission().then(perm => {
            if (perm === "granted") {
                document.getElementById("permissionAlert").style.display = "none";
                buildDailySchedule();
            }
        });
    });
}

// Core Data structure for the Daily Rules & Accounts
const dailyRules = {
    rentals: {
        account: "Main Acc & Butuan Property Hub",
        tasks: [ 
            { time: "07:00", label: "Morning Repost" }, 
            { time: "12:00", label: "Secondary Posting" }, 
            { time: "19:00", label: "Peak Evening" } 
        ]
    },
    houseLot: {
        account: "Business Account",
        tasks: [ 
            { time: "19:00", label: "Peak Evening" } 
        ]
    },
    ofw: {
        account: "Business Account",
        tasks: [ 
            { time: "06:00", label: "Morning Target" }, 
            { time: "22:00", label: "Night Target" } 
        ]
    }
};

// Top 8 OFW Destinations (Cleaned up, no weather data needed here)
const ofwZones = [
    { name: "Saudi Arabia", tz: "Asia/Riyadh" },
    { name: "UAE (Dubai)", tz: "Asia/Dubai" },
    { name: "Qatar", tz: "Asia/Qatar" },
    { name: "Canada (Toronto)", tz: "America/Toronto" },
    { name: "USA (Pacific)", tz: "America/Los_Angeles" },
    { name: "USA (Eastern)", tz: "America/New_York" },
    { name: "UK (London)", tz: "Europe/London" },
    { name: "Singapore / HK", tz: "Asia/Singapore" }
];

// Generates the UI and sets the background alarms
function buildDailySchedule() {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const canNotify = Notification.permission === "granted";

    for (const category in dailyRules) {
        const listUI = document.getElementById(`list-${category}`);
        listUI.innerHTML = ''; 
        
        const targetAccount = dailyRules[category].account;

        dailyRules[category].tasks.forEach(task => {
            const postDate = new Date(`${todayStr}T${task.time}:00`);
            const followUpDate = new Date(postDate.getTime() + 15 * 60000); // +15 mins

            // 1. Inject Tasks into UI
            listUI.innerHTML += createListItem(task.label, postDate, "primary");
            listUI.innerHTML += createListItem("Engage / Check Inquiries", followUpDate, "secondary");

            // 2. Schedule Background Alarms
            if (canNotify) {
                if (postDate > now) {
                    setTimeout(() => triggerNotification(`🚀 Post to: ${targetAccount}`, `${task.label} - Prepare media and post now.`), postDate - now);
                }
                if (followUpDate > now) {
                    setTimeout(() => triggerNotification(`💬 Algorithm Boost (${targetAccount})`, "Check comments and reply to inquiries immediately."), followUpDate - now);
                }
            }
        });
    }
}

function createListItem(label, dateObj, badgeType) {
    const timeText = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const timestamp = dateObj.getTime(); 
    
    return `
        <li class="list-group-item d-flex justify-content-between align-items-center schedule-item py-3 bg-transparent border-secondary" data-time="${timestamp}">
            <span class="fw-bold" style="font-size: 0.9rem;">${label}</span>
            <span class="badge bg-${badgeType === 'primary' ? 'light text-dark' : 'dark border'}">${timeText}</span>
        </li>
    `;
}

// Map Weather Codes to Emojis
function getWeatherEmoji(code) {
    if(code === 0) return "☀️";
    if(code <= 3) return "⛅";
    if(code <= 48) return "🌫️";
    if(code <= 67) return "🌧️";
    if(code <= 77) return "❄️";
    if(code <= 82) return "🌦️";
    if(code >= 95) return "⛈️";
    return "☁️";
}

// Fetch Local PH Weather for the Main Clock
async function fetchMainWeather() {
    try {
        // Using Butuan City coordinates
        const url = "https://api.open-meteo.com/v1/forecast?latitude=8.9475&longitude=125.5406&current_weather=true";
        const res = await fetch(url);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;
        const emoji = getWeatherEmoji(code);
        
        document.getElementById("mainWeather").innerHTML = `${emoji} ${temp}°C <span style="font-size: 0.85rem; color: #777; margin-left: 8px; font-weight: normal;">BUTUAN CITY</span>`;
    } catch (e) {
        document.getElementById("mainWeather").innerHTML = "⚠️ Weather Unavailable";
    }
}

// Live Clock, Auto-Strikethrough, & World Clocks Loop
function updateClockAndTasks() {
    const now = new Date();
    const currentMillis = now.getTime();
    
    // 1. Main PH System Clock
    document.getElementById("liveClock").innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    
    // 2. Scan and strikeout passed tasks
    document.querySelectorAll('.schedule-item').forEach(item => {
        const taskTime = parseInt(item.getAttribute('data-time'));
        if (currentMillis >= taskTime && !item.classList.contains('task-done')) {
            item.classList.add('task-done');
        }
    });

    // 3. Update OFW World Clocks (Cleaned up, no weather)
    let worldClocksHTML = "";
    ofwZones.forEach(zone => {
        const timeString = new Intl.DateTimeFormat('en-US', { 
            timeZone: zone.tz, 
            hour: 'numeric', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        }).format(now);

        worldClocksHTML += `
            <div class="col-md-3 col-sm-4 col-6">
                <div class="world-clock-card rounded d-flex flex-column justify-content-center align-items-center py-3 border-secondary">
                    <div style="font-size: 0.75rem; color: #aaa;" class="text-uppercase mb-2">${zone.name}</div>
                    <div class="fw-bold fs-5 text-white">${timeString}</div>
                </div>
            </div>
        `;
    });
    
    const container = document.getElementById("worldClocksContainer");
    if(container) container.innerHTML = worldClocksHTML;
}

function triggerNotification(title, bodyText) {
    new Notification(title, { body: bodyText, icon: 'favicon.svg' });
}

// Fluid Canvas Background 
function initFluidBackground() {
    const canvas = document.getElementById('fluidCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height, time = 0;

    function resizeCanvas() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
    window.addEventListener('resize', resizeCanvas); resizeCanvas();

    const waves = [
        { amplitude: 120, wavelength: 0.002, speed: 0.015, color: 'rgba(255, 255, 255, 0.05)' },
        { amplitude: 180, wavelength: 0.0015, speed: 0.01, color: 'rgba(255, 255, 255, 0.08)' },
        { amplitude: 80, wavelength: 0.003, speed: 0.02, color: 'rgba(255, 255, 255, 0.15)' },
        { amplitude: 250, wavelength: 0.001, speed: 0.008, color: 'rgba(200, 200, 200, 0.05)' }
    ];

    function animateBackground() {
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#000000'); bgGradient.addColorStop(0.5, '#111111'); bgGradient.addColorStop(1, '#ffffff');
        ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, width, height);

        waves.forEach((wave, i) => {
            ctx.beginPath(); ctx.moveTo(0, height);
            for (let x = 0; x <= width; x += 15) {
                let diagonalOffset = (height / width) * x;
                let y = (height - diagonalOffset) + Math.sin(x * wave.wavelength + time * wave.speed) * wave.amplitude + (i * 40);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath();
            ctx.fillStyle = wave.color; ctx.fill();
        });
        time++; requestAnimationFrame(animateBackground);
    }
    animateBackground();
}
/* ==========================================================================
   AGENDA 2050 - CYBER GATEWAY (login.js) - SUPABASE AUTHENTICATION
   ========================================================================== */

const SUPABASE_URL = 'https://xdynlrghhnxbmcylafxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkeW5scmdoaG54Ym1jeWxhZnhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDcxMzgsImV4cCI6MjA4OTkyMzEzOH0.Zre-Vv5MElN3q6-R804ZrhYxnvEwhB0b3f8_ohFoe3A';

let currentPin = "";
let correctPin = "0000"; // Fallback, falls komplett offline
let isChecking = false;

// 1. Zieht die ECHTE PIN aus der Supabase-Datenbank, sobald die Seite lädt!
async function fetchRealPin() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/systemdaten?id=eq.1&select=pin`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0 && data[0].pin) {
                correctPin = data[0].pin;
                // Speichert die Cloud-PIN direkt lokal ab, falls beim nächsten Mal das Internet weg ist
                localStorage.setItem('appPin', correctPin);
                console.log("SYS_LOG: Cloud-PIN synchronisiert.");
            }
        }
    } catch (e) {
        console.log("SYS_LOG: Cloud nicht erreichbar. Nutze lokalen PIN-Cache.");
        correctPin = localStorage.getItem('appPin') || "0000";
    }
}

// Startet den Cloud-Check direkt
fetchRealPin();

// --- NUMPAD LOGIK ---
function addNumber(num) {
    if (isChecking) return; // Nichts tippen lassen, während er lädt
    
    if (currentPin.length < 4) {
        currentPin += num;
        updateDots();
    }
    if (currentPin.length === 4) {
        checkPin();
    }
}

function clearPin() {
    currentPin = "";
    updateDots();
    const status = document.getElementById('status-text');
    if (status) {
        status.innerText = "AWAITING INPUT...";
        status.style.color = "var(--neon-cyan)";
    }
}

function updateDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
        if (index < currentPin.length) {
            dot.classList.add('active'); // CSS-Klasse muss in deiner login.css existieren (oft background: #fff;)
            dot.style.background = "var(--neon-cyan)";
            dot.style.boxShadow = "0 0 10px var(--neon-cyan)";
        } else {
            dot.classList.remove('active');
            dot.style.background = "rgba(5, 217, 232, 0.2)";
            dot.style.boxShadow = "none";
        }
    });
}

function checkPin() {
    isChecking = true;
    const status = document.getElementById('status-text');
    status.innerText = "AUTHENTICATING...";
    status.style.color = "var(--neon-gold)";
    
    // Kurze Denkpause für das Cyber-Feeling
    setTimeout(() => {
        if (currentPin === correctPin) {
            status.innerText = "ACCESS GRANTED";
            status.style.color = "var(--neon-green)";
            
            // Gibt den goldenen Schlüssel für alle anderen HTML-Seiten
            sessionStorage.setItem('authKey', 'true');
            
            // Animation und Weiterleitung
            setTimeout(() => {
                window.location.href = 'woche.html';
            }, 800);
            
        } else {
            status.innerText = "ACCESS DENIED";
            status.style.color = "var(--neon-red)";
            
            // ERROR-Wackeln
            const pinBox = document.getElementById('pinBox');
            if (pinBox) {
                pinBox.style.transform = "translateX(-10px)";
                setTimeout(() => pinBox.style.transform = "translateX(10px)", 50);
                setTimeout(() => pinBox.style.transform = "translateX(-10px)", 100);
                setTimeout(() => pinBox.style.transform = "translateX(10px)", 150);
                setTimeout(() => pinBox.style.transform = "translateX(0)", 200);
            }
            
            setTimeout(() => {
                clearPin();
                isChecking = false;
            }, 1000);
        }
    }, 600); 
}

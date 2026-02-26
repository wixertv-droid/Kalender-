let enteredPin = "";
let systemPin = localStorage.getItem('appPin') || "0000";

// --- NEU: CLOUD FUNKGERÄT FÜR DEN TÜRSTEHER ---
// Zieht die echte PIN aus der Datenbank, falls der Browser-Cache gelöscht wurde
async function syncPinFromCloud() {
    try {
        const fbApp = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js");
        const fbDb = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        const firebaseConfig = {
            apiKey: "AIzaSyAEUmqJJVTb-6HLJelRavBYX7HYbYgAOk4",
            authDomain: "project-905317930122069871.firebaseapp.com",
            projectId: "project-905317930122069871",
            storageBucket: "project-905317930122069871.firebasestorage.app",
            messagingSenderId: "614371371179",
            appId: "1:614371371179:web:c79cabf95b410b70142fee"
        };

        const app = fbApp.initializeApp(firebaseConfig);
        const db = fbDb.getFirestore(app);
        
        // Fragt direkt den Tresorraum in der Cloud ab
        const docRef = fbDb.doc(db, "agenda2050", "systemdaten");
        const docSnap = await fbDb.getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.pin) {
                systemPin = data.pin; // Überschreibt die 0000 mit der Cloud-PIN
                localStorage.setItem('appPin', systemPin); // Speichert sie wieder lokal
            }
        }
    } catch(e) {
        console.log("Cloud-Verbindung für PIN-Sync fehlgeschlagen (Nutzer offline?)");
    }
}

// Führt den Sync sofort aus, wenn die Login-Seite geöffnet wird
syncPinFromCloud();
// ----------------------------------------------


function addNumber(num) {
    if (enteredPin.length < 4) {
        enteredPin += num;
        updateDots();
    }
    if (enteredPin.length === 4) {
        checkPin();
    }
}

function clearPin() {
    enteredPin = "";
    updateDots();
}

function updateDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
        if (i < enteredPin.length) dot.classList.add('filled');
        else dot.classList.remove('filled');
    });
}

function checkPin() {
    if (enteredPin === systemPin) {
        startBootSequence();
    } else {
        const ring = document.getElementById('cyberRing');
        ring.classList.add('ring-error');
        document.getElementById('status-text').innerText = "ZUGRIFF VERWEIGERT";
        document.getElementById('status-text').style.color = "var(--neon-pink)";
        
        setTimeout(() => {
            ring.classList.remove('ring-error');
            document.getElementById('status-text').innerText = "AWAITING INPUT...";
            document.getElementById('status-text').style.color = "var(--neon-cyan)";
            clearPin();
        }, 1000);
    }
}

function startBootSequence() {
    // PIN Feld ausblenden
    document.getElementById('pinBox').style.display = 'none';
    document.getElementById('numpadBox').style.display = 'none';
    
    // Prozentanzeige einblenden
    const anzeige = document.getElementById('prozent');
    anzeige.style.display = 'block';
    
    document.getElementById('status-text').innerText = "INITIALISIERE...";
    document.getElementById('status-text').style.color = "var(--neon-green)";

    // Session Key setzen (Türsteher-Schutz für den Rest der App)
    sessionStorage.setItem('authKey', 'verified');

    let prozentValue = 0;
    const interval = setInterval(() => {
        prozentValue += Math.floor(Math.random() * 5) + 1; 
        if(prozentValue > 100) prozentValue = 100;
        
        anzeige.innerText = prozentValue + '%';

        if(prozentValue > 30) document.getElementById('status-text').innerText = "Lade Datenbank...";
        if(prozentValue > 70) document.getElementById('status-text').innerText = "Entschlüssele Kalender...";
        
        if(prozentValue === 100) {
            document.getElementById('status-text').innerText = "ZUGRIFF GEWÄHRT";
            clearInterval(interval);
            
            setTimeout(() => {
                window.location.href = 'woche.html';
            }, 1000);
        }
    }, 50);
}

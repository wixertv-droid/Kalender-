let enteredPin = "";
const systemPin = localStorage.getItem('appPin') || "0000";

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
            document.getElementById('status-text').innerText = "SYSTEM GESPERRT";
            document.getElementById('status-text').style.color = "";
            clearPin();
        }, 1000);
    }
}

// HIER STARTET DEIN ALTER LOADER-CODE NACH DER PIN EINGABE
function startBootSequence() {
    // PIN Feld ausblenden
    document.getElementById('pinBox').style.display = 'none';
    document.getElementById('numpadBox').style.display = 'none';
    
    // Prozentanzeige einblenden
    const anzeige = document.getElementById('prozent');
    anzeige.style.display = 'block';
    
    document.getElementById('status-text').innerText = "INITIALISIERE...";
    document.getElementById('status-text').style.color = "var(--neon-green)";

    // Session Key setzen (Türsteher-Schutz)
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

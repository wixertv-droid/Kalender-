/* ==========================================================================
   AGENDA 2050 - ULTIMATIVE ZENTRALE ENGINE (V3.5 - UI & CLICK FIX)
   ========================================================================== */

const DEFAULTS = {
    arbeitsStart: '08:00',
    arbeitsEnde: '22:00',
    wochenstart: 'MO',
    kat1_name: 'VIP', kat1_farbe: '#e5b05c',
    kat2_name: 'Stamm', kat2_farbe: '#ff2a6d',
    kat3_name: 'Neu', kat3_farbe: '#05d9e8',
    plat1: 'WhatsApp', plat2: 'Instagram', plat3: 'Telegram', plat4: 'Telefon'
};

/* ==========================================================================
   >>> FIREBASE CLOUD ANBINDUNG (MAGIC SYNC) <<<
   ========================================================================== */
const firebaseConfig = {
    apiKey: "AIzaSyAEUmqJJVTb-6HLJelRavBYX7HYbYgAOk4",
    authDomain: "project-905317930122069871.firebaseapp.com",
    projectId: "project-905317930122069871",
    storageBucket: "project-905317930122069871.firebasestorage.app",
    messagingSenderId: "614371371179",
    appId: "1:614371371179:web:c79cabf95b410b70142fee"
};

let db, setDoc, doc;
let isSyncingFromCloud = false;

const originalSetItem = localStorage.setItem;

localStorage.setItem = async function(key, value) {
    originalSetItem.call(localStorage, key, value);

    if (isSyncingFromCloud) return;

    if (["appTermine", "appKunden", "appEinstellungen"].includes(key)) {
        if (db && setDoc && doc) {
            try {
                await setDoc(doc(db, "agenda2050", "systemdaten"), {
                    termine: JSON.parse(localStorage.getItem('appTermine') || '[]'),
                    kunden: JSON.parse(localStorage.getItem('appKunden') || '[]'),
                    einstellungen: JSON.parse(localStorage.getItem('appEinstellungen') || '{}')
                }, { merge: true });
                console.log("☁️ Data synced to Cloud");
            } catch(e) { console.error("Cloud Upload Fehler:", e); }
        }
    }
};

async function initCloud() {
    try {
        const fbApp = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js");
        const fbDb = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        
        const app = fbApp.initializeApp(firebaseConfig);
        db = fbDb.getFirestore(app);
        doc = fbDb.doc;
        setDoc = fbDb.setDoc;
        const onSnapshot = fbDb.onSnapshot;

        const hdCountdown = document.getElementById('header-countdown');
        if(hdCountdown) {
            hdCountdown.innerText = "CLOUD CONNECTED";
            hdCountdown.style.color = "var(--neon-green)";
            hdCountdown.style.borderColor = "var(--neon-green)";
            hdCountdown.style.textShadow = "0 0 10px rgba(57, 255, 20, 0.5)";
            
            // FIX: Setzt den Text zurück, damit der Countdown wieder starten kann!
            setTimeout(() => {
                hdCountdown.innerText = "SYNCING...";
                hdCountdown.style.color = "";
                hdCountdown.style.borderColor = "";
                hdCountdown.style.textShadow = "";
                updateLiveSystem(); 
            }, 3000);
        }

        generiereWochenAnsicht();

        onSnapshot(doc(db, "agenda2050", "systemdaten"), (docSnap) => {
            if (docSnap.exists()) {
                isSyncingFromCloud = true; 
                const data = docSnap.data();
                
                if (data.termine) originalSetItem.call(localStorage, 'appTermine', JSON.stringify(data.termine));
                if (data.kunden) originalSetItem.call(localStorage, 'appKunden', JSON.stringify(data.kunden));
                if (data.einstellungen) originalSetItem.call(localStorage, 'appEinstellungen', JSON.stringify(data.einstellungen));
                
                ladeUndWendeEinstellungenAn();
                
                if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht();
                if(typeof renderWeek === 'function') renderWeek();
                if(typeof renderKunden === 'function') renderKunden();
                updateLiveSystem(); 
                
                isSyncingFromCloud = false; 
            }
        });

    } catch(e) {
        console.log("Offline-Modus aktiv (Cloud nicht erreichbar)");
    }
}

/* ==========================================================================
   >>> HILFSFUNKTIONEN FÜR KUGELSICHERE ZEITBERECHNUNG <<<
   ========================================================================== */
function parseTimeStr(timeStr, defaultStr) {
    if (!timeStr || !timeStr.includes(':')) timeStr = defaultStr;
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h)) h = parseInt(defaultStr.split(':')[0], 10);
    if (isNaN(m)) m = parseInt(defaultStr.split(':')[1], 10);
    return h * 60 + m;
}

/* ==========================================================================
   >>> LOKALE FUNKTIONEN (UI & RENDER LOGIK) <<<
   ========================================================================== */

function ladeUndWendeEinstellungenAn() {
    try {
        const gespeicherteDaten = localStorage.getItem('appEinstellungen');
        const settings = gespeicherteDaten ? JSON.parse(gespeicherteDaten) : DEFAULTS;

        const root = document.documentElement;
        root.style.setProperty('--color-kat1', settings.kat1_farbe || DEFAULTS.kat1_farbe);
        root.style.setProperty('--color-kat2', settings.kat2_farbe || DEFAULTS.kat2_farbe);
        root.style.setProperty('--color-kat3', settings.kat3_farbe || DEFAULTS.kat3_farbe);
    } catch (e) { console.error("Fehler in ladeUndWendeEinstellungenAn:", e); }
}

function generiereWochenAnsicht() {
    const container = document.querySelector('.wochen-container');
    if (!container) return; 

    const urlParams = new URLSearchParams(window.location.search);
    let startDatum = new Date();
    if (urlParams.get('d')) startDatum = new Date(urlParams.get('d'));

    let tag = startDatum.getDay();
    let diff = startDatum.getDate() - tag + (tag === 0 ? -6 : 1);
    let montag = new Date(startDatum.setDate(diff));

    const wochentage = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const heute = new Date();
    const heuteISO = new Date(heute.getTime() - (heute.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;
    const aStart = settings.arbeitsStart || "08:00";
    const aEnde = settings.arbeitsEnde || "22:00";
    
    const startMin = parseTimeStr(aStart, "08:00");
    const endeMin = parseTimeStr(aEnde, "22:00");
    
    const viertel = (endeMin - startMin) / 4;
    const q1Min = Math.floor(startMin + viertel);
    const midMin = Math.floor(startMin + viertel * 2);
    const q3Min = Math.floor(startMin + viertel * 3);
    
    const timeStr = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const skalaHTML = `<span>${aStart}</span><span>${timeStr(q1Min)}</span><span>${timeStr(midMin)}</span><span>${timeStr(q3Min)}</span><span>${aEnde}</span>`;

    container.innerHTML = ''; 

    for (let i = 0; i < 7; i++) {
        let aktuellesDatum = new Date(montag);
        aktuellesDatum.setDate(montag.getDate() + i);
        
        let isoDatum = new Date(aktuellesDatum.getTime() - (aktuellesDatum.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        let tagZahl = String(aktuellesDatum.getDate()).padStart(2, '0');
        let monatZahl = String(aktuellesDatum.getMonth() + 1).padStart(2, '0');
        
        let isHeute = (isoDatum === heuteISO) ? 'heute' : '';
        let timelineId = (isoDatum === heuteISO) ? 'id="timeline-heute"' : '';

        if (i === 0 && document.getElementById('header-monat')) {
            const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
            
            const cloudDot = (typeof db !== 'undefined' && db !== null) 
                ? ' <span id="cloud-dot-indicator" style="color: var(--neon-green); font-size: 0.6em; vertical-align: super; text-shadow: 0 0 10px var(--neon-green);" title="Cloud Sync Aktiv">●</span>' 
                : '';
                
            document.getElementById('header-monat').innerHTML = `${monate[aktuellesDatum.getMonth()]} ${aktuellesDatum.getFullYear()}${cloudDot}`;
        }

        // FIX: onclick="..." ist wieder da, damit die Tage klickbar sind!
        container.innerHTML += `
            <div class="tag-zeile ${isHeute}" data-datum="${isoDatum}" onclick="location.href='tag.html?d=${isoDatum}'">
                <div class="tag-header"><span class="tag-name">${wochentage[i]} <small>${tagZahl}.${monatZahl}.</small></span></div>
                <div class="timeline-horizontal" ${timelineId}></div>
                <div class="timeline-skala">${skalaHTML}</div>
            </div>
        `;
    }
}

function openModal() {
    const modal = document.getElementById('terminModal');
    if (!modal) return;

    const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;
    
    const catDropdown = document.getElementById('terminKategorie');
    if (catDropdown) {
        catDropdown.innerHTML = `
            <option value="kat1">${settings.kat1_name || 'VIP'}</option>
            <option value="kat2">${settings.kat2_name || 'Stamm'}</option>
            <option value="kat3">${settings.kat3_name || 'Neu'}</option>
        `;
    }

    const platDropdown = document.getElementById('terminPlattform');
    if (platDropdown) {
        platDropdown.innerHTML = `
            <option value="none">Keine Plattform</option>
            <option value="${settings.plat1 || 'WhatsApp'}">${settings.plat1 || 'WhatsApp'}</option>
            <option value="${settings.plat2 || 'Instagram'}">${settings.plat2 || 'Instagram'}</option>
            <option value="${settings.plat3 || 'Telegram'}">${settings.plat3 || 'Telegram'}</option>
            <option value="${settings.plat4 || 'Telefon'}">${settings.plat4 || 'Telefon'}</option>
        `;
    }

    const nameInput = document.getElementById('terminName');
    if (nameInput) nameInput.value = '';
    const kontaktInput = document.getElementById('terminKontakt');
    if (kontaktInput) kontaktInput.value = '';
    const notizInput = document.getElementById('terminNotizen');
    if (notizInput) notizInput.value = '';
    
    const kontaktContainer = document.getElementById('kontaktContainer');
    if (kontaktContainer) kontaktContainer.style.display = 'none';

    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('terminModal');
    if (modal) modal.style.display = 'none';
    const vBox = document.getElementById('kundenVorschlaege');
    if (vBox) vBox.style.display = 'none';
}

function toggleKontaktFeld() {
    const platSelect = document.getElementById('terminPlattform');
    const container = document.getElementById('kontaktContainer');
    if (platSelect && container) {
        container.style.display = (platSelect.value !== 'none') ? 'block' : 'none';
    }
}

function saveAppointment() {
    try {
        const name = document.getElementById('terminName').value;
        const datum = document.getElementById('terminDatum').value;
        const start = document.getElementById('terminStart').value;
        const ende = document.getElementById('terminEnde').value;
        const kat = document.getElementById('terminKategorie').value;
        const plattform = document.getElementById('terminPlattform').value;
        const kontakt = document.getElementById('terminKontakt').value;
        const notizen = document.getElementById('terminNotizen').value;

        if (!name || !datum || !start || !ende) {
            alert("Bitte alle Pflichtfelder ausfüllen.");
            return;
        }

        let kunden = JSON.parse(localStorage.getItem('appKunden')) || [];
        let kundeGefunden = false;

        if (kontakt && kontakt.trim() !== '') {
            kundeGefunden = kunden.find(k => k.kontakt.trim() === kontakt.trim());
        } else {
            kundeGefunden = kunden.find(k => k.name.toLowerCase() === name.toLowerCase().trim());
        }

        if (!kundeGefunden) {
            const neuerKunde = {
                id: Date.now() + 1, 
                name: name.trim(),
                plattform: plattform !== 'none' ? plattform : '',
                kontakt: kontakt.trim(),
                link: '', preis: '', status: 'none',
                notizen: 'Automatisch durch Termin erstellt.',
                bild1: '', bild2: ''
            };
            kunden.push(neuerKunde);
            localStorage.setItem('appKunden', JSON.stringify(kunden));
        }

        const neuerTermin = {
            id: Date.now(),
            name: name.trim(),
            datum: datum,
            start: start,
            ende: ende,
            kat: kat,
            plattform: plattform,
            kontakt: kontakt,
            notizen: notizen
        };

        let termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        termine.push(neuerTermin);
        localStorage.setItem('appTermine', JSON.stringify(termine));

        closeModal();
        location.reload();
    } catch (e) { console.error("Fehler beim Speichern:", e); }
}

/**
 * 5. LIVE-SYSTEM (GLOBALER COUNTDOWN & ROTE LINIE)
 */
function updateLiveSystem() {
    const containerHeute = document.getElementById('timeline-heute');
    if (containerHeute) {
        const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;
        
        const startMin = parseTimeStr(settings.arbeitsStart, "08:00");
        const endeMin = parseTimeStr(settings.arbeitsEnde, "22:00");
        const gesamtArbeitsMin = endeMin - startMin;

        const jetzt = new Date();
        const aktuelleMinuten = jetzt.getHours() * 60 + jetzt.getMinutes();
        
        let linie = document.getElementById('rote-linie');
        
        if(aktuelleMinuten >= startMin && aktuelleMinuten <= endeMin && gesamtArbeitsMin > 0) {
            const prozentPosition = ((aktuelleMinuten - startMin) / gesamtArbeitsMin) * 100;
            if (!linie) {
                linie = document.createElement('div');
                linie.id = 'rote-linie';
                linie.className = 'jetzt-linie-horizontal';
                containerHeute.appendChild(linie);
            }
            linie.style.left = prozentPosition + '%';
            linie.style.display = 'block';
        } else if (linie) {
            linie.style.display = 'none';
        }
    }

    const countdownElement = document.getElementById('header-countdown');
    if (countdownElement && countdownElement.innerText !== "CLOUD CONNECTED") {
        const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        const jetzt = new Date();
        const jetztTime = jetzt.getTime();
        
        const heuteKalenderTime = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()).getTime();

        let zukuenftigeTermine = termine
            .filter(t => t.datum && t.start)
            .map(t => {
                const parts = t.datum.split('-'); 
                const timeParts = t.start.split(':'); 
                
                const tDate = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]);
                const kalenderTag = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
                
                return { ...t, timestamp: tDate.getTime(), kalenderTag: kalenderTag };
            })
            .filter(t => t.timestamp > jetztTime)
            .sort((a, b) => a.timestamp - b.timestamp);

        if (zukuenftigeTermine.length > 0) {
            const naechster = zukuenftigeTermine[0];
            const diffTage = Math.round((naechster.kalenderTag - heuteKalenderTime) / (1000 * 60 * 60 * 24));

            if (diffTage === 0) {
                const diffMs = naechster.timestamp - jetztTime;
                const diffStunden = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMinuten = Math.floor((diffMs / 1000 / 60) % 60);
                countdownElement.innerText = `HEUTE: ${diffStunden > 0 ? diffStunden + 'H ' : ''}${diffMinuten}M`;
            } else if (diffTage === 1) {
                countdownElement.innerText = `MORGEN ${naechster.start} UHR`;
            } else {
                countdownElement.innerText = `IN ${diffTage} TAGEN`;
            }
        } else {
            countdownElement.innerText = "KEINE TERMINE";
        }
    }
}

function renderWeek() {
    const wochenContainer = document.querySelector('.wochen-container');
    if (!wochenContainer) return;

    const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
    const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;

    const startMin = parseTimeStr(settings.arbeitsStart, "08:00");
    const endeMin = parseTimeStr(settings.arbeitsEnde, "22:00");
    const gesamtArbeitsMin = endeMin - startMin;

    document.querySelectorAll('.termin-segment').forEach(el => el.remove());

    if(gesamtArbeitsMin <= 0) return;

    termine.forEach(t => {
        const tagZeile = document.querySelector(`.tag-zeile[data-datum="${t.datum}"]`);
        if (tagZeile) {
            const timeline = tagZeile.querySelector('.timeline-horizontal');
            if (timeline && t.start && t.ende) {
                const tStartMin = parseTimeStr(t.start, "00:00");
                const tEndeMin = parseTimeStr(t.ende, "23:59");

                if (tEndeMin > startMin && tStartMin < endeMin) {
                    let anzeigeStart = tStartMin < startMin ? startMin : tStartMin;
                    let anzeigeEnde = tEndeMin > endeMin ? endeMin : tEndeMin;
                    let anzeigeDauer = anzeigeEnde - anzeigeStart;

                    const linksPosition = ((anzeigeStart - startMin) / gesamtArbeitsMin) * 100;
                    const breite = (anzeigeDauer / gesamtArbeitsMin) * 100;

                    const segment = document.createElement('div');
                    segment.className = `termin-segment ${t.kat}`;
                    segment.style.left = linksPosition + '%';
                    segment.style.width = (breite < 0.5 ? 0.5 : breite) + '%';
                    
                    const katName = settings[t.kat + "_name"] || "Termin";
                    segment.innerHTML = `<span class="status-label">${katName}</span>`;
                    
                    timeline.appendChild(segment);
                }
            }
        }
    });
}

/**
 * 8. INITIALISIERUNG
 */
document.addEventListener('DOMContentLoaded', () => {
    ladeUndWendeEinstellungenAn();
    generiereWochenAnsicht(); 
    renderWeek();             
    updateLiveSystem();
    setInterval(updateLiveSystem, 60000);

    initCloud();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
            reg.update();
        }).catch(err => console.log('SW Fehler:', err));
    }

    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 400);
});

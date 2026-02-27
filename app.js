/* ==========================================================================
   AGENDA 2050 - ULTIMATIVE ZENTRALE ENGINE (V4.9 - CLOUD STABILITY UPDATE)
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

let currentEditId = null; 

/* ==========================================================================
   >>> FIREBASE CLOUD ANBINDUNG (STABLE MAGIC SYNC) <<<
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
let syncTimeout = null; 

const originalSetItem = localStorage.setItem;

localStorage.setItem = function(key, value) {
    originalSetItem.call(localStorage, key, value);

    if (isSyncingFromCloud) return;

    if (["appTermine", "appKunden", "appEinstellungen", "appPin"].includes(key)) {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
            if (db && setDoc && doc) {
                try {
                    await setDoc(doc(db, "agenda2050", "systemdaten"), {
                        termine: JSON.parse(localStorage.getItem('appTermine') || '[]'),
                        kunden: JSON.parse(localStorage.getItem('appKunden') || '[]'),
                        einstellungen: JSON.parse(localStorage.getItem('appEinstellungen') || '{}'),
                        pin: localStorage.getItem('appPin') || "0000" 
                    }, { merge: true });
                    console.log("☁️ Cloud Upload (gebündelt) erfolgreich!");
                } catch(e) { console.error("Cloud Upload Fehler:", e); }
            }
        }, 150); 
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
            
            setTimeout(() => {
                hdCountdown.innerText = "SYNCING...";
                hdCountdown.style.color = "";
                hdCountdown.style.borderColor = "";
                hdCountdown.style.textShadow = "";
                updateLiveSystem(); 
            }, 3000);
        }

        onSnapshot(doc(db, "agenda2050", "systemdaten"), (docSnap) => {
            if (docSnap.exists()) {
                isSyncingFromCloud = true; 
                const data = docSnap.data();
                
                if (data.termine) originalSetItem.call(localStorage, 'appTermine', JSON.stringify(data.termine));
                if (data.kunden) originalSetItem.call(localStorage, 'appKunden', JSON.stringify(data.kunden));
                if (data.einstellungen) originalSetItem.call(localStorage, 'appEinstellungen', JSON.stringify(data.einstellungen));
                if (data.pin) originalSetItem.call(localStorage, 'appPin', data.pin);
                
                ladeUndWendeEinstellungenAn();
                
                if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht();
                if(typeof renderWeek === 'function') renderWeek();
                if(typeof renderKunden === 'function') renderKunden();
                
                if(typeof renderTimeline === 'function') {
                    const urlParams = new URLSearchParams(window.location.search);
                    let d = urlParams.get('d');
                    if(!d) {
                        const heute = new Date();
                        d = new Date(heute.getTime() - (heute.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    }
                    renderTimeline(d);
                }

                updateLiveSystem(); 
                isSyncingFromCloud = false; 
            }
        });

    } catch(e) {
        console.log("Offline-Modus aktiv (Cloud nicht erreichbar)");
    }
}

function parseTimeStr(timeStr, defaultStr) {
    if (!timeStr || !timeStr.includes(':')) timeStr = defaultStr;
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h)) h = parseInt(defaultStr.split(':')[0], 10);
    if (isNaN(m)) m = parseInt(defaultStr.split(':')[1], 10);
    return h * 60 + m;
}

function getArbeitsZeiten(settings) {
    let startMin = parseTimeStr(settings.arbeitsStart, "08:00");
    let endeMin = parseTimeStr(settings.arbeitsEnde, "22:00");
    
    if (settings.arbeitsEnde === "00:00" || endeMin === 0) endeMin = 1440;
    
    if (endeMin <= startMin) endeMin = startMin + 60; 
    return { startMin, endeMin, gesamtArbeitsMin: endeMin - startMin };
}

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
    
    const zeiten = getArbeitsZeiten(settings);
    const startMin = zeiten.startMin;
    const endeMin = zeiten.endeMin;
    
    const viertel = zeiten.gesamtArbeitsMin / 4;
    const q1Min = Math.floor(startMin + viertel);
    const midMin = Math.floor(startMin + viertel * 2);
    const q3Min = Math.floor(startMin + viertel * 3);
    
    const timeStr = (m) => {
        let h = Math.floor(m / 60);
        let min = m % 60;
        if (h === 24) return `00:${String(min).padStart(2, '0')}`;
        return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
    };
    
    const skalaHTML = `<span>${settings.arbeitsStart}</span><span>${timeStr(q1Min)}</span><span>${timeStr(midMin)}</span><span>${timeStr(q3Min)}</span><span>${settings.arbeitsEnde}</span>`;

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

        container.innerHTML += `
            <div class="tag-zeile ${isHeute}" data-datum="${isoDatum}" style="cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;" onclick="window.location.href='tag.html?d=${isoDatum}'">
                <div class="tag-header"><span class="tag-name">${wochentage[i]} <small>${tagZahl}.${monatZahl}.</small></span></div>
                <div class="timeline-horizontal" ${timelineId} style="background-image: repeating-linear-gradient(to right, transparent, transparent 24.8%, rgba(255,255,255,0.06) 25%); overflow: visible;"></div>
                <div class="timeline-skala">${skalaHTML}</div>
            </div>
        `;
    }
}

function openModal(editId = null) {
    const modal = document.getElementById('terminModal');
    if (!modal) return;

    currentEditId = editId;

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

    if (editId) {
        const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        const t = termine.find(x => x.id === editId);
        if (t) {
            document.getElementById('terminName').value = t.name || '';
            document.getElementById('terminDatum').value = t.datum || '';
            document.getElementById('terminStart').value = t.start || '';
            document.getElementById('terminEnde').value = t.ende || '';
            document.getElementById('terminKategorie').value = t.kat || 'kat1';
            document.getElementById('terminPlattform').value = t.plattform || 'none';
            document.getElementById('terminKontakt').value = t.kontakt || '';
            document.getElementById('terminNotizen').value = t.notizen || '';
            
            // NEU: Werte laden, falls Element existiert
            if(document.getElementById('terminPreis')) document.getElementById('terminPreis').value = t.preis || '';
            if(document.getElementById('terminPraeferenz')) document.getElementById('terminPraeferenz').value = t.praeferenz || 'none';
        }
    } else {
        document.getElementById('terminName').value = '';
        document.getElementById('terminKontakt').value = '';
        document.getElementById('terminNotizen').value = '';
        document.getElementById('terminStart').value = '';
        document.getElementById('terminEnde').value = '';
        
        // NEU: Werte zurücksetzen
        if(document.getElementById('terminPreis')) document.getElementById('terminPreis').value = '';
        if(document.getElementById('terminPraeferenz')) document.getElementById('terminPraeferenz').value = 'none';
    }

    const kontaktContainer = document.getElementById('kontaktContainer');
    if (kontaktContainer) {
        const pValue = document.getElementById('terminPlattform').value;
        kontaktContainer.style.display = (pValue !== 'none') ? 'block' : 'none';
    }

    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('terminModal');
    if (modal) modal.style.display = 'none';
    const vBox = document.getElementById('kundenVorschlaege');
    if (vBox) vBox.style.display = 'none';
    currentEditId = null;
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
        
        // NEU: Werte aus dem Formular ziehen (mit Fallback, falls das Feld fehlt)
        const preisInput = document.getElementById('terminPreis');
        const praefInput = document.getElementById('terminPraeferenz');
        const preis = preisInput ? preisInput.value : '';
        const praeferenz = praefInput ? praefInput.value : 'none';

        if (!name || !datum || !start || !ende) {
            alert("Bitte alle Pflichtfelder ausfüllen.");
            return;
        }

        let termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        
        let nStartMin = parseTimeStr(start, "00:00");
        let nEndeMin = parseTimeStr(ende, "23:59");
        if (ende === "00:00" || nEndeMin === 0) nEndeMin = 1440; 
        
        const overlap = termine.find(t => {
            if (t.datum === datum && t.id !== currentEditId) {
                let eStartMin = parseTimeStr(t.start, "00:00");
                let eEndeMin = parseTimeStr(t.ende, "23:59");
                if (t.ende === "00:00" || eEndeMin === 0) eEndeMin = 1440; 
                return (nStartMin < eEndeMin && nEndeMin > eStartMin);
            }
            return false;
        });

        if (overlap) {
            alert(`⚠️ DOPPELBUCHUNG VERHINDERT!\n\nDu hast zur selben Zeit bereits den Termin "${overlap.name}" (${overlap.start} - ${overlap.ende} Uhr).\nBitte ändere die Zeit.`);
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
                preis: preis,           // NEU: Direkt in neues Profil übernehmen
                praeferenz: praeferenz, // NEU: Direkt in neues Profil übernehmen
                link: '', status: 'none',
                notizen: 'Automatisch durch Termin erstellt.',
                bild1: '', bild2: ''
            };
            kunden.push(neuerKunde);
            localStorage.setItem('appKunden', JSON.stringify(kunden));
        } else {
            // NEU: AUTO-SYNC! Wenn der Kunde existiert, aber noch keinen Preis/Präferenz hat, übernimm es aus dem Termin.
            let kIndex = kunden.findIndex(k => k.id === kundeGefunden.id);
            let updated = false;
            if (preis && (!kunden[kIndex].preis || kunden[kIndex].preis === '')) {
                kunden[kIndex].preis = preis;
                updated = true;
            }
            if (praeferenz !== 'none' && (!kunden[kIndex].praeferenz || kunden[kIndex].praeferenz === 'none')) {
                kunden[kIndex].praeferenz = praeferenz;
                updated = true;
            }
            if (updated) {
                localStorage.setItem('appKunden', JSON.stringify(kunden));
            }
        }

        if (currentEditId) {
            const index = termine.findIndex(t => t.id === currentEditId);
            if(index > -1) {
                termine[index].name = name.trim();
                termine[index].datum = datum;
                termine[index].start = start;
                termine[index].ende = ende;
                termine[index].kat = kat;
                termine[index].plattform = plattform;
                termine[index].kontakt = kontakt;
                termine[index].notizen = notizen;
                termine[index].preis = preis;           // NEU
                termine[index].praeferenz = praeferenz; // NEU
            }
            currentEditId = null; 
        } else {
            const neuerTermin = {
                id: Date.now(),
                name: name.trim(),
                datum: datum,
                start: start,
                ende: ende,
                kat: kat,
                plattform: plattform,
                kontakt: kontakt,
                notizen: notizen,
                preis: preis,           // NEU
                praeferenz: praeferenz  // NEU
            };
            termine.push(neuerTermin);
        }

        localStorage.setItem('appTermine', JSON.stringify(termine));
        closeModal();
        
        if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht();
        if(typeof renderWeek === 'function') renderWeek();
        
        if(typeof renderTimeline === 'function') {
            const urlParams = new URLSearchParams(window.location.search);
            let d = urlParams.get('d');
            if(!d) {
                const heute = new Date();
                d = new Date(heute.getTime() - (heute.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            }
            renderTimeline(d);
        }

        updateLiveSystem();
        
    } catch (e) { console.error("Fehler beim Speichern:", e); }
}

function updateLiveSystem() {
    const containerHeute = document.getElementById('timeline-heute');
    if (containerHeute) {
        const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;
        
        const zeiten = getArbeitsZeiten(settings);
        const startMin = zeiten.startMin;
        const endeMin = zeiten.endeMin;
        const gesamtArbeitsMin = zeiten.gesamtArbeitsMin;

        const jetzt = new Date();
        const aktuelleMinuten = jetzt.getHours() * 60 + jetzt.getMinutes();
        
        const hStr = String(jetzt.getHours()).padStart(2, '0');
        const mStr = String(jetzt.getMinutes()).padStart(2, '0');
        const uhrzeit = `${hStr}:${mStr}`;
        
        let linie = document.getElementById('rote-linie');
        
        let anzeigeMinuten = aktuelleMinuten;
        let feierabendText = "";
        
        if (aktuelleMinuten < startMin) {
            anzeigeMinuten = startMin;
            feierabendText = " (Vorher)";
        } else if (aktuelleMinuten > endeMin) {
            anzeigeMinuten = endeMin;
            feierabendText = " (Feierabend)";
        }
        
        const prozentPosition = ((anzeigeMinuten - startMin) / gesamtArbeitsMin) * 100;
        
        if (!linie) {
            linie = document.createElement('div');
            linie.id = 'rote-linie';
            linie.className = 'jetzt-linie-horizontal';
            containerHeute.appendChild(linie);
        }
        
        linie.innerHTML = `<div style="position: absolute; top: -26px; left: -16px; background: var(--bg-deep, #0a0a0d); color: white; font-size: 0.75rem; font-weight: bold; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--neon-pink, #ff2a6d); box-shadow: 0 0 10px rgba(255, 42, 109, 0.6); z-index: 50; white-space: nowrap;">${uhrzeit}${feierabendText}</div>`;
        linie.style.left = prozentPosition + '%';
        linie.style.display = 'block';
        
        if (feierabendText !== "") {
            linie.style.opacity = '0.6';
        } else {
            linie.style.opacity = '1';
        }
    }

    const countdownElement = document.getElementById('header-countdown');
    if (countdownElement && countdownElement.innerText !== "CLOUD CONNECTED") {
        const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        const jetzt = new Date();
        const jetztTime = jetzt.getTime();
        
        const heuteKalenderTime = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()).getTime();

        let zukuenftigeTermine = termine
            .filter(t => t && t.datum && t.start && typeof t.start === 'string' && t.start.includes(':'))
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

    const zeiten = getArbeitsZeiten(settings);
    const startMin = zeiten.startMin;
    const endeMin = zeiten.endeMin;
    const gesamtArbeitsMin = zeiten.gesamtArbeitsMin;

    document.querySelectorAll('.termin-segment').forEach(el => el.remove());

    if(gesamtArbeitsMin <= 0) return;

    termine.forEach(t => {
        if (!t || !t.datum || !t.start || !t.ende || !t.start.includes(':') || !t.ende.includes(':')) return;

        const tagZeile = document.querySelector(`.tag-zeile[data-datum="${t.datum}"]`);
        if (tagZeile) {
            const timeline = tagZeile.querySelector('.timeline-horizontal');
            if (timeline) {
                try {
                    let tStartMin = parseTimeStr(t.start, "00:00");
                    let tEndeMin = parseTimeStr(t.ende, "23:59");
                    if (t.ende === "00:00" || tEndeMin === 0) tEndeMin = 1440; 

                    let anzeigeStart = tStartMin;
                    let anzeigeEnde = tEndeMin;
                    let isOutsideLeft = false;
                    let isOutsideRight = false;

                    if (tEndeMin <= startMin) {
                        anzeigeStart = startMin;
                        anzeigeEnde = startMin + (gesamtArbeitsMin * 0.05); 
                        isOutsideLeft = true;
                    } else if (tStartMin >= endeMin) {
                        anzeigeStart = endeMin - (gesamtArbeitsMin * 0.05);
                        anzeigeEnde = endeMin;
                        isOutsideRight = true;
                    } else {
                        if (anzeigeStart < startMin) { anzeigeStart = startMin; isOutsideLeft = true; }
                        if (anzeigeEnde > endeMin) { anzeigeEnde = endeMin; isOutsideRight = true; }
                    }

                    let anzeigeDauer = anzeigeEnde - anzeigeStart;
                    if (anzeigeDauer < (gesamtArbeitsMin * 0.03)) anzeigeDauer = gesamtArbeitsMin * 0.03;

                    const linksPosition = ((anzeigeStart - startMin) / gesamtArbeitsMin) * 100;
                    const breite = (anzeigeDauer / gesamtArbeitsMin) * 100;

                    const segment = document.createElement('div');
                    const safeKat = t.kat || 'kat1';
                    segment.className = `termin-segment ${safeKat}`;
                    segment.style.left = linksPosition + '%';
                    segment.style.width = (breite < 0.5 ? 0.5 : breite) + '%';
                    
                    if (isOutsideLeft || isOutsideRight) {
                        segment.style.opacity = '0.5';
                    }
                    
                    const katName = settings[safeKat + "_name"] || "Termin";
                    
                    let timeText = `${t.start} - ${t.ende}`;
                    if(isOutsideLeft) timeText = `<< ${timeText}`;
                    if(isOutsideRight) timeText = `${timeText} >>`;
                    
                    segment.innerHTML = `
                        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; pointer-events: none; overflow: hidden; padding: 0 2px;">
                            <span class="status-label" style="margin-bottom: 2px;">${katName}</span>
                            <span style="font-size: 0.6rem; font-weight: bold; background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 4px; white-space: nowrap;">${timeText}</span>
                        </div>
                    `;
                    
                    timeline.appendChild(segment);
                } catch (e) {
                    console.error("Fehler beim Malen des Blocks:", e);
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (!sessionStorage.getItem('authKey')) {
        window.location.href = 'index.html';
        return; 
    }

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

        const heuteZeile = document.querySelector('.tag-zeile.heute');
        if (heuteZeile) {
            heuteZeile.scrollIntoView({ behavior: 'smooth', block: 'center' });
            heuteZeile.style.transition = "background-color 0.8s ease-out";
            heuteZeile.style.backgroundColor = "rgba(5, 217, 232, 0.15)";
            setTimeout(() => {
                heuteZeile.style.backgroundColor = "transparent";
            }, 1200);
        }
    }, 600); 
});

/* ==========================================================================
   AGENDA 2050 - ULTIMATIVE ZENTRALE ENGINE (V2.1 - DYNAMISCHE ARBEITSZEIT)
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

/**
 * 1. EINSTELLUNGEN LADEN & ANWENDEN
 */
function ladeUndWendeEinstellungenAn() {
    try {
        const gespeicherteDaten = localStorage.getItem('appEinstellungen');
        const settings = gespeicherteDaten ? JSON.parse(gespeicherteDaten) : DEFAULTS;

        const root = document.documentElement;
        root.style.setProperty('--color-kat1', settings.kat1_farbe || DEFAULTS.kat1_farbe);
        root.style.setProperty('--color-kat2', settings.kat2_farbe || DEFAULTS.kat2_farbe);
        root.style.setProperty('--color-kat3', settings.kat3_farbe || DEFAULTS.kat3_farbe);
    } catch (e) {
        console.error("Fehler in ladeUndWendeEinstellungenAn:", e);
    }
}

/**
 * 2. WOCHENANSICHT DYNAMISCH GENERIEREN (inkl. neuer Zeitskala)
 */
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

    // Skala aus Arbeitszeit berechnen
    const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;
    const aStart = settings.arbeitsStart || "08:00";
    const aEnde = settings.arbeitsEnde || "22:00";
    
    const startMin = parseInt(aStart.split(':')[0]) * 60 + parseInt(aStart.split(':')[1]);
    const endeMin = parseInt(aEnde.split(':')[0]) * 60 + parseInt(aEnde.split(':')[1]);
    
    // Viertel-Schritte berechnen
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
        
        // Robustes ISO Format
        let isoDatum = new Date(aktuellesDatum.getTime() - (aktuellesDatum.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        let tagZahl = String(aktuellesDatum.getDate()).padStart(2, '0');
        let monatZahl = String(aktuellesDatum.getMonth() + 1).padStart(2, '0');
        
        let isHeute = (isoDatum === heuteISO) ? 'heute' : '';
        let timelineId = (isoDatum === heuteISO) ? 'id="timeline-heute"' : '';

        if (i === 0 && document.getElementById('header-monat')) {
            const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
            document.getElementById('header-monat').innerText = `${monate[aktuellesDatum.getMonth()]} ${aktuellesDatum.getFullYear()}`;
        }

        container.innerHTML += `
            <div class="tag-zeile ${isHeute}" data-datum="${isoDatum}" onclick="location.href='tag.html?d=${isoDatum}'">
                <div class="tag-header"><span class="tag-name">${wochentage[i]} <small>${tagZahl}.${monatZahl}.</small></span></div>
                <div class="timeline-horizontal" ${timelineId}></div>
                <div class="timeline-skala">${skalaHTML}</div>
            </div>
        `;
    }
}

/**
 * 3. MODAL STEUERUNG
 */
function openModal() {
    const modal = document.getElementById('terminModal');
    if (!modal) return;

    const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;
    
    const catDropdown = document.getElementById('terminKategorie');
    if (catDropdown) {
        catDropdown.innerHTML = `
            <option value="kat1">${settings.kat1_name}</option>
            <option value="kat2">${settings.kat2_name}</option>
            <option value="kat3">${settings.kat3_name}</option>
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

/**
 * 4. TERMIN SPEICHERN & AUTO-KUNDEN-ANLAGE
 */
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
            alert("Bitte alle Pflichtfelder (Name, Datum, Zeit) ausfüllen.");
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
    } catch (e) {
        console.error("Fehler beim Speichern:", e);
    }
}

/**
 * 5. LIVE-SYSTEM (Rote Linie) - Dynamisch nach Arbeitszeit
 */
function updateLiveSystem() {
    const containerHeute = document.getElementById('timeline-heute');
    if (containerHeute) {
        const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;
        const aStart = settings.arbeitsStart || "08:00";
        const aEnde = settings.arbeitsEnde || "22:00";
        
        const startMin = parseInt(aStart.split(':')[0]) * 60 + parseInt(aStart.split(':')[1]);
        const endeMin = parseInt(aEnde.split(':')[0]) * 60 + parseInt(aEnde.split(':')[1]);
        const gesamtArbeitsMin = endeMin - startMin;

        const jetzt = new Date();
        const aktuelleMinuten = jetzt.getHours() * 60 + jetzt.getMinutes();
        
        let linie = document.getElementById('rote-linie');
        
        // Nur anzeigen, wenn wir in der Arbeitszeit sind!
        if(aktuelleMinuten >= startMin && aktuelleMinuten <= endeMin) {
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
    if (countdownElement) {
        const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        const heute = new Date();
        const heuteISO = new Date(heute.getTime() - (heute.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const jetztTotalMin = heute.getHours() * 60 + heute.getMinutes();

        let baldigeTermine = termine
            .filter(t => t.datum === heuteISO)
            .map(t => {
                const s = t.start.split(':');
                return { ...t, startInMin: (parseInt(s[0]) || 0) * 60 + (parseInt(s[1]) || 0) };
            })
            .filter(t => t.startInMin > jetztTotalMin)
            .sort((a, b) => a.startInMin - b.startInMin);

        if (baldigeTermine.length > 0) {
            const naechster = baldigeTermine[0];
            const diff = naechster.startInMin - jetztTotalMin;
            const h = Math.floor(diff / 60);
            const m = diff % 60;
            countdownElement.innerText = `NÄCHSTER: ${h > 0 ? h + 'H ' : ''}${m}M`;
        } else {
            countdownElement.innerText = "KEINE TERMINE";
        }
    }
}

/**
 * 6. WOCHENPLAN RENDERN - Dynamisch nach Arbeitszeit
 */
function renderWeek() {
    const wochenContainer = document.querySelector('.wochen-container');
    if (!wochenContainer) return;

    const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
    const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;

    const aStart = settings.arbeitsStart || "08:00";
    const aEnde = settings.arbeitsEnde || "22:00";
    const startMin = parseInt(aStart.split(':')[0]) * 60 + parseInt(aStart.split(':')[1]);
    const endeMin = parseInt(aEnde.split(':')[0]) * 60 + parseInt(aEnde.split(':')[1]);
    const gesamtArbeitsMin = endeMin - startMin;

    document.querySelectorAll('.termin-segment').forEach(el => el.remove());

    termine.forEach(t => {
        const tagZeile = document.querySelector(`.tag-zeile[data-datum="${t.datum}"]`);
        if (tagZeile) {
            const timeline = tagZeile.querySelector('.timeline-horizontal');
            if (timeline) {
                const startArray = t.start.split(':');
                const tStartMin = parseInt(startArray[0]) * 60 + parseInt(startArray[1]);
                const endeArray = t.ende.split(':');
                const tEndeMin = parseInt(endeArray[0]) * 60 + parseInt(endeArray[1]);

                // Nur Termine anzeigen, die irgendwie in die Arbeitszeit fallen
                if (tEndeMin > startMin && tStartMin < endeMin) {
                    
                    // Termine "kappen", falls sie vor/nach der Arbeitszeit liegen
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
 * 7. INITIALISIERUNG BEIM START & PWA SETUP
 */
document.addEventListener('DOMContentLoaded', () => {
    ladeUndWendeEinstellungenAn();
    generiereWochenAnsicht(); 
    renderWeek();             
    updateLiveSystem();
    setInterval(updateLiveSystem, 60000);

    // ROBUSTER PWA SERVICE WORKER (FÜR GITHUB PAGES)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then(reg => console.log('System bereit (Offline-Mode aktiv)'))
            .catch(err => console.log('Offline-System Fehler:', err));
    }

    // SICHERHEITS-LOADER
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 400);
});
       

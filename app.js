/* ==========================================================================
   AGENDA 2050 - ULTIMATIVE ZENTRALE ENGINE (PWA READY)
   ========================================================================== */

const DEFAULTS = {
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

        if (document.getElementById('kat1_name')) {
            document.getElementById('kat1_name').value = settings.kat1_name || DEFAULTS.kat1_name;
            document.getElementById('kat1_farbe').value = settings.kat1_farbe || DEFAULTS.kat1_farbe;
            document.getElementById('kat2_name').value = settings.kat2_name || DEFAULTS.kat2_name;
            document.getElementById('kat2_farbe').value = settings.kat2_farbe || DEFAULTS.kat2_farbe;
            document.getElementById('kat3_name').value = settings.kat3_name || DEFAULTS.kat3_name;
            document.getElementById('kat3_farbe').value = settings.kat3_farbe || DEFAULTS.kat3_farbe;
            
            document.getElementById('plat1_name').value = settings.plat1 || DEFAULTS.plat1;
            document.getElementById('plat2_name').value = settings.plat2 || DEFAULTS.plat2;
            document.getElementById('plat3_name').value = settings.plat3 || DEFAULTS.plat3;
            document.getElementById('plat4_name').value = settings.plat4 || DEFAULTS.plat4;

            const toggle = document.getElementById('wochenstartToggle');
            if (toggle) toggle.checked = (settings.wochenstart === 'SO');
        }

        const wochenContainer = document.querySelector('.wochen-container');
        if (wochenContainer) {
            const zeilen = document.querySelectorAll('.tag-zeile');
            if (zeilen.length === 7) {
                const sonntag = zeilen[6]; 
                sonntag.style.order = (settings.wochenstart === 'SO') ? "-1" : "7";
            }
        }
    } catch (e) {
        console.error("Fehler in ladeUndWendeEinstellungenAn:", e);
    }
}

/**
 * 2. MODAL STEUERUNG (Öffnen, Schließen, Felder umschalten)
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
            <option value="${settings.plat1}">${settings.plat1}</option>
            <option value="${settings.plat2}">${settings.plat2}</option>
            <option value="${settings.plat3}">${settings.plat3}</option>
            <option value="${settings.plat4}">${settings.plat4}</option>
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
 * 3. TERMIN SPEICHERN & AUTOMATISCHE KUNDEN-ANLAGE
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

        // KUNDEN-DATENBANK AUTO-SYNC
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
                link: '',
                preis: '',
                status: 'none',
                notizen: 'Automatisch durch Termin erstellt.',
                bild1: '',
                bild2: ''
            };
            kunden.push(neuerKunde);
            localStorage.setItem('appKunden', JSON.stringify(kunden));
        }

        // TERMIN SPEICHERN
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
        console.error("Fehler beim Speichern des Termins:", e);
    }
}

/**
 * 4. LIVE-SYSTEM (Woche)
 */
function updateLiveSystem() {
    const containerHeute = document.getElementById('timeline-heute');
    if (containerHeute) {
        const jetzt = new Date();
        const aktuelleMinuten = jetzt.getHours() * 60 + jetzt.getMinutes();
        const prozentPosition = (aktuelleMinuten / 1440) * 100;
        
        let linie = document.getElementById('rote-linie');
        if (!linie) {
            linie = document.createElement('div');
            linie.id = 'rote-linie';
            linie.className = 'jetzt-linie-horizontal';
            containerHeute.appendChild(linie);
        }
        linie.style.left = prozentPosition + '%';
    }

    const countdownElement = document.getElementById('header-countdown');
    if (countdownElement) {
        const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        const jetzt = new Date();
        const heuteISO = jetzt.toISOString().split('T')[0];
        const jetztTotalMin = jetzt.getHours() * 60 + jetzt.getMinutes();

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
 * 5. WOCHENPLAN RENDERN
 */
function renderWeek() {
    const wochenContainer = document.querySelector('.wochen-container');
    if (!wochenContainer) return;

    const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
    const settings = JSON.parse(localStorage.getItem('appEinstellungen')) || DEFAULTS;

    document.querySelectorAll('.termin-segment').forEach(el => el.remove());

    termine.forEach(t => {
        const tagZeile = document.querySelector(`.tag-zeile[data-datum="${t.datum}"]`);
        if (tagZeile) {
            const timeline = tagZeile.querySelector('.timeline-horizontal');
            if (timeline) {
                const startArray = t.start.split(':');
                const startMinuten = parseInt(startArray[0]) * 60 + parseInt(startArray[1]);
                const endeArray = t.ende.split(':');
                const endeMinuten = parseInt(endeArray[0]) * 60 + parseInt(endeArray[1]);
                const dauerInMinuten = endeMinuten - startMinuten;

                if (dauerInMinuten > 0) {
                    const linksPosition = (startMinuten / 1440) * 100;
                    const breite = (dauerInMinuten / 1440) * 100;

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
 * 6. INITIALISIERUNG BEIM START & PWA SETUP
 */
document.addEventListener('DOMContentLoaded', () => {
    ladeUndWendeEinstellungenAn();
    renderWeek();
    updateLiveSystem();
    setInterval(updateLiveSystem, 60000);

    // PWA Service Worker anmelden (Macht die App installierbar)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Fehler:', err));
    }

    // SICHERHEITS-LOADER (Verschwindet immer)
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 800);
});

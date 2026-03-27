/* ==========================================================================
   AGENDA 2050 - EVENT & PROMO ENGINE (events.js)
   ========================================================================== */

let currentEditEventId = null;
let currentGuests = [];

function renderEvents() {
    const container = document.getElementById('eventListe');
    if (!container) return;
    
    container.innerHTML = '';
    let events = JSON.parse(localStorage.getItem('appEvents')) || [];
    
    if (events.length === 0) {
        container.innerHTML = '<div style="color: #666; text-align: center; margin-top: 50px; font-family: monospace;">KEINE EVENTS GEFUNDEN</div>';
        return;
    }

    events.sort((a, b) => new Date(a.datum) - new Date(b.datum));

    events.forEach(e => {
        const angemeldet = e.guests ? e.guests.filter(g => g.status === 'angemeldet').length : 0;
        const bestaetigt = e.guests ? e.guests.filter(g => g.status === 'bestaetigt').length : 0;
        const erschienen = e.guests ? e.guests.filter(g => g.status === 'erschienen').length : 0;
        
        const isPast = new Date(e.datum) < new Date(new Date().setHours(0,0,0,0));
        const opacity = isPast ? '0.6' : '1';
        
        let dateStr = "TBA";
        if(e.datum) {
            const dObj = new Date(e.datum);
            dateStr = dObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        const anzeigeOrt = e.stadt || e.ort || 'TBA';

        container.innerHTML += `
            <div class="event-card" style="border-left-color: ${e.color || '#ff3300'}; opacity: ${opacity};" onclick="openEventDashboard(${e.id})">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: ${e.color || '#ff3300'}; margin-bottom: 8px;">${e.name}</div>
                </div>
                
                <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                    <div class="stat-badge" style="border-color: #aaa; color: #aaa;">📝 ${angemeldet} Angemeldet</div>
                    <div class="stat-badge" style="border-color: var(--neon-cyan); color: var(--neon-cyan);">👍 ${bestaetigt} Bestätigt</div>
                    <div class="stat-badge" style="border-color: var(--neon-green); color: var(--neon-green);">✅ ${erschienen} Da</div>
                </div>

                <div style="color: #aaa; font-size: 0.85rem; margin-top: 5px;">📅 ${dateStr} | ⏰ ${e.start} - ${e.ende} Uhr</div>
                <div style="color: #888; font-size: 0.8rem; margin-top: 5px;">📍 ${anzeigeOrt} | 💦 ${e.praef}</div>
            </div>
        `;
    });
}

function openEventDashboard(id) {
    currentEditEventId = id;
    const events = JSON.parse(localStorage.getItem('appEvents')) || [];
    const e = events.find(x => x.id === id);
    
    if(e) {
        document.getElementById('dashEventName').innerText = e.name;
        document.getElementById('dashEventName').style.color = e.color || '#ff3300';
        document.getElementById('dashEventDate').innerText = `${e.datum} | ${e.start} Uhr`;
        
        currentGuests = e.guests || [];
        updateDashboardStats();
        renderGuests();
        
        document.getElementById('eventDashboardModal').style.display = 'flex';
    }
}

function closeEventDashboard() {
    document.getElementById('eventDashboardModal').style.display = 'none';
    currentEditEventId = null;
}

function updateDashboardStats() {
    const total = currentGuests.length;
    const angemeldet = currentGuests.filter(g => g.status === 'angemeldet').length;
    const bestaetigt = currentGuests.filter(g => g.status === 'bestaetigt').length;
    const erschienen = currentGuests.filter(g => g.status === 'erschienen').length;
    const noshow = currentGuests.filter(g => g.status === 'noshow').length;
    
    document.getElementById('dashStatTotal').innerText = `👥 ${total} Gesamt`;
    document.getElementById('dashStatErschienen').innerText = `✅ ${erschienen} Da`;
    document.getElementById('dashStatNoshow').innerText = `❌ ${noshow} No-Show`;

    const events = JSON.parse(localStorage.getItem('appEvents')) || [];
    const e = events.find(x => x.id === currentEditEventId);
    const preis = e && e.preis ? parseFloat(e.preis) : 0;
    
    const aktuellerUmsatz = erschienen * preis;
    const potenzialUmsatz = (angemeldet + bestaetigt + erschienen) * preis; 
    
    const umsatzEl = document.getElementById('dashUmsatz');
    const potEl = document.getElementById('dashPotUmsatz');
    if (umsatzEl) umsatzEl.innerText = `${aktuellerUmsatz} €`;
    if (potEl) potEl.innerText = `Potenzial: ${potenzialUmsatz} €`;

    const chartBox = document.getElementById('dashGuestChart');
    if (chartBox) {
        const max = total > 0 ? total : 1;
        const pctAngemeldet = (angemeldet / max) * 100;
        const pctBestaetigt = (bestaetigt / max) * 100;
        const pctErschienen = (erschienen / max) * 100;
        const pctNoshow = (noshow / max) * 100;

        chartBox.innerHTML = `
            <div style="margin-bottom: 10px;">
                <div style="display:flex; justify-content: space-between; font-size: 0.75rem; color: #aaa; margin-bottom: 4px;"><span>Angemeldet (${angemeldet})</span></div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${pctAngemeldet}%; height: 100%; background: #aaa; transition: width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1);"></div>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="display:flex; justify-content: space-between; font-size: 0.75rem; color: var(--neon-cyan); margin-bottom: 4px;"><span>Bestätigt (${bestaetigt})</span></div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${pctBestaetigt}%; height: 100%; background: var(--neon-cyan); box-shadow: 0 0 8px var(--neon-cyan); transition: width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1);"></div>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="display:flex; justify-content: space-between; font-size: 0.75rem; color: var(--neon-green); margin-bottom: 4px;"><span>Erschienen (${erschienen})</span></div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${pctErschienen}%; height: 100%; background: var(--neon-green); box-shadow: 0 0 8px var(--neon-green); transition: width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1);"></div>
                </div>
            </div>
            <div style="margin-bottom: 5px;">
                <div style="display:flex; justify-content: space-between; font-size: 0.75rem; color: var(--neon-red); margin-bottom: 4px;"><span>No-Show (${noshow})</span></div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${pctNoshow}%; height: 100%; background: var(--neon-red); box-shadow: 0 0 8px var(--neon-red); transition: width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1);"></div>
                </div>
            </div>
        `;
    }
}

// --- 3. EVENT SETUP & BEARBEITEN ---
function openEventSetup(isNew = false) {
    document.getElementById('promoBox').innerText = "Klicke auf Generieren...";
    
    if (!isNew && currentEditEventId) {
        const events = JSON.parse(localStorage.getItem('appEvents')) || [];
        const e = events.find(x => x.id === currentEditEventId);
        if(e) {
            document.getElementById('evName').value = e.name || '';
            document.getElementById('evDatum').value = e.datum || '';
            document.getElementById('evStart').value = e.start || '';
            document.getElementById('evEnde').value = e.ende || '';
            document.getElementById('evColor').value = e.color || '#ff3300';
            document.getElementById('evStadt').value = e.stadt || e.ort || '';
            document.getElementById('evLocation').value = e.location || '';
            document.getElementById('evPreis').value = e.preis || '';
            
            document.getElementById('evGirlName').value = e.gName || '';
            document.getElementById('evGirlAge').value = e.gAge || '';
            document.getElementById('evGirlHeight').value = e.gHeight || '';
            document.getElementById('evGirlWeight').value = e.gWeight || '';
            document.getElementById('evGirlType').value = e.gType || '';
            
            document.getElementById('evVorlieben').value = e.vorlieben || '';
            document.getElementById('evTabus').value = e.tabus || '';
            document.getElementById('evNS').value = e.ns || 'Nein';
            document.getElementById('evVideo').value = e.video || 'Keine';
            document.getElementById('evBilder').value = e.bilder || 'Ja';
            document.getElementById('evPraef').value = e.praef || 'AO';
            
            document.getElementById('btnDelete').style.display = 'block';
        }
    } else {
        currentEditEventId = null;
        currentGuests = [];
        document.getElementById('evName').value = 'GB';
        const heute = new Date();
        document.getElementById('evDatum').value = new Date(heute.getTime() - (heute.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        document.getElementById('evStart').value = '11:00';
        document.getElementById('evEnde').value = '14:00';
        document.getElementById('evColor').value = '#ff3300';
        document.getElementById('evStadt').value = 'Leipzig';
        document.getElementById('evLocation').value = 'Hotel / Privat';
        document.getElementById('evPreis').value = '80';
        
        document.getElementById('evGirlName').value = 'Susi';
        document.getElementById('evGirlAge').value = '35';
        document.getElementById('evGirlHeight').value = '165';
        document.getElementById('evGirlWeight').value = '64';
        document.getElementById('evGirlType').value = 'Schlanke und naturgeile Dreilochstute';
        
        document.getElementById('evVorlieben').value = 'GV, anal, lecken, fingern, blasen, in Mund spritzen, schlucken, harter Sex, Körperbesamung';
        document.getElementById('evTabus').value = 'Keine Schmerzen/Gewalt, kein KV';
        document.getElementById('evNS').value = 'einzeln, passiv und aktiv in der Dusche möglich';
        document.getElementById('evVideo').value = 'macht sie auch gerne NS-Videos, entweder einzeln oder wo sie von mehreren angepisst wird. Dies einfach vor Ort ansprechen. (Auch mit Maske möglich, ansonsten würden auch keine Gesichter gefilmt werden).';
        document.getElementById('evBilder').value = 'Ja';
        document.getElementById('evPraef').value = 'AO';
        
        document.getElementById('btnDelete').style.display = 'none';
    }
    
    document.getElementById('eventDashboardModal').style.display = 'none';
    document.getElementById('eventSetupModal').style.display = 'flex';
}

function closeEventSetup() { 
    document.getElementById('eventSetupModal').style.display = 'none'; 
    if(currentEditEventId) {
        document.getElementById('eventDashboardModal').style.display = 'flex';
    }
}

// --- PROMO GENERATOR (Verbessert, heiß und grammatikalisch perfekt) ---
function generatePromo() {
    const name = document.getElementById('evName').value || 'Event';
    const datum = document.getElementById('evDatum').value;
    const start = document.getElementById('evStart').value;
    const ende = document.getElementById('evEnde').value;
    const stadt = document.getElementById('evStadt').value || 'Leipzig';
    const location = document.getElementById('evLocation').value || 'wird privat mitgeteilt';
    
    const gName = document.getElementById('evGirlName').value || 'Susi';
    const gAge = document.getElementById('evGirlAge').value || '35';
    const gHeight = document.getElementById('evGirlHeight').value || '165';
    const gWeight = document.getElementById('evGirlWeight').value || '64';
    const gType = document.getElementById('evGirlType').value || 'schlanke und naturgeile Dreilochstute';

    const vorlieben = document.getElementById('evVorlieben').value || 'Alles was Spaß macht';
    const tabus = document.getElementById('evTabus').value || 'Keine Schmerzen/Gewalt';
    const preis = document.getElementById('evPreis').value || '80';
    const praef = document.getElementById('evPraef').value || 'AO';
    const towels = document.getElementById('evTowels').value || 'Werden gestellt';
    
    const nsOpt = document.getElementById('evNS').value;
    const vidOpt = document.getElementById('evVideo').value;
    const bilderOpt = document.getElementById('evBilder').value;
    
    let dateStr = "TBA";
    let weekdayStr = "";
    if (datum) {
        const dObj = new Date(datum);
        const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        weekdayStr = days[dObj.getDay()];
        const dd = String(dObj.getDate()).padStart(2, '0');
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        dateStr = `${dd}.${mm}.`;
    }

    // Titel
    let text = `🔥 *${name.toUpperCase()} IN ${stadt.toUpperCase()}* 🔥\n\n`;
    
    // Begrüßung & Info
    text += `Hallo ihr Lieben, hier ist eure ${gName}! 💋\n`;
    text += `Ich bin eine ${gType} (${gAge} Jahre, ${gHeight} cm, ${gWeight} kg) und veranstalte am ${weekdayStr}, den ${dateStr} von ${start} bis ${ende} Uhr mein Event "${name}" in ${stadt} (Location: ${location}).\n\n`;
    
    text += `Ich bin schon richtig feucht und kann es kaum erwarten, es mit euch extrem versaut krachen zu lassen! 😈💦\n\n`;
    
    // Details
    text += `💦 *Gewollt:* ${vorlieben}\n`;
    if (nsOpt !== 'Nein') {
        text += `🚿 *Natursekt:* ${nsOpt}\n`;
    }
    if (vidOpt !== 'Keine') {
        text += `📸 *Videos:* Optional ${vidOpt}\n`;
    }
    
    text += `🚫 *Tabus:* ${tabus}\n`;
    text += `💊 *Safe / AO:* ${praef}\n`;
    text += `💸 *Kosten:* ${preis} € p.P.\n`;
    text += `🧖‍♀️ *Handtücher:* ${towels}\n`;
    
    // Abschluss
    if (bilderOpt === 'Ja') {
        text += `\nHeiße Bilder von mir schicke ich euch bei Interesse sehr gerne auf Anfrage! 😏\n`;
    }
    
    text += `\nDie Plätze sind streng limitiert. Wenn du dabei sein und mich vernaschen willst, melde dich schnell verbindlich bei mir. Ich freue mich extrem auf dich! 🔥🔞`;
    
    document.getElementById('promoBox').innerText = text;
}

function copyPromo() {
    const text = document.getElementById('promoBox').innerText;
    if(text === "Klicke auf Generieren...") return;
    navigator.clipboard.writeText(text).then(() => alert("✅ Promo-Text kopiert!"));
}

// --- GÄSTE LOGIK (Live Save & Test Abbuchung) ---
function autoSaveGuests() {
    if (!currentEditEventId) return;
    let events = JSON.parse(localStorage.getItem('appEvents')) || [];
    let evIndex = events.findIndex(e => e.id === currentEditEventId);
    if (evIndex > -1) {
        events[evIndex].guests = currentGuests;
        localStorage.setItem('appEvents', JSON.stringify(events)); 
        renderEvents(); 
    }
}

function renderGuests() {
    const list = document.getElementById('gaesteListe');
    list.innerHTML = '';
    
    if(currentGuests.length === 0) {
        list.innerHTML = '<div style="color:#666; font-size:0.8rem; text-align:center;">Noch keine Gäste eingetragen.</div>';
        return;
    }

    currentGuests.forEach(g => {
        let statusColor = '#aaa';
        let actionBtns = '';
        
        if(g.status === 'angemeldet') {
            statusColor = '#aaa';
            actionBtns = `<button class="btn-status" style="border-color: var(--neon-cyan); color: var(--neon-cyan);" onclick="changeGuestStatus('${g.id}', 'bestaetigt')">Bestätigen</button>`;
        } else if(g.status === 'bestaetigt') {
            statusColor = 'var(--neon-cyan)';
            actionBtns = `
                <button class="btn-status" style="border-color: var(--neon-green); color: var(--neon-green);" onclick="changeGuestStatus('${g.id}', 'erschienen')">✓ Da</button>
                <button class="btn-status" style="border-color: var(--neon-red); color: var(--neon-red);" onclick="changeGuestStatus('${g.id}', 'noshow')">❌ No-Show</button>
            `;
        } else if(g.status === 'erschienen') {
            statusColor = 'var(--neon-green)';
            actionBtns = `
                <span style="color: var(--neon-green); font-size: 0.8rem; font-weight: bold; margin-right: 5px;">✓ Erschienen</span>
                <button class="btn-status" style="color: #666; border-color: #666; padding: 2px 5px; font-size: 0.6rem;" onclick="changeGuestStatus('${g.id}', 'noshow')">Storno</button>
            `;
        } else if(g.status === 'noshow') {
            statusColor = 'var(--neon-red)';
            actionBtns = `<span style="color: var(--neon-red); font-size: 0.8rem; font-weight: bold; margin-right: 5px;">❌ No-Show</span>`;
        }

        list.innerHTML += `
            <div class="attendee-row att-status-${g.status}">
                <div style="flex-grow: 1;">
                    <div style="color: #fff; font-weight: bold; font-size: 0.9rem;">${g.name}</div>
                    <div style="color: ${statusColor}; font-size: 0.7rem; text-transform: uppercase;">${g.status}</div>
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    ${actionBtns}
                    <button class="btn-status" style="color: #ff2a6d; border-color: #ff2a6d; padding: 5px; margin-left: 5px;" onclick="removeGuest('${g.id}')">🗑️</button>
                </div>
            </div>
        `;
    });
}

function addGuest() {
    const input = document.getElementById('newGuestName');
    if(!input.value.trim()) return;
    
    currentGuests.push({
        id: Date.now().toString(),
        name: input.value.trim(),
        status: 'angemeldet' 
    });
    
    input.value = '';
    updateDashboardStats();
    renderGuests();
    autoSaveGuests(); 
}

function changeGuestStatus(id, newStatus) {
    const guest = currentGuests.find(g => g.id === id);
    if(guest) {
        const oldStatus = guest.status;
        guest.status = newStatus;
        
        // --- INVENTAR ABBUCHUNG (Nur wenn AO im Dropdown gewählt ist) ---
        const events = JSON.parse(localStorage.getItem('appEvents')) || [];
        const ev = events.find(x => x.id === currentEditEventId);
        const isAO = ev && ev.praef && ev.praef.toLowerCase().includes('ao');

        if (isAO) {
            let settings = JSON.parse(localStorage.getItem('appEinstellungen')) || {};
            let bestand = parseInt(settings.testBestand) || 0;
            let changed = false;

            // Abziehen
            if (oldStatus !== 'erschienen' && newStatus === 'erschienen') {
                bestand = Math.max(0, bestand - 1);
                changed = true;
            } 
            // Zurückbuchen
            else if (oldStatus === 'erschienen' && newStatus !== 'erschienen') {
                bestand += 1;
                changed = true;
            }

            if (changed) {
                settings.testBestand = bestand;
                localStorage.setItem('appEinstellungen', JSON.stringify(settings)); 
            }
        }

        updateDashboardStats();
        renderGuests();
        autoSaveGuests(); 
    }
}

function removeGuest(id) {
    if(confirm("Gast wirklich entfernen?")) {
        currentGuests = currentGuests.filter(g => g.id !== id);
        updateDashboardStats();
        renderGuests();
        autoSaveGuests(); 
    }
}

// --- EVENT SPEICHERN & LÖSCHEN ---
function saveEvent() {
    const name = document.getElementById('evName').value;
    const datum = document.getElementById('evDatum').value;
    
    if(!name || !datum) {
        alert("Name und Datum sind Pflichtfelder!");
        return;
    }

    let events = JSON.parse(localStorage.getItem('appEvents')) || [];
    
    const data = {
        id: currentEditEventId || Date.now(),
        name: name,
        datum: datum,
        start: document.getElementById('evStart').value,
        ende: document.getElementById('evEnde').value,
        color: document.getElementById('evColor').value,
        stadt: document.getElementById('evStadt').value,
        location: document.getElementById('evLocation').value,
        preis: document.getElementById('evPreis').value,
        
        gName: document.getElementById('evGirlName').value,
        gAge: document.getElementById('evGirlAge').value,
        gHeight: document.getElementById('evGirlHeight').value,
        gWeight: document.getElementById('evGirlWeight').value,
        gType: document.getElementById('evGirlType').value,
        
        ns: document.getElementById('evNS').value,
        video: document.getElementById('evVideo').value,
        bilder: document.getElementById('evBilder').value,
        vorlieben: document.getElementById('evVorlieben').value,
        tabus: document.getElementById('evTabus').value,
        praef: document.getElementById('evPraef').value,
        towels: document.getElementById('evTowels').value,
        
        guests: currentGuests
    };

    if (currentEditEventId) {
        events = events.map(e => e.id === currentEditEventId ? data : e);
    } else {
        events.push(data);
    }

    localStorage.setItem('appEvents', JSON.stringify(events));
    
    document.getElementById('eventSetupModal').style.display = 'none';
    renderEvents();
}

function deleteEvent() {
    if (!currentEditEventId) return;
    
    if (confirm("🚨 EVENT WIRKLICH LÖSCHEN? Dieser Vorgang kann nicht rückgängig gemacht werden!")) {
        let events = JSON.parse(localStorage.getItem('appEvents')) || [];
        events = events.filter(e => e.id !== currentEditEventId);
        
        localStorage.setItem('appEvents', JSON.stringify(events));
        
        document.getElementById('eventSetupModal').style.display = 'none';
        renderEvents();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderEvents();
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 400);
});

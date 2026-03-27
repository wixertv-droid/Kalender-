/* ==========================================================================
   AGENDA 2050 - EVENT & PROMO ENGINE (events.js)
   ========================================================================== */

let currentEditEventId = null;
let currentGuests = [];

// --- 1. HAUPTANSICHT RENDERN ---
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
        // Exakte Status-Zählung für die Startseite
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
                <div style="color: #888; font-size: 0.8rem; margin-top: 5px;">📍 ${e.ort || 'TBA'} | 💦 ${e.praef}</div>
            </div>
        `;
    });
}

// --- 2. GÄSTE DASHBOARD ---
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
    
    // Header Stats
    document.getElementById('dashStatTotal').innerText = `👥 ${total} Gesamt`;
    document.getElementById('dashStatErschienen').innerText = `✅ ${erschienen} Da`;
    document.getElementById('dashStatNoshow').innerText = `❌ ${noshow} No-Show`;

    // Finanz-Berechnung
    const events = JSON.parse(localStorage.getItem('appEvents')) || [];
    const e = events.find(x => x.id === currentEditEventId);
    const preis = e && e.preis ? parseFloat(e.preis) : 0;
    
    const aktuellerUmsatz = erschienen * preis;
    // Potenzial = Alle, die nicht abgesagt haben oder No-Show sind
    const potenzialUmsatz = (angemeldet + bestaetigt + erschienen) * preis; 
    
    const umsatzEl = document.getElementById('dashUmsatz');
    const potEl = document.getElementById('dashPotUmsatz');
    if (umsatzEl) umsatzEl.innerText = `${aktuellerUmsatz} €`;
    if (potEl) potEl.innerText = `Potenzial: ${potenzialUmsatz} €`;

    // Mini-Balkendiagramm zeichnen
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
            document.getElementById('evOrt').value = e.ort || '';
            document.getElementById('evPreis').value = e.preis || '';
            document.getElementById('evPraef').value = e.praef || 'AO';
            document.getElementById('evTowels').value = e.towels || 'Werden gestellt';
            document.getElementById('evBeschreibung').value = e.beschreibung || '';
            document.getElementById('evVorlieben').value = e.vorlieben || '';
            document.getElementById('evTabus').value = e.tabus || '';
            document.getElementById('btnDelete').style.display = 'block';
        }
    } else {
        currentEditEventId = null;
        currentGuests = [];
        document.getElementById('evName').value = '';
        const heute = new Date();
        document.getElementById('evDatum').value = new Date(heute.getTime() - (heute.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        document.getElementById('evStart').value = '14:00';
        document.getElementById('evEnde').value = '18:00';
        document.getElementById('evColor').value = '#ff3300';
        document.getElementById('evOrt').value = '';
        document.getElementById('evPreis').value = '';
        document.getElementById('evPraef').value = 'AO';
        document.getElementById('evTowels').value = 'Werden gestellt';
        document.getElementById('evBeschreibung').value = '';
        document.getElementById('evVorlieben').value = '';
        document.getElementById('evTabus').value = '';
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

// --- PROMO GENERATOR ---
function generatePromo() {
    const name = document.getElementById('evName').value || 'Heißes Event';
    const datum = document.getElementById('evDatum').value;
    const start = document.getElementById('evStart').value;
    const ende = document.getElementById('evEnde').value;
    const ort = document.getElementById('evOrt').value || 'Wird privat mitgeteilt';
    const preis = document.getElementById('evPreis').value || '?';
    const praef = document.getElementById('evPraef').value;
    const towels = document.getElementById('evTowels').value;
    const beschreibung = document.getElementById('evBeschreibung').value;
    const vorlieben = document.getElementById('evVorlieben').value || '-';
    const tabus = document.getElementById('evTabus').value || '-';
    
    let dateStr = "TBA";
    if (datum) {
        const dObj = new Date(datum);
        dateStr = dObj.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    let text = `🔥 *EXKLUSIVES EVENT: ${name}* 🔥\n\n📅 *Wann:* ${dateStr}\n⏰ *Uhrzeit:* ${start} - ${ende} Uhr\n📍 *Wo:* ${ort}\n💸 *Beitrag:* ${preis}€ p.P.\n💦 *Typ:* ${praef}\n🚿 *Handtücher:* ${towels}\n`;
    
    if (beschreibung) text += `\n📝 *Infos:*\n${beschreibung}\n`;
    
    text += `\n✅ *Programm / Vorlieben:*\n${vorlieben}\n\n🚫 *Tabus:*\n${tabus}\n\nBegrenzte Plätze! Melde dich jetzt verbindlich an. Ich freue mich auf dich! 😈`;
    
    document.getElementById('promoBox').innerText = text;
}

function copyPromo() {
    const text = document.getElementById('promoBox').innerText;
    if(text === "Klicke auf Generieren...") return;
    navigator.clipboard.writeText(text).then(() => alert("✅ Promo-Text kopiert!"));
}

// --- GÄSTE LOGIK (Live Save) ---
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
            actionBtns = `<span style="color: var(--neon-green); font-size: 0.8rem; font-weight: bold; margin-right: 5px;">✓ Erschienen</span>`;
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
        guest.status = newStatus;
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
        ort: document.getElementById('evOrt').value,
        preis: document.getElementById('evPreis').value,
        praef: document.getElementById('evPraef').value,
        towels: document.getElementById('evTowels').value,
        beschreibung: document.getElementById('evBeschreibung').value,
        vorlieben: document.getElementById('evVorlieben').value,
        tabus: document.getElementById('evTabus').value,
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

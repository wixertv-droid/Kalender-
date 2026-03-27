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
        // Deine bevorzugte Original-Optik
        const confirmed = e.guests ? e.guests.filter(g => g.status === 'bestaetigt' || g.status === 'erschienen').length : 0;
        
        // Vergangene Events leicht abdunkeln
        const isPast = new Date(e.datum) < new Date(new Date().setHours(0,0,0,0));
        const opacity = isPast ? '0.6' : '1';
        
        // Wenn das Datum formatiert werden soll
        let dateStr = "TBA";
        if(e.datum) {
            const dObj = new Date(e.datum);
            dateStr = dObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        container.innerHTML += `
            <div class="event-card" style="border-left-color: ${e.color || '#ff3300'}; opacity: ${opacity};" onclick="openEventDashboard(${e.id})">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: ${e.color || '#ff3300'}">${e.name}</div>
                    <div class="stat-badge" style="border-color: ${e.color || '#ff3300'}; color: ${e.color || '#ff3300'};">${confirmed} Zusagen</div>
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
    const erschienen = currentGuests.filter(g => g.status === 'erschienen').length;
    const noshow = currentGuests.filter(g => g.status === 'noshow').length;
    
    document.getElementById('dashStatTotal').innerText = `👥 ${total} Anmeldungen`;
    document.getElementById('dashStatErschienen').innerText = `✅ ${erschienen} Da`;
    document.getElementById('dashStatNoshow').innerText = `❌ ${noshow} No-Show`;
}

// --- 3. EVENT SETUP & BEARBEITEN ---
function openEventSetup(isNew = false) {
    document.getElementById('promoBox').innerText = "Klicke auf Generieren...";
    
    if (!isNew && currentEditEventId) {
        // Bestehendes Event bearbeiten
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
        // Neues Event anlegen
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
        document.getElementById('eventDashboardModal').style.display = 'flex'; // Zurück zum Dashboard
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

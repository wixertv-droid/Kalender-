/* ==========================================================================
   AGENDA 2050 - EVENT & PROMO ENGINE (events.js)
   ========================================================================== */

let currentEditEventId = null;
let currentGuests = [];

function renderEvents() {
    const container = document.getElementById('eventListe');
    if (!container) return;
    
    container.innerHTML = '';
    let events = [];
    try {
        events = JSON.parse(localStorage.getItem('appEvents')) || [];
    } catch(e) { console.error("Event DB Error", e); }
    
    if (events.length === 0) {
        container.innerHTML = '<div style="color: #666; text-align: center; margin-top: 50px; font-family: monospace;">KEINE EVENTS GEFUNDEN</div>';
        return;
    }

    // Sortieren: Zukünftige zuerst
    events.sort((a, b) => new Date(a.datum) - new Date(b.datum));

    events.forEach(e => {
        // --- NEU: Gästestatistik berechnen ---
        const total = e.guests ? e.guests.length : 0;
        const erschienen = e.guests ? e.guests.filter(g => g.status === 'erschienen').length : 0;
        const noshow = e.guests ? e.guests.filter(g => g.status === 'noshow').length : 0;
        
        const d = new Date(e.datum);
        const datumStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const isPast = d < new Date(new Date().setHours(0,0,0,0));
        const opacity = isPast ? '0.5' : '1';
        const border = e.color || '#ff3300';

        container.innerHTML += `
            <div class="finance-card" style="margin-bottom: 15px; border-left: 4px solid ${border}; opacity: ${opacity}; cursor: pointer;" onclick="openEventModal(${e.id})">
                <button class="btn-delete-kunde" onclick="event.stopPropagation(); deleteEvent(${e.id})" style="position: absolute; right: 10px; top: 10px; background: rgba(255,42,109,0.1); color: #ff2a6d; border: 1px solid #ff2a6d; border-radius: 5px; width: 30px; height: 30px; cursor: pointer; z-index: 10; display: flex; justify-content: center; align-items: center;">✖</button>
                
                <div style="font-size: 1.2rem; font-weight: bold; color: ${border}; margin-bottom: 8px; padding-right: 35px;">${e.name}</div>
                
                <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                    <div class="stat-badge" style="border-color: #aaa; color: #fff;">👥 ${total} Anmeldungen</div>
                    <div class="stat-badge" style="border-color: var(--neon-green); color: var(--neon-green);">✅ ${erschienen} Da</div>
                    <div class="stat-badge" style="border-color: var(--neon-red); color: var(--neon-red);">❌ ${noshow} No-Show</div>
                </div>
                
                <div style="display: flex; gap: 15px; font-size: 0.85rem; color: #aaa; margin-bottom: 10px; font-family: monospace;">
                    <span style="color: var(--neon-cyan);">📅 ${datumStr} | ⏰ ${e.start} - ${e.ende}</span>
                    ${e.ort ? `<span style="color: var(--neon-gold);">📍 ${e.ort}</span>` : ''}
                </div>
                
                ${e.notizen ? `<div style="font-size: 0.85rem; color: #888; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px; line-height: 1.4;">${e.notizen}</div>` : ''}
            </div>
        `;
    });
}

function openEventModal(id = null) {
    currentEditEventId = id;
    document.getElementById('promoBox').innerText = "Klicke auf Generieren...";
    
    if (id) {
        const events = JSON.parse(localStorage.getItem('appEvents')) || [];
        const e = events.find(x => x.id === id);
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
            document.getElementById('evVorlieben').value = e.vorlieben || '';
            document.getElementById('evTabus').value = e.tabus || '';
            currentGuests = e.guests || [];
            document.getElementById('btnDelete').style.display = 'block';
            document.getElementById('gaesteSektion').style.display = 'block';
        }
    } else {
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
        document.getElementById('evVorlieben').value = '';
        document.getElementById('evTabus').value = '';
        currentGuests = [];
        document.getElementById('btnDelete').style.display = 'none';
        document.getElementById('gaesteSektion').style.display = 'none'; // Gäste erst nach dem Speichern sichtbar
    }
    renderGuests();
    document.getElementById('eventModal').style.display = 'flex';
}

function closeEventModal() { 
    document.getElementById('eventModal').style.display = 'none'; 
    currentEditEventId = null;
}

function generatePromo() {
    const name = document.getElementById('evName').value || 'Heißes Event';
    const datum = document.getElementById('evDatum').value;
    const start = document.getElementById('evStart').value;
    const ende = document.getElementById('evEnde').value;
    const ort = document.getElementById('evOrt').value || 'Wird privat mitgeteilt';
    const preis = document.getElementById('evPreis').value || '?';
    const praef = document.getElementById('evPraef').value;
    const towels = document.getElementById('evTowels').value;
    const vorlieben = document.getElementById('evVorlieben').value || '-';
    const tabus = document.getElementById('evTabus').value || '-';
    
    let dateStr = "TBA";
    if (datum) {
        const dObj = new Date(datum);
        dateStr = dObj.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    const text = `🔥 *EXKLUSIVES EVENT: ${name}* 🔥\n\n📅 *Wann:* ${dateStr}\n⏰ *Uhrzeit:* ${start} - ${ende} Uhr\n📍 *Wo:* ${ort}\n💸 *Beitrag:* ${preis}€ p.P.\n💦 *Typ:* ${praef}\n🚿 *Handtücher:* ${towels}\n\n✅ *Programm / Vorlieben:*\n${vorlieben}\n\n🚫 *Tabus:*\n${tabus}\n\nBegrenzte Plätze! Melde dich jetzt verbindlich an. Ich freue mich auf dich! 😈`;
    
    document.getElementById('promoBox').innerText = text;
}

function copyPromo() {
    const text = document.getElementById('promoBox').innerText;
    if(text === "Klicke auf Generieren...") return;
    navigator.clipboard.writeText(text).then(() => alert("✅ Promo-Text kopiert!"));
}

// --- NEU: AUTO-SAVE FÜR GÄSTE ---
// Speichert Gästelisten-Änderungen sofort im Hintergrund
function autoSaveGuests() {
    if (!currentEditEventId) return;
    let events = JSON.parse(localStorage.getItem('appEvents')) || [];
    let evIndex = events.findIndex(e => e.id === currentEditEventId);
    if (evIndex > -1) {
        events[evIndex].guests = currentGuests;
        localStorage.setItem('appEvents', JSON.stringify(events)); // Löst sofortigen Cloud-Upload aus!
        renderEvents(); // Hintergrund-Liste updaten
    }
}

// --- GÄSTE LOGIK ---
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
    renderGuests();
    autoSaveGuests(); // Sofort speichern!
}

function changeGuestStatus(id, newStatus) {
    const guest = currentGuests.find(g => g.id === id);
    if(guest) {
        guest.status = newStatus;
        renderGuests();
        autoSaveGuests(); // Sofort speichern!
    }
}

function removeGuest(id) {
    if(confirm("Gast wirklich entfernen?")) {
        currentGuests = currentGuests.filter(g => g.id !== id);
        renderGuests();
        autoSaveGuests(); // Sofort speichern!
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
    
    closeEventModal();
    renderEvents();
}

function deleteEvent() {
    if (!currentEditEventId) return;
    
    if (confirm("🚨 EVENT WIRKLICH LÖSCHEN? Dieser Vorgang kann nicht rückgängig gemacht werden!")) {
        let events = JSON.parse(localStorage.getItem('appEvents')) || [];
        events = events.filter(e => e.id !== currentEditEventId);
        
        localStorage.setItem('appEvents', JSON.stringify(events));
        
        closeEventModal();
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

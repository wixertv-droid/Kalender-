/* ==========================================================================
   AGENDA 2050 - EVENT & PROMO ENGINE (events.js)
   ========================================================================== */

let currentEditEventId = null;
let currentGuests = [];

function escEvent(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
}
function readEventCustomers() {
    try {
        const all=JSON.parse(localStorage.getItem('appKunden') || '[]');
        return Array.isArray(all)?all:[];
    } catch {return [];}
}
function loadEventCustomers(){
    const sel=document.getElementById('existingGuest');
    if(!sel)return;
    sel.replaceChildren(new Option('Bestehenden Kunden auswählen ...',''));
    readEventCustomers().slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'))
        .forEach(k=>sel.add(new Option(k.name || 'Unbenannt',String(k.id))));
}
function selectEventCustomer(id){
    const customer=readEventCustomers().find(k=>String(k.id)===String(id));
    if(customer)document.getElementById('newGuestName').value=customer.name;
}
function eventCapacity(e){
    const n=Number(e&&e.kapazitaet);
    return Number.isSafeInteger(n)&&n>0?n:0;
}
function occupiesSeat(g) {
    return !['warteliste','abgesagt','noshow'].includes(g.status);
}
function asMoney(v){
    const n=Number(v);
    return Number.isFinite(n) && n>0?n:0;
}
function moneyLabel(value){
    return (Math.round(value*100)/100).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
}
function eventFinance(ev) {
    const gs=Array.isArray(ev.guests)?ev.guests:[];
    const base=asMoney(ev.preis);
    const received=gs.reduce((n,g)=>n+asMoney(g.anzahlung)+asMoney(g.restzahlung),0);
    const expected=gs.filter(occupiesSeat).reduce((n,g)=>n+asMoney(g.preis==null||g.preis===''?base:g.preis),0);
    const costs=asMoney(ev.kosten);
    return {received,expected,costs,profit:received-costs,open:Math.max(0,expected-received)};
}
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
        const capacity=eventCapacity(e);
        const used=(e.guests||[]).filter(occupiesSeat).length;
        const waiting=(e.guests||[]).filter(g=>g.status==='warteliste').length;
        
        let dateStr = "TBA";
        if(e.datum) {
            const dObj = new Date(e.datum);
            dateStr = dObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        container.innerHTML += `
            <div class="event-card" style="border-left-color: ${e.color || '#ff3300'}; opacity: ${opacity};" onclick="openEventDashboard(${e.id})">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="font-size: 1.2rem; font-weight: bold; color: ${e.color || '#ff3300'}; margin-bottom: 8px;">${escEvent(e.name)}</div>
                </div>
                
                <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                    <div class="stat-badge" style="border-color: #aaa; color: #aaa;">📝 ${angemeldet} Angemeldet</div>
                    <div class="stat-badge" style="border-color: var(--neon-cyan); color: var(--neon-cyan);">👍 ${bestaetigt} Bestätigt</div>
                    <div class="stat-badge" style="border-color: var(--neon-green); color: var(--neon-green);">✅ ${erschienen} Da</div>
                </div>

                <div class="event-quickstats"><span class="stat-badge">Plätze: ${used}/${capacity || '∞'}</span><span class="stat-badge">Warteliste: ${waiting}</span><span class="stat-badge">Erhalten: ${moneyLabel(eventFinance(e).received)}</span></div>
                <div style="color: #aaa; font-size: 0.85rem; margin-top: 5px;">📅 ${dateStr} | ⏰ ${e.start} - ${e.ende} Uhr</div>
                <div style="color: #888; font-size: 0.8rem; margin-top: 5px;">📍 ${escEvent(e.stadt || e.ort || 'TBA')} | 💦 ${escEvent(e.praef)}</div>
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
        
        currentGuests = Array.isArray(e.guests) ? e.guests.slice() : [];
        loadEventCustomers();
        document.getElementById('guestSearch').value='';
        document.getElementById('existingGuest').value='';
        document.getElementById('newGuestName').value='';
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
    const targetEvent = (JSON.parse(localStorage.getItem('appEvents')) || []).find(e=>e.id===currentEditEventId);
    const cap=eventCapacity(targetEvent);
    const used=currentGuests.filter(occupiesSeat).length;
    const waiting=currentGuests.filter(g=>g.status==='warteliste').length;
    document.getElementById('dashCapacity').textContent='Belegte Plätze: '+used+'/'+(cap || '∞')+' · Warteliste: '+waiting;
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
    
    const finance=eventFinance({...e,guests:currentGuests});
    const umsatzEl=document.getElementById('dashUmsatz');
    const potEl=document.getElementById('dashPotUmsatz');
    if(umsatzEl)umsatzEl.textContent=moneyLabel(finance.received);
    if(potEl)potEl.textContent='Erwartete Einnahmen: '+moneyLabel(finance.expected);
    document.getElementById('dashReceived').textContent=moneyLabel(finance.received);
    document.getElementById('dashCosts').textContent=moneyLabel(finance.costs);
    document.getElementById('dashOpen').textContent=moneyLabel(finance.open);
    document.getElementById('dashProfit').textContent=moneyLabel(finance.profit);

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

// --- 3. EVENT SETUP & BEARBEITEN (Feste Vorgaben entfernt!) ---
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
            document.getElementById('evStadt').value = e.stadt || '';
            document.getElementById('evLocation').value = e.location || '';
            document.getElementById('evPreis').value = e.preis || '';
            document.getElementById('evCapacity').value = e.kapazitaet || 0;
            document.getElementById('evKosten').value = e.kosten || 0;
            document.getElementById('evTowels').value = e.towels || 'Werden gestellt';
            
            document.getElementById('evGirlName').value = e.gName || '';
            document.getElementById('evGirlAge').value = e.gAge || '';
            document.getElementById('evGirlHeight').value = e.gHeight || '';
            document.getElementById('evGirlWeight').value = e.gWeight || '';
            document.getElementById('evGirlType').value = e.gType || '';
            
            document.getElementById('evVorlieben').value = e.vorlieben || '';
            document.getElementById('evTabus').value = e.tabus || '';
            document.getElementById('evNS').value = e.ns || 'Ja Hiv Schnelltest wird vor Ort gemacht ';
            document.getElementById('evVideo').value = e.video || 'Keine';
            document.getElementById('evBilder').value = e.bilder || 'Ja';
            document.getElementById('evPraef').value = e.praef || 'AO';
            
            document.getElementById('btnDelete').style.display = 'block';
        }
    } else {
        currentEditEventId = null;
        currentGuests = [];
        
        // FELDER SIND JETZT LEER
        document.getElementById('evName').value = '';
        const heute = new Date();
        document.getElementById('evDatum').value = new Date(heute.getTime() - (heute.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        document.getElementById('evStart').value = '';
        document.getElementById('evEnde').value = '';
        document.getElementById('evColor').value = '#ff3300';
        document.getElementById('evStadt').value = '';
        document.getElementById('evLocation').value = '';
        document.getElementById('evPreis').value = '';
        document.getElementById('evCapacity').value = 0;
        document.getElementById('evKosten').value = 0;
        document.getElementById('evTowels').value = 'Werden gestellt';
        
        document.getElementById('evGirlName').value = '';
        document.getElementById('evGirlAge').value = '';
        document.getElementById('evGirlHeight').value = '';
        document.getElementById('evGirlWeight').value = '';
        document.getElementById('evGirlType').value = '';
        
        document.getElementById('evVorlieben').value = '';
        document.getElementById('evTabus').value = '';
        document.getElementById('evNS').value = 'Ja Hiv Schnelltest wird vor Ort gemacht ';
        document.getElementById('evVideo').value = 'Keine';
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

// --- PROMO GENERATOR ---
function generatePromo() {
    const name = document.getElementById('evName').value || 'Event';
    const datum = document.getElementById('evDatum').value;
    const start = document.getElementById('evStart').value || '??:??';
    const ende = document.getElementById('evEnde').value || '??:??';
    const stadt = document.getElementById('evStadt').value || 'geheimen Location';
    const location = document.getElementById('evLocation').value || 'wird privat mitgeteilt';
    
    const gName = document.getElementById('evGirlName').value || 'Traumfrau';
    const gAge = document.getElementById('evGirlAge').value || 'junge';
    const gHeight = document.getElementById('evGirlHeight').value || '';
    const gWeight = document.getElementById('evGirlWeight').value || '';
    const gType = document.getElementById('evGirlType').value || 'süße Maus';

    const vorlieben = document.getElementById('evVorlieben').value || 'Alles was Spaß macht';
    const tabus = document.getElementById('evTabus').value || 'Keine Schmerzen/Gewalt';
    const preis = document.getElementById('evPreis').value || '?';
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

    let maße = [];
    if(gHeight) maße.push(`${gHeight} cm`);
    if(gWeight) maße.push(`${gWeight} kg`);
    let maßeStr = maße.length > 0 ? `, ${maße.join(', ')}` : '';

    let text = `🔥 *${name.toUpperCase()} IN ${stadt.toUpperCase()}* 🔥\n\n`;
    
    text += `Hallo ihr Lieben, hier ist eure ${gName}! 💋\n`;
    text += `Ich bin eine ${gType} (${gAge} Jahre${maßeStr}) und veranstalte am ${weekdayStr}, den ${dateStr} von ${start} bis ${ende} Uhr mein "${name}" in ${stadt} (Location: ${location}).\n\n`;
    
text += `Ich will eure gemeinsame Creampie "${name}" Schlampe sein. Nehmt mich ran, bis ich überlaufe! 🔥💦\n\n`;
    
    text += `💦 *Gewollt:* ${vorlieben}\n`;
    if (vidOpt !== 'Keine') {
        text += `📸 *Videos:* Optional ${vidOpt}\n`;
    }
    
    text += `🚫 *Tabus:* ${tabus}\n`;
    text += `💊 *Sex:* ${praef}\n`;
    if (nsOpt !== 'Nein') {
        text += `🚿 *Test:* ${nsOpt}\n`;
    }
    text += `💸 *Kosten:* ${preis} € p.P.\n`;
    text += `🧖‍♀️ *Handtücher:* ${towels}\n`;
    
    if (bilderOpt === 'Ja') {
        text += `\nHeiße Bilder von mir schicke ich euch bei Interesse sehr gerne auf Anfrage! 😏\n`;
    }
    
    text += `\nDie Plätze sind limitiert. Wenn du mich als deine Gangbang-Schlampe benutzen willst, melde dich verbindlich. Ich kann es kaum erwarten, von euch gefickt zu werden! 🔥🔞`;
    
    const mode=document.getElementById('evPromoMode').value;
    const cap=Number(document.getElementById('evCapacity').value)||0;
    const places=cap?Math.max(0,cap-currentGuests.filter(occupiesSeat).length):null;
    if(mode==='plaetze')text='🔥 NOCH FREIE PLÄTZE: '+name+'\n'+(places===null?'Plätze auf Anfrage':places+' Plätze frei')+'\n\n'+text;
    if(mode==='erinnerung')text='⏰ ERINNERUNG: '+name+'\nDatum: '+datum+' · '+start+' Uhr\nOrt: '+location+'\nBitte gib rechtzeitig Bescheid, falls du verhindert bist.';
    if(mode==='ausgebucht')text='🔒 '+name+' ist aktuell ausgebucht.\nDatum: '+datum+' · '+start+' Uhr\nWeitere Interessenten können sich für die Warteliste melden.';
    document.getElementById('promoBox').innerText = text;
}

function copyPromo() {
    const text = document.getElementById('promoBox').innerText;
    if(text === "Klicke auf Generieren...") return;
    navigator.clipboard.writeText(text).then(() => alert("✅ Promo-Text kopiert!"));
}

// --- GÄSTE LOGIK ---
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

function eventById(){
    return (JSON.parse(localStorage.getItem('appEvents'))||[]).find(e=>e.id===currentEditEventId);
}
function renderGuests() {
    const list=document.getElementById('gaesteListe');
    if(!list)return;
    list.replaceChildren();
    const search=String(document.getElementById('guestSearch').value||'').trim().toLowerCase();
    const filtered=currentGuests.filter(g=>String(g.name||'').toLowerCase().includes(search));
    if(!filtered.length){
        list.textContent=search?'Keine passenden Gäste':'Noch keine Gäste eingetragen.';
        list.style.color='#aaa';
        return;
    }
    const event=eventById();
    const eventPrice=asMoney(event&&event.preis);
    const statuses=[
        ['angemeldet','Angemeldet'],['bestaetigt','Bestätigt'],
        ['erschienen','Erschienen'],['warteliste','Warteliste'],
        ['abgesagt','Abgesagt'],['noshow','No-Show']
    ];
    filtered.forEach(g=>{
        const id=String(g.id).replace(/[^0-9A-Za-z_-]/g,'');
        const price=g.preis==null||g.preis===''?eventPrice:asMoney(g.preis);
        const deposit=asMoney(g.anzahlung);
        const rest=asMoney(g.restzahlung);
        const row=document.createElement('div');
        row.className='attendee-row att-status-'+(['angemeldet','bestaetigt','erschienen','warteliste','abgesagt','noshow'].includes(g.status)?g.status:'angemeldet');
        row.innerHTML=
            '<div style="width:100%;display:flex;justify-content:space-between;gap:8px;align-items:center;">'+
            '<strong>'+escEvent(g.name)+'</strong>'+
            '<span style="font-size:.78rem;color:var(--neon-gold)">'+escEvent(moneyLabel(deposit+rest))+' bezahlt</span></div>'+
            '<div class="attendee-tools">'+
            '<label>Status <select data-status="'+id+'">'+statuses.map(([v,label])=>'<option value="'+v+'"'+(g.status===v?' selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
            '<label>Preis € <input data-money="preis" data-id="'+id+'" type="number" min="0" step=".01" value="'+price+'"></label>'+
            '<label>Anzahlung € <input data-money="anzahlung" data-id="'+id+'" type="number" min="0" step=".01" value="'+deposit+'"></label>'+
            '<label>Rest bezahlt € <input data-money="restzahlung" data-id="'+id+'" type="number" min="0" step=".01" value="'+rest+'"></label>'+
            (g.kundeId?'<span style="font-size:.7rem;color:var(--neon-cyan)">👤 Kundenakte</span>':'')+
            (g.status!=='erschienen'&&g.status!=='abgesagt'&&g.status!=='noshow'?
             '<button class="btn-status" data-checkin="'+id+'" style="border-color:var(--neon-green);color:var(--neon-green)">✓ Check-in</button>':'')+
            '<button class="btn-status" data-remove="'+id+'" style="color:var(--neon-pink)">✖</button>'+
            '</div>';
        list.appendChild(row);
    });
    // Use delegated DOM events (no untrusted guest values in inline handlers).
    list.querySelectorAll('select[data-status]').forEach(el=>el.addEventListener('change',()=>{
        const guest=currentGuests.find(g=>String(g.id)===el.dataset.status);
        if(guest&&!changeGuestStatus(el.dataset.status,el.value))el.value=guest.status;
    }));
    list.querySelectorAll('input[data-money]').forEach(el=>el.addEventListener('change',()=>{
        if(!updateGuestMoney(el.dataset.id,el.dataset.money,el.value))renderGuests();
    }));
    list.querySelectorAll('button[data-checkin]').forEach(el=>el.addEventListener('click',()=>changeGuestStatus(el.dataset.checkin,'erschienen')));
    list.querySelectorAll('button[data-remove]').forEach(el=>el.addEventListener('click',()=>removeGuest(el.dataset.remove)));
}

function addGuest(){
    if(!currentEditEventId)return;
    const input=document.getElementById('newGuestName');
    const name=input.value.trim();
    if(!name){alert('Bitte Namen oder Nickname eingeben.');return;}
    const choose=document.getElementById('existingGuest');
    let customer=choose.value?readEventCustomers().find(x=>String(x.id)===choose.value):null;
    if(currentGuests.some(g=>customer&&String(g.kundeId)===String(customer.id))){
        alert('Dieser Kunde ist bereits für das Event eingetragen.');return;
    }
    if(!customer && document.getElementById('guestCreateCustomer').checked){
        const customers=readEventCustomers();
        if(customers.some(c=>String(c.name).toLowerCase()===name.toLowerCase())){
            alert('Ein Kunde mit diesem Namen existiert bereits. Wähle ihn oben aus.');return;
        }
        customer={id:Date.now()+1,name,status:'none',preis:'',noshows:0};
        customers.push(customer);
        localStorage.setItem('appKunden',JSON.stringify(customers));
        loadEventCustomers();
    }
    const event=eventById();
    const cap=eventCapacity(event);
    const status=cap&&currentGuests.filter(occupiesSeat).length>=cap?'warteliste':'angemeldet';
    currentGuests.push({
        id:String(Date.now())+String(Math.floor(Math.random()*1000)),
        name:customer?customer.name:name,
        kundeId:customer?customer.id:null,
        status,
        preis:customer&&customer.preis?asMoney(customer.preis):asMoney(event&&event.preis),
        anzahlung:0,
        restzahlung:0
    });
    input.value='';
    choose.value='';
    document.getElementById('guestCreateCustomer').checked=false;
    updateDashboardStats();renderGuests();autoSaveGuests();
    if(status==='warteliste')alert('Event ist voll: Gast wurde auf die Warteliste gesetzt.');
}

function changeGuestStatus(id,newStatus){
    const g=currentGuests.find(x=>String(x.id)===String(id));
    if(!g)return false;
    const valid=['angemeldet','bestaetigt','erschienen','warteliste','abgesagt','noshow'];
    if(!valid.includes(newStatus))return false;
    const event=eventById();
    const cap=eventCapacity(event);
    if(!occupiesSeat(g)&&occupiesSeat({...g,status:newStatus})&&cap&&currentGuests.filter(occupiesSeat).length>=cap){
        alert('Kapazität erreicht. Bitte zuerst einen Platz freigeben.');return false;
    }
    const was=g.status;
    if(was===newStatus)return true;
    g.status=newStatus;
    // Preserve the existing optional test-stock bookkeeping.
    const isAO=event&&String(event.praef||'').toLowerCase().includes('ao');
    if(isAO && (was==='erschienen'||newStatus==='erschienen')){
        const settings=JSON.parse(localStorage.getItem('appEinstellungen')||'{}');
        const oldAmount=Math.max(0,Number.parseInt(settings.testBestand,10)||0);
        const newAmount=was!=='erschienen' ? Math.max(0,oldAmount-1) : oldAmount+1;
        if(newAmount!==oldAmount){
            settings.testBestand=newAmount;
            localStorage.setItem('appEinstellungen',JSON.stringify(settings));
        }
    }
    updateDashboardStats();renderGuests();autoSaveGuests();
    return true;
}
function updateGuestMoney(id,field,raw){
    const allowed=['preis','anzahlung','restzahlung'];
    const guest=currentGuests.find(x=>String(x.id)===String(id));
    const value=Number(raw);
    if(!guest||!allowed.includes(field)||!Number.isFinite(value)||value<0||value>1000000){
        alert('Ungültiger Betrag, bitte korrigieren.');return false;
    }
    guest[field]=Math.round(value*100)/100;
    updateDashboardStats();autoSaveGuests();renderGuests();
    return true;
}
function removeGuest(id){
    const guest=currentGuests.find(g=>String(g.id)===String(id));
    if(!guest||!confirm('Gast wirklich aus der Eventliste entfernen?'))return;
    if(guest.status==='erschienen'){
        // Reverse prior stock deduction (if applicable).
        changeGuestStatus(id,'abgesagt');
    }
    currentGuests=currentGuests.filter(g=>String(g.id)!==String(id));
    updateDashboardStats();renderGuests();autoSaveGuests();
}

// --- EVENT SPEICHERN & LÖSCHEN ---
function parseTimeStr(timeStr, defaultStr) {
    if (!timeStr || !timeStr.includes(':')) timeStr = defaultStr;
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    return h * 60 + m;
}

function saveEvent() {
    const name = document.getElementById('evName').value;
    const datum = document.getElementById('evDatum').value;
    const start = document.getElementById('evStart').value;
    const ende = document.getElementById('evEnde').value;
    
    if(!name || !datum || !start || !ende) {
        alert("Name, Datum und Uhrzeiten sind Pflichtfelder!");
        return;
    }

    // DOPPELBUCHUNGSSCHUTZ: Prüfen, ob da schon ein normaler Termin liegt!
    let termine = JSON.parse(localStorage.getItem('appTermine')) || [];
    let nStartMin = parseTimeStr(start, "00:00");
    let nEndeMin = parseTimeStr(ende, "23:59");
    if (ende === "00:00" || nEndeMin === 0) nEndeMin = 1440;
    
    const overlap = termine.find(t => {
        if (t.datum === datum) {
            let eStartMin = parseTimeStr(t.start, "00:00");
            let eEndeMin = parseTimeStr(t.ende, "23:59");
            if (t.ende === "00:00" || eEndeMin === 0) eEndeMin = 1440; 
            return (nStartMin < eEndeMin && nEndeMin > eStartMin);
        }
        return false;
    });

    if (overlap) {
        alert(`⚠️ DOPPELBUCHUNG VERHINDERT!\n\nDu hast am ${datum} zur selben Zeit bereits den Kunden-Termin "${overlap.name}" (${overlap.start} - ${overlap.ende} Uhr).\nBitte ändere die Zeit für das Event.`);
        return; 
    }

    const capNum=Number(document.getElementById('evCapacity').value);
    const costNum=Number(document.getElementById('evKosten').value);
    if(!Number.isSafeInteger(capNum)||capNum<0||!Number.isFinite(costNum)||costNum<0){
        alert('Bitte eine gültige Platzanzahl und nichtnegative Ausgaben eintragen.');
        return;
    }
    if(capNum>0 && currentGuests.filter(occupiesSeat).length>capNum){
        alert('Kapazität kleiner als die aktuelle Anzahl angemeldeter/bestätigter Gäste.');
        return;
    }
    let events = JSON.parse(localStorage.getItem('appEvents')) || [];
    
    const data = {
        id: currentEditEventId || Date.now(),
        name: name,
        datum: datum,
        start: start,
        ende: ende,
        color: document.getElementById('evColor').value,
        stadt: document.getElementById('evStadt').value,
        location: document.getElementById('evLocation').value,
        preis: document.getElementById('evPreis').value,
        kapazitaet: Math.max(0,Math.floor(Number(document.getElementById('evCapacity').value)||0)),
        kosten: Math.max(0,Number(document.getElementById('evKosten').value)||0),
        
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

document.addEventListener('DOMContentLoaded', async () => {
    // Resolve deep links only after loading the latest server snapshot.
    await fetchFromSupabase();
    renderEvents();
    const requested=new URLSearchParams(location.search).get('event');
    if(requested && /^\d+$/.test(requested)){
        const id=Number(requested);
        const events=JSON.parse(localStorage.getItem('appEvents')||'[]');
        if(events.some(e=>e.id===id))openEventDashboard(id);
    }
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 400);
});

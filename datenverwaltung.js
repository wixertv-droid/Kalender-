/* Selective data cleanup for Agenda 2050. Uses server data as the source of truth. */
(() => {
    'use strict';
    let currentVersion=null, snapshot=null, category=null, selected=new Set(), busy=false;
    const TYPES={termine:'Termine',kunden:'Kunden',events:'Events'};
    const $=id=>document.getElementById(id);
    const cleanId=id=>{
        if(typeof id==='number'&&Number.isSafeInteger(id)&&id>=0)return String(id);
        if(typeof id==='string'&&/^[0-9]{1,24}$/.test(id))return id;
        return null;
    };
    const readableDate=text=> {
        if(!/^\d{4}-\d{2}-\d{2}$/.test(String(text||'')))return text||'Ohne Datum';
        const [year,month,day]=text.split('-');
        return day+'.'+month+'.'+year;
    };
    function message(text){$('dmMessage').textContent=text||'';}
    function stage(name){
        for(const id of ['dmCategories','dmSelection','dmConfirmStep'])$(id).hidden=id!==name;
    }
    function changedLocally(){
        return typeof dirty==='undefined'||dirty||syncInFlight||syncBlocked||syncRevision===null;
    }
    function dismiss(){
        if(busy)return;
        $('dmOverlay').hidden=true;
        $('dmOverlay').setAttribute('aria-hidden','true');
        document.body.style.overflow='';
        category=null;selected.clear();snapshot=null;currentVersion=null;
        message('');
    }
    async function open(){
        if(busy)return;
        if(changedLocally()){
            alert('Es sind noch ungespeicherte Änderungen oder ein Synchronisationskonflikt vorhanden. Bitte erst die Speicherung klären, bevor du Daten löschst.');
            return;
        }
        busy=true;
        $('dmOverlay').hidden=false;
        $('dmOverlay').setAttribute('aria-hidden','false');
        document.body.style.overflow='hidden';
        category=null; selected.clear();
        stage('dmCategories');
        message('Lade aktuellen Datenbestand vom Server …');
        try {
            const response=await fetch('/api/data',{cache:'no-store',credentials:'same-origin'});
            if(!response.ok)throw Error('Daten konnten nicht geladen werden (HTTP '+response.status+').');
            const result=await response.json();
            if(!result||typeof result.version!=='number'||!result.data)throw Error('Ungültige Serverantwort.');
            if(changedLocally())throw Error('Es gibt inzwischen ungespeicherte Änderungen. Bitte neu öffnen.');
            currentVersion=result.version;
            snapshot=result.data;
            for(const [type,count] of [['termine','dmCountTermine'],['kunden','dmCountKunden'],['events','dmCountEvents']]){
                $(count).textContent=Array.isArray(snapshot[type])?snapshot[type].length+' Einträge':'0 Einträge';
            }
            message('');
        }catch(error){
            message('Nicht bereit: '+error.message);
            snapshot=null;
        }finally{busy=false;}
    }
    function choose(type){
        if(!snapshot||!TYPES[type]||busy)return;
        category=type;
        selected.clear();
        $('dmSearch').value='';
        $('dmSelectionTitle').textContent=TYPES[type]+' auswählen';
        stage('dmSelection');
        showEntries();
        $('dmSearch').focus();
    }
    function entries(){
        return Array.isArray(snapshot&&snapshot[category])?snapshot[category]:[];
    }
    function lookupText(item){
        return [
            item.name,item.datum,item.start,item.ende,item.kontakt,item.plattform,
            item.status,item.stadt,item.location,item.preis
        ].filter(value=>value!==undefined&&value!==null).join(' ').toLocaleLowerCase('de-DE');
    }
    function subtitle(item){
        if(category==='kunden')return item.kontakt?'Kontakt: '+item.kontakt:(item.status||'Kundenprofil');
        if(category==='events')return readableDate(item.datum)+' · '+(item.start||'–')+' Uhr · '+(Array.isArray(item.guests)?item.guests.length:0)+' Gäste';
        return readableDate(item.datum)+' · '+(item.start||'–')+'–'+(item.ende||'–')+' Uhr · '+(item.status||'Termin');
    }
    function updateCount(){
        $('dmSelectedCount').textContent=selected.size+' '+(selected.size===1?'Eintrag':'Einträge')+' ausgewählt';
        $('dmContinue').disabled=selected.size===0||busy;
    }
    function showEntries(){
        const list=$('dmList');
        list.replaceChildren();
        const term=$('dmSearch').value.trim().toLocaleLowerCase('de-DE');
        const all=entries();
        const counts=new Map();
        all.forEach(item=>{
            const id=cleanId(item&&item.id);
            if(id!==null)counts.set(id,(counts.get(id)||0)+1);
        });
        const visible=all.filter(item=>!term||lookupText(item).includes(term));
        if(!visible.length){
            const hint=document.createElement('p');
            hint.className='dm-hint';hint.style.padding='14px';
            hint.textContent=all.length?'Keine passenden Einträge.':'In dieser Kategorie sind keine Einträge vorhanden.';
            list.append(hint);
        }
        for(const item of visible){
            const id=cleanId(item&&item.id);
            const allowed=id!==null&&counts.get(id)===1;
            const row=document.createElement('label');row.className='dm-item';
            const check=document.createElement('input');check.type='checkbox';
            check.disabled=!allowed;check.checked=allowed&&selected.has(id);
            if(!allowed)row.title='Der Eintrag hat keine eindeutige ID und kann nicht sicher ausgewählt werden.';
            const body=document.createElement('span');body.className='dm-item-body';
            const title=document.createElement('span');title.className='dm-item-title';
            title.textContent=item.name||'(Ohne Bezeichnung)';
            const note=document.createElement('span');note.className='dm-item-sub';
            note.textContent=subtitle(item)+(allowed?'':' · Nicht eindeutig – nicht löschbar');
            body.append(title,note);
            check.addEventListener('change',()=>{
                if(check.checked)selected.add(id);
                else selected.delete(id);
                updateCount();
            });
            row.append(check,body);list.append(row);
        }
        updateCount();
    }
    function confirmation(){
        if(!selected.size||busy)return;
        const valid=new Set(entries().map(item=>cleanId(item.id)).filter(Boolean));
        if([...selected].some(id=>!valid.has(id)))return;
        $('dmConfirmSummary').textContent='Du möchtest '+selected.size+' '+(selected.size===1?'Eintrag':'Einträge')+
            ' aus „'+TYPES[category]+'“ löschen. Andere Kategorien bleiben bestehen.';
        $('dmConfirmInput').value='';
        $('dmDelete').disabled=true;
        stage('dmConfirmStep');
    }
    async function remove(){
        if(busy||$('dmConfirmInput').value.trim()!=='LÖSCHEN'||!selected.size||!snapshot)return;
        if(changedLocally()){
            message('Abgebrochen: Auf diesem Gerät gibt es ungespeicherte Änderungen.');
            return;
        }
        busy=true;
        $('dmDelete').disabled=true;
        message('Sichere Datenbank und lösche nur die gewählten Einträge …');
        try {
            const response=await fetch('/api/delete-selected',{
                method:'POST',credentials:'same-origin',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    version:currentVersion,category,ids:[...selected],confirmation:'LOESCHEN'
                })
            });
            const result=await response.json();
            if(!response.ok)throw Error(result.error||'Löschen nicht möglich. HTTP '+response.status);
            if(!result.ok||result.deleted!==selected.size)throw Error('Unerwartete Serverantwort. Bitte Daten neu prüfen.');
            message('');
            // The normal versioned sync reloads the authoritative snapshot.
            await fetchFromSupabase();
            alert(result.deleted+' '+(result.deleted===1?'Eintrag wurde':'Einträge wurden')+
                ' gelöscht. Die vorherige Datenbank wurde auf dem Server gesichert.');
            location.reload();
        }catch(error){
            message('Nicht gelöscht: '+error.message+' Bitte gegebenenfalls die aktuelle Liste neu laden.');
            // Do not silently retry after a conflict or unsafe network state.
        }finally{busy=false;$('dmDelete').disabled=$('dmConfirmInput').value.trim()!=='LÖSCHEN';}
    }
    document.addEventListener('DOMContentLoaded',()=>{
        $('dmOpen').addEventListener('click',open);
        $('dmClose').addEventListener('click',dismiss);
        $('dmBack').addEventListener('click',()=>{selected.clear();stage('dmCategories');message('');});
        $('dmConfirmBack').addEventListener('click',()=>{stage('dmSelection');message('');});
        $('dmOverlay').addEventListener('click',event=>{if(event.target===$('dmOverlay'))dismiss();});
        document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('dmOverlay').hidden)dismiss();});
        document.querySelectorAll('[data-dm-category]').forEach(button=>
            button.addEventListener('click',()=>choose(button.dataset.dmCategory)));
        $('dmSearch').addEventListener('input',showEntries);
        $('dmContinue').addEventListener('click',confirmation);
        $('dmConfirmInput').addEventListener('input',()=>{
            $('dmDelete').disabled=busy||$('dmConfirmInput').value.trim()!=='LÖSCHEN';
        });
        $('dmDelete').addEventListener('click',remove);
    });
})();

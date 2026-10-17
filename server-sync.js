/* Server-Sync: no Supabase credentials, protected same-origin API. */
const KALENDER_KEYS=['appTermine','appKunden','appEinstellungen','appEvents','appSperrzeiten'];
const KALENDER_FIELDS=['termine','kunden','einstellungen','events','sperrzeiten'];
const nativeStorageSetItem=Storage.prototype.setItem;
const originalSetItem=nativeStorageSetItem.bind(localStorage);
let isCloudConnected=false, isSyncingFromCloud=false, syncRevision=null;
let syncInFlight=false, syncBlocked=false, syncTimeout=null, localChanges=0;
let dirty=localStorage.getItem('_kalenderUnsaved')==='1';

function kalenderNotice(message,critical=true) {
    let box=document.getElementById('kalender-sync-notice');
    if(!box) {
        box=document.createElement('div');
        box.id='kalender-sync-notice';
        box.style.cssText='position:fixed;z-index:999999;left:12px;right:12px;bottom:12px;padding:14px 18px;border-radius:9px;background:#24202a;color:#fff;border:1px solid #ff4268;font-size:14px;box-shadow:0 4px 24px #0009;max-width:720px;margin:auto';
        document.body.appendChild(box);
    }
    box.textContent=message;
    box.style.borderColor=critical?'#ff4268':'#ffb34d';
}
function kalenderData() {
    const data={};
    KALENDER_KEYS.forEach((key,i)=>{
        const def=i===2?{}:[];
        try {data[KALENDER_FIELDS[i]]=JSON.parse(localStorage.getItem(key)||'null')||def;}
        catch {data[KALENDER_FIELDS[i]]=def;}
    });
    return data;
}
Storage.prototype.setItem=function(key,value) {
    nativeStorageSetItem.call(this,key,value);
    if(this!==localStorage||isSyncingFromCloud||!KALENDER_KEYS.includes(key))return;
    dirty=true;
    localChanges++;
    originalSetItem('_kalenderUnsaved','1');
    clearTimeout(syncTimeout);
    syncTimeout=setTimeout(pushToSupabase,500);
};
async function pushToSupabase() {
    if(!dirty||syncInFlight||syncBlocked||syncRevision===null)return;
    syncInFlight=true;
    const sent=localChanges;
    try {
        const response=await fetch('/api/data',{
            method:'POST',credentials:'same-origin',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({version:syncRevision,data:kalenderData()})
        });
        if(response.status===401||response.status===403){location.replace('index.html');return;}
        const result=await response.json();
        if(response.status===422){
            syncBlocked=true;
            kalenderNotice(result.error||'Zeitkonflikt: Daten wurden nicht gespeichert. Prüfe den Kalender und exportiere ggf. deine Änderungen.');
            return;
        }
        if(response.status===409){
            syncBlocked=true;
            kalenderNotice('SPEICHERKONFLIKT: Anderes Gerät hat Daten geändert. Deine lokalen Änderungen bleiben erhalten. Exportiere ein Backup, bevor du die Seite neu lädst.');
            return;
        }
        if(!response.ok)throw Error(result.error||'Speichern fehlgeschlagen');
        syncRevision=result.version;
        originalSetItem('_kalenderVersion',String(syncRevision));
        isCloudConnected=true;
        if(sent===localChanges){
            dirty=false;
            localStorage.removeItem('_kalenderUnsaved');
            const notice=document.getElementById('kalender-sync-notice');
            if(notice)notice.remove();
        }
    }catch(err){
        isCloudConnected=false;
        kalenderNotice('Noch NICHT gespeichert: '+err.message+'. Deine lokalen Daten bleiben auf diesem Gerät erhalten.');
    }finally{
        syncInFlight=false;
        if(dirty&&!syncBlocked){
            clearTimeout(syncTimeout);
            syncTimeout=setTimeout(pushToSupabase,8000);
        }
    }
}
async function fetchFromSupabase() {
    try {
        const response=await fetch('/api/data',{cache:'no-store',credentials:'same-origin'});
        if(response.status===401||response.status===403){location.replace('index.html');return;}
        if(!response.ok)throw Error('Serverstatus '+response.status);
        const {version,data}=await response.json();
        isCloudConnected=true;
        if(syncBlocked||syncInFlight)return;
        const remembered=localStorage.getItem('_kalenderVersion');
        if(dirty){
            if(remembered!==null&&Number(remembered)===version){
                syncRevision=version;
                await pushToSupabase();
            }else if(remembered===null&&version===0){
                if(confirm('Alte lokale Kalenderdaten gefunden. Diesen Stand in die neue Server-Datenbank übernehmen? Bitte vorher ein JSON-Backup erstellen.')){
                    syncRevision=0;
                    localChanges++;
                    await pushToSupabase();
                }else{
                    syncBlocked=true;
                    kalenderNotice('Lokale Daten nicht importiert. Bitte zuerst Backup exportieren.');
                }
            }else{
                syncBlocked=true;
                kalenderNotice('SPEICHERKONFLIKT: Lokale Daten bleiben erhalten. Bitte erst Backup exportieren.');
            }
            return;
        }
        if(version===0&&remembered===null&&KALENDER_KEYS.some(k=>{
            const v=localStorage.getItem(k);
            return v&&v!=='[]'&&v!=='{}';
        })){
            if(confirm('Auf diesem Gerät sind noch Kalenderdaten gespeichert. Einmalig auf den eigenen Server importieren? Vorher Backup erstellen.')){
                syncRevision=0;dirty=true;localChanges++;
                originalSetItem('_kalenderUnsaved','1');
                await pushToSupabase();
                return;
            }
            syncBlocked=true;
            kalenderNotice('Alte lokale Daten nicht überschrieben. Bitte Backup exportieren.');
            return;
        }
        if(syncRevision===version)return;
        isSyncingFromCloud=true;
        try{
            KALENDER_KEYS.forEach((k,i)=>originalSetItem(k,JSON.stringify(data[KALENDER_FIELDS[i]]||(i===2?{}:[]))));
        }finally{isSyncingFromCloud=false;}
        syncRevision=version;
        originalSetItem('_kalenderVersion',String(version));
    }catch(error){
        isCloudConnected=false;
        kalenderNotice('Kalender-Server nicht erreichbar. Keine Daten überschrieben. Bitte Verbindung prüfen.');
        console.error('Kalender Sync:',error);
    }
}

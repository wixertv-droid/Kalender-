/* PIN is checked only on the server; no PIN/cache fallback in browser. */
let currentPin = "";
let isChecking = false;
function statusPin(text, color) {
    const node=document.getElementById('status-text');
    if(node){node.textContent=text;if(color)node.style.color=color;}
}
function updateDots() {
    document.querySelectorAll('.pin-dot').forEach((node,i)=>{
        node.classList.toggle('active',i<currentPin.length);
        node.classList.toggle('filled',i<currentPin.length);
    });
}
function clearPin() {
    if(isChecking)return;
    currentPin="";
    updateDots();
    statusPin("PIN EINGEBEN","var(--neon-cyan)");
}
function backspacePin() {
    if(isChecking)return;
    currentPin=currentPin.slice(0,-1);
    updateDots();
}
function addNumber(n) {
    if(isChecking || currentPin.length>=4 || !/^[0-9]$/.test(String(n)))return;
    currentPin+=String(n);
    updateDots();
    if(currentPin.length===4)checkPin();
}
async function checkPin() {
    isChecking=true;
    statusPin("PIN WIRD GEPRÜFT...","var(--neon-gold)");
    try {
        const response=await fetch('/api/login',{
            method:'POST',credentials:'same-origin',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({pin:currentPin})
        });
        const result=await response.json();
        if(!response.ok)throw Error(result.error||'PIN ungültig');
        currentPin="";
        statusPin("ZUGRIFF ERLAUBT","var(--neon-green)");
        window.location.replace('woche.html');
    }catch(e) {
        currentPin="";
        updateDots();
        statusPin(e.message,"var(--neon-pink)");
        isChecking=false;
    }
}
document.addEventListener('DOMContentLoaded',async()=>{
    document.addEventListener('keydown',event=>{
        if(event.ctrlKey||event.altKey||event.metaKey||event.target instanceof HTMLInputElement)return;
        if(/^[0-9]$/.test(event.key))addNumber(event.key);
        if(event.key==='Backspace')backspacePin();
        if(event.key==='Escape')clearPin();
    });
    try {
        const response=await fetch('/api/session',{cache:'no-store',credentials:'same-origin'});
        if(!response.ok)throw Error('Gerätezertifikat nicht erkannt.');
        const session=await response.json();
        if(session.authenticated){location.replace('woche.html');return;}
        if(!session.pinConfigured){
            statusPin('PIN auf dem Server noch nicht eingerichtet.','var(--neon-pink)');
        }
    }catch(e){statusPin(e.message,'var(--neon-pink)');}
});
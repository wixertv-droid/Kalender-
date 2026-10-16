/* Passwortlos: Der HTTPS-Server erkennt vertrauenswürdige Gerätezertifikate. */
document.addEventListener('DOMContentLoaded',async()=>{
    const status=document.getElementById('status-text');
    try {
        const res=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});
        const data=await res.json();
        if(!res.ok||!data.authenticated)throw Error('Gerät nicht freigeschaltet');
        location.replace('woche.html');
    }catch(err){
        status.textContent='KEIN ZUGRIFF: '+err.message;
        status.style.color='#ff4268';
    }
});
/* Passwort wird nur an die eigene HTTPS-API gesendet; niemals gespeichert. */
document.addEventListener('DOMContentLoaded',async()=>{
    const form=document.getElementById('login-form');
    const field=document.getElementById('login-password');
    const status=document.getElementById('status-text');
    try{
        const existing=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});
        const session=await existing.json();
        if(session.authenticated){sessionStorage.setItem('authKey','true');location.replace('woche.html');return;}
    }catch{/* Verbindungsfehler beim Anmelden anzeigen. */}
    form.addEventListener('submit',async event=>{
        event.preventDefault();
        const password=field.value;
        if(!password)return;
        const button=form.querySelector('button');
        button.disabled=true;
        status.textContent='ANMELDUNG WIRD GEPRÜFT...';
        try{
            const response=await fetch('/api/login',{
                method:'POST',credentials:'same-origin',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({password})
            });
            const data=await response.json();
            if(!response.ok)throw Error(data.error||'Anmeldung fehlgeschlagen');
            field.value='';
            sessionStorage.setItem('authKey','true');
            status.textContent='ZUGRIFF ERLAUBT';
            location.replace('woche.html');
        }catch(err){
            status.textContent=err.message;
            status.style.color='#ff4268';
            field.value='';
            field.focus();
            button.disabled=false;
        }
    });
});
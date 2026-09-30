const state={from:"en",to:"id",pc:null,dc:null,stream:null,active:false,audio:null};
const $=id=>document.getElementById(id);
const from=$('fromLang'),to=$('toLang'),swap=$('swapBtn'),start=$('startBtn'),orb=$('orb'),title=$('title'),hint=$('hint'),status=$('status');
function render(){from.textContent=state.from==='en'?'🇬🇧 English':'🇮🇩 Indonesia';to.textContent=state.to==='id'?'🇮🇩 Indonesia':'🇬🇧 English'}
function setStatus(x){status.textContent=x} render();

swap.onclick=()=>{if(state.active)return;[state.from,state.to]=[state.to,state.from];render();setStatus('Arah bahasa ditukar')};

function clientId(){
  const key='talk-translator-client-id';
  let id=localStorage.getItem(key);
  if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}
  return id;
}

async function getToken(){
  const direction=state.from==='en'?'en-id':'id-en';
  const r=await fetch('/api/realtime-token?direction='+encodeURIComponent(direction)+'&client_id='+encodeURIComponent(clientId()),{cache:'no-store'});
  const text=await r.text();
  let d={};
  try{d=JSON.parse(text)}catch{throw Error(`Server mengembalikan respons tidak valid (${r.status})`)}
  if(!r.ok)throw Error(d.error||`Gagal membuat sesi (${r.status})`);
  if(!d.value)throw Error('Token realtime tidak diterima dari server');
  return d.value;
}

async function startRealtime(){
  setStatus('Meminta izin mikrofon...');
  const token=await getToken();
  state.stream=await navigator.mediaDevices.getUserMedia({audio:true});
  state.pc=new RTCPeerConnection();
  state.stream.getTracks().forEach(t=>state.pc.addTrack(t,state.stream));
  state.audio=document.createElement('audio');
  state.audio.autoplay=true;
  state.audio.setAttribute('aria-hidden','true');
  document.body.appendChild(state.audio);
  state.pc.ontrack=e=>{state.audio.srcObject=e.streams[0]};
  state.pc.onconnectionstatechange=()=>{
    if(state.pc && ['failed','disconnected','closed'].includes(state.pc.connectionState) && state.active) stopRealtime();
  };
  state.dc=state.pc.createDataChannel('oai-events');
  state.dc.onmessage=e=>{
    try{
      const ev=JSON.parse(e.data);
      if(ev.type==='error')setStatus('AI: '+(ev.error?.message||'terjadi kesalahan'));
    }catch{}
  };
  const offer=await state.pc.createOffer();
  await state.pc.setLocalDescription(offer);
  await new Promise(resolve=>{
    if(state.pc.iceGatheringState==='complete')return resolve();
    const timer=setTimeout(resolve,5000);
    state.pc.onicegatheringstatechange=()=>{
      if(state.pc?.iceGatheringState==='complete'){clearTimeout(timer);resolve()}
    };
  });
  const r=await fetch('https://api.openai.com/v1/realtime/translations/calls',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/sdp'},
    body:state.pc.localDescription.sdp
  });
  const answer=await r.text();
  if(!r.ok)throw Error(`Koneksi realtime gagal (${r.status}): ${answer.slice(0,240)}`);
  await state.pc.setRemoteDescription({type:'answer',sdp:answer});
  setStatus('🟢 Terhubung — silakan bicara');
}

async function stopRealtime(){
  state.active=false;update();
  try{state.stream?.getTracks().forEach(t=>t.stop());state.dc?.close();state.pc?.close();state.audio?.remove()}catch{}
  state.stream=null;state.dc=null;state.pc=null;state.audio=null;
  setStatus('Percakapan dihentikan');
}
function update(){
  start.classList.toggle('active',state.active);
  orb.classList.toggle('active',state.active);
  start.textContent=state.active?'⏹️ Hentikan Percakapan':'🎙️ Mulai Percakapan';
  title.textContent=state.active?'Sedang menerjemahkan':'Siap menerjemahkan';
  hint.textContent=state.active?'Bicara secara normal. AI akan menerjemahkan suara secara langsung.':'Tekan tombol lalu bicara secara normal.';
}
start.onclick=async()=>{
  if(state.active){await stopRealtime();return}
  try{state.active=true;update();setStatus('Menghubungkan ke AI...');await startRealtime()}
  catch(e){await stopRealtime();setStatus(e.message||'Gagal menghubungkan ke AI')}
};

let deferredInstall=null;
const installBtn=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;installBtn.hidden=false});
installBtn?.addEventListener('click',async()=>{
  if(!deferredInstall)return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall=null;installBtn.hidden=true;
});
window.addEventListener('appinstalled',()=>{installBtn.hidden=true;setStatus('Aplikasi berhasil dipasang')});
if(window.matchMedia('(display-mode: standalone)').matches)installBtn.hidden=true;
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

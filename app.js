let players = [];
const circle = document.getElementById('circle');
const bottle = document.getElementById('bottle');
const timerDisplay = document.getElementById('timer');
const actionBtn = document.getElementById('actionBtn');
const truthBtn = document.getElementById('truthBtn');
const validateBtn = document.getElementById('validateBtn');
const refuseBtn = document.getElementById('refuseBtn');
const pauseBtn = document.getElementById('pauseBtn');

let currentPlayer = 0;
let timeLeft = 30;
let timerId = null;
let paused = false;

// ---------- Install PWA Banner ----------
let deferredPrompt;
const installBanner = document.getElementById('install-banner');
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.style.display = 'flex';
});

installBtn.addEventListener('click', async () => {
  installBanner.style.display = 'none';
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
  }
});

// ---------- Fonctions ----------
function addPlayer(name,imgSrc){
  players.push({name,img:imgSrc});
  drawCircle();
}

function drawCircle(){
  circle.innerHTML='';
  const cx = circle.offsetWidth/2;
  const cy = circle.offsetHeight/2;
  const radius = circle.offsetWidth/2 - 80;
  const angleStep = 360/players.length;
  players.forEach((player,index)=>{
    const angleRad = (-90 + index*angleStep) * Math.PI / 180;
    const x = cx + radius*Math.cos(angleRad) -30;
    const y = cy + radius*Math.sin(angleRad) -30;
    const div = document.createElement('div');
    div.className='player';
    div.style.left=x+'px';
    div.style.top=y+'px';
    if(player.img){
      div.style.backgroundImage = `url(${player.img})`;
      div.style.backgroundSize='cover';
    } else {
      div.textContent = player.name;
    }
    circle.appendChild(div);
  });
}

function rotateBottleToPlayer(index){
  const angleStep = 360/players.length;
  const angle = index*angleStep;
  bottle.style.transform = `translate(-50%, -90%) rotate(${angle}deg)`;
}

function startTimer(){
  clearInterval(timerId);
  timeLeft=30;
  timerDisplay.textContent=timeLeft;
  timerId = setInterval(()=>{
    if(!paused){
      timeLeft--;
      timerDisplay.textContent=timeLeft;
      if(timeLeft<=0){
        clearInterval(timerId);
        alert('Temps écoulé!');
      }
    }
  },1000);
}

function pauseGame(){ paused=true; pauseBtn.textContent='Reprendre'; }
function resumeGame(){ paused=false; pauseBtn.textContent='Pause'; }

pauseBtn.addEventListener('click',()=>{paused?resumeGame():pauseGame();});

// Action / Vérité / Valider / Refuser
actionBtn.addEventListener('click',()=>{alert('Action pour '+players[currentPlayer].name)});
truthBtn.addEventListener('click',()=>{alert('Vérité pour '+players[currentPlayer].name)});
validateBtn.addEventListener('click',()=>{alert(players[currentPlayer].name+' a validé');});
refuseBtn.addEventListener('click',()=>{alert(players[currentPlayer].name+' a refusé');});

// ---------- Wake Lock ----------
let wakeLock = null;
async function requestWakeLock(){
  try{wakeLock = await navigator.wakeLock.request('screen');}
  catch(e){console.error('Wake Lock failed', e);}
}
requestWakeLock();

// ---------- Test Players ----------
addPlayer('J1', null);
addPlayer('J2', null);
addPlayer('J3', null);
addPlayer('J4', null);
rotateBottleToPlayer(0);
startTimer();

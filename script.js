// --- INITIALISATION & PWA ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { 
        navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
    });
}

const bottleImg = new Image(); 
bottleImg.src = 'heinecan_bottle.png';
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let players = [], totalPlayersCount = 0, currentPlayerIndex = 0;
let bottleAngle = 0, isSpinning = false, designatedPlayerIdx = null;
let currentTimer, timerVal = 30;

const defaultDatabase = [
    { text: "Chante un extrait de 'Allumer le feu' pour {X}.", type: "action", interaction: "any" },
    { text: "Quel est ton plus gros secret vis-à-vis de {X} ?", type: "verite", interaction: "any" },
    { text: "Fais une demande en mariage ridicule à {XO}.", type: "action", interaction: "opposite_gender" },
    { text: "Trouve un objet rouge et pose-le sur ta tête.", type: "action", interaction: "none" }
];

// --- NAVIGATION ---
function showSetup() { 
    document.getElementById('home-screen').classList.add('hidden'); 
    document.getElementById('setup-screen').classList.remove('hidden'); 
}

async function initPhotoPhase() {
    totalPlayersCount = parseInt(document.getElementById('player-count').value);
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('photo-screen').classList.remove('hidden');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    document.getElementById('video').srcObject = stream;
}

function savePlayer(gender) {
    const video = document.getElementById('video');
    const canvasPhoto = document.getElementById('photo-canvas');
    canvasPhoto.width = 200; canvasPhoto.height = 200;
    canvasPhoto.getContext('2d').drawImage(video, 0, 0, 200, 200);
    const img = new Image(); img.src = canvasPhoto.toDataURL('image/png');
    players.push({ id: currentPlayerIndex, img, gender, active: true, name: `Joueur ${currentPlayerIndex + 1}` });
    currentPlayerIndex++;
    if (currentPlayerIndex < totalPlayersCount) {
        document.getElementById('photo-instruction').innerText = `Joueur ${currentPlayerIndex + 1} : Cadrez-vous`;
    } else {
        if(video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
        startGame();
    }
}

// --- MOTEUR DE JEU (CANVAS) ---
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

function startGame() {
    document.getElementById('photo-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    window.addEventListener('resize', resize); 
    resize();
    render();
}

function resize() { 
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
    render(); 
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const activeOnes = players.filter(p => p.active);
    const radius = Math.min(cx, cy) * 0.7;

    activeOnes.forEach((p, i) => {
        // RÉGLAGE CRUCIAL : L'angle est calculé selon le nombre de joueurs présents
        const angle = i * ((Math.PI * 2) / activeOnes.length);
        const x = cx + radius * Math.cos(angle - Math.PI / 2);
        const y = cy + radius * Math.sin(angle - Math.PI / 2);
        
        if (!isSpinning && designatedPlayerIdx === i) {
            ctx.shadowBlur = 25; ctx.shadowColor = "#008200";
            ctx.strokeStyle = "#008200"; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(x, y, 48, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(p.img, x - 40, y - 40, 80, 80); ctx.restore();
    });

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(bottleAngle);
    const bH = canvas.height * 0.45; const bW = bH * (bottleImg.width / bottleImg.height);
    ctx.drawImage(bottleImg, -bW/2, -bH/2, bW, bH); ctx.restore();
}

// --- ROTATION UNIVERSELLE (1, 2, 3... 12 JOUEURS) ---
canvas.onclick = () => {
    if (isSpinning || !document.getElementById('choice-overlay').classList.contains('hidden')) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    isSpinning = true;
    const activeOnes = players.filter(p => p.active);
    const nbPlayers = activeOnes.length;
    
    // 1. Choix du gagnant (0 à nbPlayers - 1)
    designatedPlayerIdx = Math.floor(Math.random() * nbPlayers);

    // 2. Calcul de l'angle de départ propre
    let currentStart = bottleAngle % (Math.PI * 2);
    
    // 3. Calcul de la destination (5 tours + angle du joueur)
    const slice = (Math.PI * 2) / nbPlayers;
    const target = (Math.PI * 2 * 5) + (designatedPlayerIdx * slice);

    let startTime = null;
    const duration = 4000;

    function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Courbe "Quintic" pour un arrêt extrêmement doux sans rebond
        const easeOut = 1 - Math.pow(1 - progress, 5);
        
        // Progression ABSOLUE : Pas de retour en arrière possible
        bottleAngle = currentStart + (target - currentStart) * easeOut;

        render();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            bottleAngle = bottleAngle % (Math.PI * 2);
            showChoiceMenu();
        }
    }
    requestAnimationFrame(animate);
};

function showChoiceMenu() {
    const activeOnes = players.filter(p => p.active);
    document.getElementById('designated-name').innerText = activeOnes[designatedPlayerIdx].name;
    document.getElementById('choice-overlay').classList.remove('hidden');
}

// --- TÂCHES & TIMER ---
function pickTask(type) {
    const activeOnes = players.filter(p => p.active);
    const me = activeOnes[designatedPlayerIdx];
    const custom = JSON.parse(localStorage.getItem('heinecan_custom')) || [];
    const pool = [...defaultDatabase, ...custom].filter(t => t.type === type);
    let task = pool[Math.floor(Math.random() * pool.length)];
    let text = task.text;

    if (text.includes("{X}")) {
        const others = activeOnes.filter(p => p.id !== me.id);
        text = text.replace("{X}", others.length > 0 ? others[Math.floor(Math.random()*others.length)].name : "ton voisin");
    }
    if (text.includes("{XO}")) {
        const opposites = activeOnes.filter(p => p.id !== me.id && p.gender !== me.gender);
        text = text.replace("{XO}", opposites.length > 0 ? opposites[Math.floor(Math.random()*opposites.length)].name : "ton voisin");
    }
    document.getElementById('task-text').innerText = text;
    document.getElementById('choice-overlay').classList.add('hidden');
    document.getElementById('task-overlay').classList.remove('hidden');
    startTimer();
}

function startTimer() {
    timerVal = 30; document.getElementById('timer-display').innerText = timerVal;
    document.getElementById('verdict-buttons').classList.add('hidden');
    currentTimer = setInterval(() => {
        timerVal--; document.getElementById('timer-display').innerText = timerVal;
        if (timerVal <= 0) { clearInterval(currentTimer); document.getElementById('verdict-buttons').classList.remove('hidden'); }
    }, 1000);
}

function endTurn(success) {
    document.getElementById('task-overlay').classList.add('hidden');
    if (!success) {
        const activeOnes = players.filter(p => p.active);
        activeOnes[designatedPlayerIdx].active = false;
        if (players.filter(p => p.active).length < 2) { alert("Fin de partie !"); location.reload(); }
    }
    designatedPlayerIdx = null; render();
}

function toggleSettings() { document.getElementById('settings-modal').classList.toggle('hidden'); }
function addNewTask() {
    const text = document.getElementById('custom-text').value;
    if (!text) return;
    const tasks = JSON.parse(localStorage.getItem('heinecan_custom')) || [];
    tasks.push({ text, type: document.getElementById('custom-type').value, interaction: document.getElementById('custom-interaction').value });
    localStorage.setItem('heinecan_custom', JSON.stringify(tasks));
    document.getElementById('custom-text').value = ""; toggleSettings();
}

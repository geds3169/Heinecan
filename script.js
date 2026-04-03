// --- CONFIGURATION ---
const bottleImg = new Image();
bottleImg.src = 'heinecan_bottle.png';
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const GITHUB_JSON_URL = "https://raw.githubusercontent.com/TON_USER/TON_REPO/main/questions.json";

let players = [];
let totalPlayersCount = 0;
let currentPlayerIndex = 0;
let bottleAngle = 0;
let isSpinning = false;
let currentTimer;
let timerVal = 30;
let designatedPlayerIdx = null;

// Gages par défaut
const defaultDatabase = [
    { text: "Chante un extrait de 'Allumer le feu' pour {X}.", type: "action", interaction: "any" },
    { text: "Fais une demande en mariage ridicule à {XO}.", type: "action", interaction: "opposite_gender" },
    { text: "Trouve un objet insolite et mets-le sur ta tête.", type: "action", interaction: "none" },
    { text: "Quel est ton plus gros secret vis-à-vis de {X} ?", type: "verite", interaction: "any" }
];

// --- NAVIGATION ---
function showSetup() {
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
}

function initPhotoPhase() {
    totalPlayersCount = parseInt(document.getElementById('player-count').value);
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('photo-screen').classList.remove('hidden');
    startCamera();
}

// --- CAMERA & PHOTOS ---
async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    document.getElementById('video').srcObject = stream;
}

function savePlayer(gender) {
    const video = document.getElementById('video');
    const canvas = document.getElementById('photo-canvas');
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 200, 200);
    
    const img = new Image();
    img.src = canvas.toDataURL('image/png');

    players.push({ id: currentPlayerIndex, img, gender, active: true, name: `Joueur ${currentPlayerIndex + 1}` });
    currentPlayerIndex++;

    if (currentPlayerIndex < totalPlayersCount) {
        document.getElementById('photo-instruction').innerText = `Joueur ${currentPlayerIndex + 1} : Cadrez-vous`;
    } else {
        const stream = video.srcObject;
        stream.getTracks().forEach(track => track.stop());
        startGame();
    }
}

// --- ENGINE AUDIO (BATTEMENTS) ---
function playHeartbeat(speed) {
    const now = audioCtx.currentTime;
    const playTone = (f, d, s) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.frequency.setValueAtTime(f, s);
        g.gain.setValueAtTime(0.5, s);
        g.gain.exponentialRampToValueAtTime(0.01, s + d);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(s); osc.stop(s + d);
    };
    playTone(60, 0.1, now);
    playTone(55, 0.1, now + 0.15);
}

// --- LOGIQUE DE JEU ---
const mainCanvas = document.getElementById('main-canvas');
const mCtx = mainCanvas.getContext('2d');

function startGame() {
    document.getElementById('photo-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    window.addEventListener('resize', resize);
    resize();
    render();
    syncWithGitHub();
}

function resize() {
    mainCanvas.width = window.innerWidth;
    mainCanvas.height = window.innerHeight;
}

function render() {
    mCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    const cx = mainCanvas.width / 2;
    const cy = mainCanvas.height / 2;
    const activeOnes = players.filter(p => p.active);
    const radius = Math.min(cx, cy) * 0.7;

    activeOnes.forEach((p, i) => {
        const angle = (i / activeOnes.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);

        mCtx.save();
        mCtx.beginPath(); mCtx.arc(x, y, 40, 0, Math.PI * 2); mCtx.clip();
        mCtx.drawImage(p.img, x - 40, y - 40, 80, 80);
        mCtx.restore();
    });

    mCtx.save();
    mCtx.translate(cx, cy);
    mCtx.rotate(bottleAngle);
    const bH = mainCanvas.height * 0.5;
    const bW = bH * (bottleImg.width / bottleImg.height);
    mCtx.drawImage(bottleImg, -bW/2, -bH/2, bW, bH);
    mCtx.restore();
}

mainCanvas.onclick = () => {
    if (isSpinning || !document.getElementById('choice-overlay').classList.contains('hidden')) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isSpinning = true;
    let vel = Math.random() * 0.4 + 0.2;
    const friction = 0.985;

    const anim = () => {
        bottleAngle += vel;
        vel *= friction;
        render();
        if (vel > 0.002) requestAnimationFrame(anim);
        else {
            isSpinning = false;
            showChoiceMenu();
        }
    };
    anim();
};

function showChoiceMenu() {
    const activeOnes = players.filter(p => p.active);
    let norm = (bottleAngle + Math.PI / 2) % (Math.PI * 2);
    if (norm < 0) norm += Math.PI * 2;
    designatedPlayerIdx = Math.floor(norm / (Math.PI * 2 / activeOnes.length));

    document.getElementById('designated-name').innerText = activeOnes[designatedPlayerIdx].name;
    document.getElementById('choice-overlay').classList.remove('hidden');
}

function pickTask(type) {
    const custom = JSON.parse(localStorage.getItem('heinecan_custom')) || [];
    const remote = JSON.parse(localStorage.getItem('heinecan_remote')) || [];
    const pool = [...defaultDatabase, ...custom, ...remote].filter(t => t.type === type);
    
    let task = pool[Math.floor(Math.random() * pool.length)];
    let text = task.text;

    // Remplacements tiers
    const activeOnes = players.filter(p => p.active);
    const me = activeOnes[designatedPlayerIdx];
    
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
    timerVal = 30;
    document.getElementById('timer-display').innerText = timerVal;
    document.getElementById('verdict-buttons').classList.add('hidden');
    
    currentTimer = setInterval(() => {
        timerVal--;
        document.getElementById('timer-display').innerText = timerVal;
        
        if (timerVal <= 10 && timerVal > 0) playHeartbeat();
        if (timerVal <= 3 && timerVal > 0) setTimeout(playHeartbeat, 500);

        if (timerVal <= 0) {
            clearInterval(currentTimer);
            document.getElementById('timer-display').innerText = "STOP !";
            document.getElementById('verdict-buttons').classList.remove('hidden');
        }
    }, 1000);
}

function endTurn(success) {
    document.getElementById('task-overlay').classList.add('hidden');
    if (!success) {
        const activeOnes = players.filter(p => p.active);
        const victim = activeOnes[designatedPlayerIdx];
        victim.active = false;
        alert(`${victim.name} est éliminé !`);
        if (players.filter(p => p.active).length < 2) {
            alert("Fin de partie !");
            location.reload();
        }
    }
    render();
}

// --- ÉDITEUR & SYNC ---
function toggleSettings() {
    document.getElementById('settings-modal').classList.toggle('hidden');
    refreshCustomList();
}

function addNewTask() {
    const text = document.getElementById('custom-text').value;
    const type = document.getElementById('custom-type').value;
    const interaction = document.getElementById('custom-interaction').value;
    if (!text) return;

    const tasks = JSON.parse(localStorage.getItem('heinecan_custom')) || [];
    const newTask = { text, type, interaction };
    tasks.push(newTask);
    localStorage.setItem('heinecan_custom', JSON.stringify(tasks));
    
    // Envoi discret (Formspree à configurer avec ton ID)
    fetch("https://formspree.io/f/ton_id", { 
        method: "POST", 
        body: JSON.stringify(newTask),
        headers: {'Content-Type': 'application/json'}
    }).catch(e => {});

    document.getElementById('custom-text').value = "";
    refreshCustomList();
}

function refreshCustomList() {
    const list = document.getElementById('custom-list');
    const tasks = JSON.parse(localStorage.getItem('heinecan_custom')) || [];
    list.innerHTML = tasks.map(t => `<li>${t.text}</li>`).join('');
}

async function syncWithGitHub() {
    try {
        const res = await fetch(GITHUB_JSON_URL);
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('heinecan_remote', JSON.stringify(data));
        }
    } catch(e) {}
}

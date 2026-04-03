// --- INITIALISATION & PWA ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { 
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Heinecan PWA Ready'))
            .catch(err => console.log('SW Error:', err));
    });
}

const bottleImg = new Image(); 
bottleImg.src = 'heinecan_bottle.png';
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let players = [], totalPlayersCount = 0, currentPlayerIndex = 0;
let bottleAngle = 0, isSpinning = false, designatedPlayerIdx = null;
let currentTimer, timerVal = 30;

// Base de données par défaut (Gages & Vérités)
const defaultDatabase = [
    { text: "Chante un extrait de 'Allumer le feu' pour {X}.", type: "action", interaction: "any" },
    { text: "Quel est ton plus gros secret vis-à-vis de {X} ?", type: "verite", interaction: "any" },
    { text: "Fais une demande en mariage ridicule à {XO}.", type: "action", interaction: "opposite_gender" },
    { text: "Trouve un objet rouge et pose-le sur ta tête.", type: "action", interaction: "none" },
    { text: "Raconte ta pire honte devant {X}.", type: "verite", interaction: "any" },
    { text: "Imite le cri d'un animal choisi par {XO}.", type: "action", interaction: "opposite_gender" }
];

// --- NAVIGATION & SETUP ---
function showSetup() { 
    document.getElementById('home-screen').classList.add('hidden'); 
    document.getElementById('setup-screen').classList.remove('hidden'); 
}

async function initPhotoPhase() {
    totalPlayersCount = parseInt(document.getElementById('player-count').value);
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('photo-screen').classList.remove('hidden');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        document.getElementById('video').srcObject = stream;
    } catch (err) {
        alert("Caméra non accessible. Vérifiez les autorisations.");
    }
}

function savePlayer(gender) {
    const video = document.getElementById('video');
    const canvasPhoto = document.getElementById('photo-canvas');
    canvasPhoto.width = 200; canvasPhoto.height = 200;
    canvasPhoto.getContext('2d').drawImage(video, 0, 0, 200, 200);
    const img = new Image(); 
    img.src = canvasPhoto.toDataURL('image/png');
    
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
        // Calcul de l'angle pour placer les joueurs en cercle
        const angle = (i / activeOnes.length) * Math.PI * 2;
        const x = cx + radius * Math.cos(angle - Math.PI / 2);
        const y = cy + radius * Math.sin(angle - Math.PI / 2);
        
        // Aura de sélection si la bouteille s'arrête sur lui
        if (!isSpinning && designatedPlayerIdx === i) {
            ctx.shadowBlur = 25; ctx.shadowColor = "#008200";
            ctx.strokeStyle = "#008200"; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(x, y, 48, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.save(); ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(p.img, x - 40, y - 40, 80, 80); ctx.restore();
    });

    // Dessin de la bouteille
    ctx.save(); 
    ctx.translate(cx, cy); 
    ctx.rotate(bottleAngle);
    const bH = canvas.height * 0.45; 
    const bW = bH * (bottleImg.width / bottleImg.height);
    ctx.drawImage(bottleImg, -bW/2, -bH/2, bW, bH); 
    ctx.restore();
}

// --- ROTATION PRÉDICTIVE (ZÉRO SNAP) ---
canvas.onclick = () => {
    if (isSpinning || !document.getElementById('choice-overlay').classList.contains('hidden')) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    isSpinning = true;
    const activeOnes = players.filter(p => p.active);
    const nbPlayers = activeOnes.length;
    const sliceAngle = (Math.PI * 2) / nbPlayers;

    // 1. PRÉDICTION : On définit le gagnant mathématiquement dès le départ
    designatedPlayerIdx = Math.floor(Math.random() * nbPlayers);

    // 2. CALCUL DE L'ANGLE CIBLE
    const toursAleatoires = Math.floor(Math.random() * 3) + 5; // 5 à 7 tours complets
    const targetAngle = (toursAleatoires * Math.PI * 2) + (designatedPlayerIdx * sliceAngle);

    // 3. ANIMATION PAR INTERPOLATION FLUIDE (Ease-Out)
    let startAngle = bottleAngle % (Math.PI * 2);
    let startTime = null;
    const duration = 4500; // 4.5 secondes de rotation pour le suspense

    function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Formule Cubic Ease-Out : Décélération parfaite sans retour arrière
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        bottleAngle = startAngle + (targetAngle - startAngle) * easeOut;

        render();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            // On garde un angle propre pour la prochaine rotation
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

// --- LOGIQUE DES TÂCHES ---
function pickTask(type) {
    const activeOnes = players.filter(p => p.active);
    const me = activeOnes[designatedPlayerIdx];
    const custom = JSON.parse(localStorage.getItem('heinecan_custom')) || [];
    const pool = [...defaultDatabase, ...custom].filter(t => t.type === type);
    
    let task = pool[Math.floor(Math.random() * pool.length)];
    let text = task.text;

    // Remplacement des tags dynamiques {X} et {XO}
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
        if (timerVal <= 0) { 
            clearInterval(currentTimer); 
            document.getElementById('verdict-buttons').classList.remove('hidden'); 
        }
    }, 1000);
}

function endTurn(success) {
    document.getElementById('task-overlay').classList.add('hidden');
    if (!success) {
        const activeOnes = players.filter(p => p.active);
        activeOnes[designatedPlayerIdx].active = false;
        if (players.filter(p => p.active).length < 2) { 
            alert("Fin de partie ! Seul un survivant demeure."); 
            location.reload(); 
        }
    }
    render();
}

// --- ÉDITEUR DE GAGES ---
function toggleSettings() { document.getElementById('settings-modal').classList.toggle('hidden'); }

function addNewTask() {
    const text = document.getElementById('custom-text').value;
    const type = document.getElementById('custom-type').value;
    const interaction = document.getElementById('custom-interaction').value;
    if (!text) return;

    const tasks = JSON.parse(localStorage.getItem('heinecan_custom')) || [];
    tasks.push({ text, type, interaction });
    localStorage.setItem('heinecan_custom', JSON.stringify(tasks));
    
    document.getElementById('custom-text').value = ""; 
    toggleSettings();
}

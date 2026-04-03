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
    { text: "Trouve un objet rouge et pose-le sur ta tête.", type: "action", interaction: "none" },
    { text: "Raconte ta pire honte à {X}.", type: "verite", interaction: "any" }
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
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        document.getElementById('video').srcObject = stream;
    } catch(e) { alert("Accès caméra refusé."); }
}

function savePlayer(gender) {
    const video = document.getElementById('video');
    const canvasPhoto = document.getElementById('photo-canvas');
    canvasPhoto.width = 200; canvasPhoto.height = 200;
    canvasPhoto.getContext('2d').drawImage(video, 0, 0, 200, 200);
    
    const img = new Image(); 
    img.onload = () => {
        players.push({ id: currentPlayerIndex, img, gender, active: true, name: `Joueur ${currentPlayerIndex + 1}` });
        currentPlayerIndex++;
        if (currentPlayerIndex < totalPlayersCount) {
            document.getElementById('photo-instruction').innerText = `Joueur ${currentPlayerIndex + 1} : Cadrez-vous`;
        } else {
            if(video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
            startGame();
        }
    };
    img.src = canvasPhoto.toDataURL('image/png');
}

// --- MOTEUR DE JEU (CANVAS) ---
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

function startGame() {
    document.getElementById('photo-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    window.addEventListener('resize', resize); 
    resize();
    setTimeout(render, 150); 
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
    const nb = activeOnes.length;
    if (nb === 0) return;

    const sliceAngle = (Math.PI * 2) / nb;
    const outerRadius = Math.max(canvas.width, canvas.height);
    const playerRadius = Math.min(cx, cy) * 0.7;

    // 1. DESSIN DES PARTS DE GATEAU (Le décor)
    activeOnes.forEach((p, i) => {
        // On décale de -90deg pour que le joueur 1 soit en haut, 
        // et on retire une demi-part pour que le joueur soit au CENTRE de sa part.
        const startA = i * sliceAngle - Math.PI / 2 - sliceAngle / 2;
        const endA = startA + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerRadius, startA, endA);
        
        // Alternance de couleurs subtiles
        if (!isSpinning && designatedPlayerIdx === i) {
            ctx.fillStyle = "rgba(0, 130, 0, 0.25)"; // Vert plus vif si gagnant
        } else {
            ctx.fillStyle = (i % 2 === 0) ? "rgba(0, 255, 0, 0.03)" : "rgba(255, 255, 255, 0.01)";
        }
        ctx.fill();
        
        // Lignes de séparation
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    // 2. DESSIN DES AVATARS
    activeOnes.forEach((p, i) => {
        const angle = i * sliceAngle - Math.PI / 2;
        const x = cx + playerRadius * Math.cos(angle);
        const y = cy + playerRadius * Math.sin(angle);
        
        if (!isSpinning && designatedPlayerIdx === i) {
            ctx.shadowBlur = 30; ctx.shadowColor = "#008200";
            ctx.strokeStyle = "#008200"; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(x, y, 48, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        ctx.save(); 
        ctx.beginPath(); 
        ctx.arc(x, y, 40, 0, Math.PI * 2); 
        ctx.clip();
        if (p.img.complete) ctx.drawImage(p.img, x - 40, y - 40, 80, 80);
        ctx.restore();
    });

    // 3. DESSIN BOUTEILLE
    ctx.save(); 
    ctx.translate(cx, cy); 
    ctx.rotate(bottleAngle);
    const bH = canvas.height * 0.42; 
    const bW = bH * (bottleImg.width / bottleImg.height);
    ctx.drawImage(bottleImg, -bW/2, -bH/2, bW, bH); 
    ctx.restore();
}

// --- LOGIQUE DE ROTATION (ALÉATOIRE RÉEL) ---
canvas.onclick = () => {
    if (isSpinning || !document.getElementById('choice-overlay').classList.contains('hidden')) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    isSpinning = true;
    designatedPlayerIdx = null; // Reset le gagnant visuel
    
    const activeOnes = players.filter(p => p.active);
    const nbPlayers = activeOnes.length;

    // On définit une force de lancer aléatoire
    const duration = 4000 + Math.random() * 2500;
    const nbTours = 4 + Math.floor(Math.random() * 6);
    const forceAleatoire = Math.random() * (Math.PI * 2);
    const targetAngle = (nbTours * Math.PI * 2) + forceAleatoire;
    const startAngle = bottleAngle % (Math.PI * 2);

    let startTime = null;

    function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Courbe de freinage naturelle
        const easeOut = 1 - Math.pow(1 - progress, 4);
        
        bottleAngle = startAngle + (targetAngle - startAngle) * easeOut;
        render();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            bottleAngle = bottleAngle % (Math.PI * 2);
            
            // DÉTERMINATION DU GAGNANT PAR LA ZONE
            const slice = (Math.PI * 2) / nbPlayers;
            // On ajuste l'angle pour correspondre aux parts dessinées
            let normalizedAngle = (bottleAngle + Math.PI/2 + slice/2) % (Math.PI * 2);
            if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
            
            designatedPlayerIdx = Math.floor(normalizedAngle / slice) % nbPlayers;
            
            render();
            setTimeout(showChoiceMenu, 600);
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

    // Sécurité si seul
    const others = activeOnes.filter(p => p.id !== me.id);
    const targetName = others.length > 0 ? others[Math.floor(Math.random()*others.length)].name : "ton voisin";

    if (text.includes("{X}")) text = text.replace("{X}", targetName);
    if (text.includes("{XO}")) {
        const opposites = others.filter(p => p.gender !== me.gender);
        text = text.replace("{XO}", opposites.length > 0 ? opposites[Math.floor(Math.random()*opposites.length)].name : targetName);
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
        if (players.filter(p => p.active).length < 2) { 
            alert("Fin de partie ! Le dernier Heinecan l'emporte."); 
            location.reload(); 
        }
    }
    designatedPlayerIdx = null; 
    render();
}

function toggleSettings() { document.getElementById('settings-modal').classList.toggle('hidden'); }
function addNewTask() {
    const text = document.getElementById('custom-text').value;
    if (!text) return;
    const tasks = JSON.parse(localStorage.getItem('heinecan_custom')) || [];
    tasks.push({ 
        text, 
        type: document.getElementById('custom-type').value, 
        interaction: document.getElementById('custom-interaction').value 
    });
    localStorage.setItem('heinecan_custom', JSON.stringify(tasks));
    document.getElementById('custom-text').value = ""; 
    toggleSettings();
}

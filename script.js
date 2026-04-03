const bottleImg = new Image(); bottleImg.src = 'heinecan_bottle.png';
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let players = [], totalPlayersCount = 0, currentPlayerIndex = 0;
let bottleAngle = 0, isSpinning = false, designatedPlayerIdx = null;
let currentTimer, timerVal = 30;

const defaultDatabase = [
    { text: "Chante un extrait de chanson pour {X}.", type: "action" },
    { text: "Raconte ton secret le plus drôle à {X}.", type: "verite" },
    { text: "Imite un animal et fais-le deviner à {X}.", type: "action" },
    { text: "Quelle est ta plus grande peur ?", type: "verite" }
];

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
    const canvasP = document.getElementById('photo-canvas');
    canvasP.width = 200; canvasP.height = 200;
    canvasP.getContext('2d').drawImage(video, 0, 0, 200, 200);
    const img = new Image();
    img.onload = () => {
        players.push({ 
            id: players.length + 1, 
            img: img, 
            active: true, 
            name: `Joueur ${players.length + 1}` 
        });
        if (players.length < totalPlayersCount) {
            document.getElementById('photo-instruction').innerText = `Joueur ${players.length + 1} : Photo`;
        } else {
            video.srcObject.getTracks().forEach(t => t.stop());
            startGame();
        }
    };
    img.src = canvasP.toDataURL('image/png');
}

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

function startGame() {
    document.getElementById('photo-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    window.addEventListener('resize', resize); resize();
    render();
}

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; render(); }

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const activeOnes = players.filter(p => p.active);
    const slice = (Math.PI * 2) / activeOnes.length;
    const radius = Math.min(cx, cy) * 0.7;

    activeOnes.forEach((p, i) => {
        const angle = i * slice - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);

        // Avatar
        ctx.save();
        ctx.beginPath(); ctx.arc(x, y, 45, 0, Math.PI*2);
        ctx.fillStyle = (designatedPlayerIdx === i && !isSpinning) ? "#00ff00" : "#222";
        ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI*2); ctx.clip();
        ctx.drawImage(p.img, x-40, y-40, 80, 80);
        ctx.restore();

        // Badge Numéro
        ctx.fillStyle = "var(--green)";
        ctx.beginPath(); ctx.arc(x + 30, y - 30, 15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "white"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center";
        ctx.fillText(p.id, x + 30, y - 25);
    });

    // Bouteille
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(bottleAngle);
    const bH = canvas.height * 0.4; const bW = bH * (bottleImg.width / bottleImg.height);
    ctx.drawImage(bottleImg, -bW/2, -bH/2, bW, bH); ctx.restore();
}

// PHYSIQUE NATURELLE : Friction + Inertie
canvas.onclick = () => {
    if (isSpinning || !document.getElementById('choice-overlay').classList.contains('hidden')) return;
    isSpinning = true;
    designatedPlayerIdx = null;

    let velocity = 0.25 + Math.random() * 0.25;
    const friction = 0.982;

    const spin = () => {
        bottleAngle += velocity;
        velocity *= friction;
        render();

        if (velocity > 0.0015) {
            requestAnimationFrame(spin);
        } else {
            isSpinning = false;
            const activeOnes = players.filter(p => p.active);
            const slice = (Math.PI * 2) / activeOnes.length;
            let norm = (bottleAngle + Math.PI/2) % (Math.PI * 2);
            if (norm < 0) norm += Math.PI * 2;
            designatedPlayerIdx = Math.floor(norm / slice) % activeOnes.length;
            render();
            setTimeout(() => { document.getElementById('choice-overlay').classList.remove('hidden'); }, 500);
        }
    };
    spin();
};

function pickTask(type) {
    const p = players.filter(p => p.active)[designatedPlayerIdx];
    document.getElementById('active-player-reminder').src = p.img.src;
    document.getElementById('active-player-number').innerText = p.id;

    const tasks = defaultDatabase.filter(t => t.type === type);
    let text = tasks[Math.floor(Math.random()*tasks.length)].text;
    
    // Remplacement intelligent du nom
    const others = players.filter(pl => pl.active && pl.id !== p.id);
    const target = others.length > 0 ? others[Math.floor(Math.random()*others.length)].name : "ton voisin";
    text = text.replace("{X}", target);

    document.getElementById('task-text').innerText = text;
    document.getElementById('choice-overlay').classList.add('hidden');
    document.getElementById('task-overlay').classList.remove('hidden');
    
    timerVal = 30;
    document.getElementById('timer-display').innerText = timerVal;
    document.getElementById('verdict-buttons').classList.add('hidden');
    
    currentTimer = setInterval(() => {
        timerVal--;
        document.getElementById('timer-display').innerText = timerVal;
        if(timerVal <= 0) {
            clearInterval(currentTimer);
            document.getElementById('verdict-buttons').classList.remove('hidden');
        }
    }, 1000);
}

function endTurn(success) {
    if (!success) {
        players.filter(p => p.active)[designatedPlayerIdx].active = false;
        if (players.filter(p => p.active).length < 2) { alert("Fin de partie !"); location.reload(); }
    }
    document.getElementById('task-overlay').classList.add('hidden');
    designatedPlayerIdx = null; render();
}

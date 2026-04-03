const bottleImg = new Image(); bottleImg.src = 'heinecan_bottle.png';
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let players = [], totalPlayersCount = 0, currentPlayerIndex = 0;
let bottleAngle = 0, isSpinning = false, designatedPlayerIdx = null;
let currentTimer, timerVal = 30;

const defaultTasks = [
    { text: "Chante un refrain célèbre pour {X}.", type: "action" },
    { text: "Raconte ta plus grosse honte à {X}.", type: "verite" },
    { text: "Fais une grimace et tiens-la 10s.", type: "action" },
    { text: "Quel est ton plus grand rêve ?", type: "verite" }
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
    const canvas = document.getElementById('photo-canvas');
    canvas.width = 200; canvas.height = 200;
    canvas.getContext('2d').drawImage(video, 0, 0, 200, 200);
    
    const img = new Image();
    img.onload = () => {
        players.push({ id: players.length + 1, img: img, active: true, gender: gender });
        if (players.length < totalPlayersCount) {
            document.querySelector('.photo-overlay-id').innerText = players.length + 1;
            document.getElementById('photo-instruction').innerText = "Joueur " + (players.length + 1);
        } else {
            video.srcObject.getTracks().forEach(t => t.stop());
            startGame();
        }
    };
    img.src = canvas.toDataURL('image/png');
}

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

function startGame() {
    document.getElementById('photo-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    window.onresize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; render(); };
    window.onresize();
}

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

        // Photo
        ctx.save();
        ctx.beginPath(); ctx.arc(x, y, 45, 0, Math.PI*2);
        ctx.fillStyle = (designatedPlayerIdx === i && !isSpinning) ? "#00ff00" : "#333";
        ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI*2); ctx.clip();
        ctx.drawImage(p.img, x-40, y-40, 80, 80);
        ctx.restore();

        // Badge ID sur Canvas
        ctx.fillStyle = "var(--green)";
        ctx.beginPath(); ctx.arc(x + 30, y - 30, 15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "white"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center";
        ctx.fillText(p.id, x + 30, y - 25);
    });

    // Bouteille
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(bottleAngle);
    const bH = canvas.height * 0.4;
    ctx.drawImage(bottleImg, -(bH * 0.22) / 2, -bH / 2, bH * 0.22, bH);
    ctx.restore();
}

canvas.onclick = () => {
    if (isSpinning || !document.getElementById('choice-overlay').classList.contains('hidden')) return;
    isSpinning = true; designatedPlayerIdx = null;
    let velocity = 0.2 + Math.random() * 0.3;
    const friction = 0.985;

    const loop = () => {
        bottleAngle += velocity; velocity *= friction; render();
        if (velocity > 0.002) requestAnimationFrame(loop);
        else {
            isSpinning = false;
            const activeOnes = players.filter(p => p.active);
            const slice = (Math.PI * 2) / activeOnes.length;
            let norm = (bottleAngle + Math.PI/2) % (Math.PI * 2);
            if (norm < 0) norm += Math.PI * 2;
            designatedPlayerIdx = Math.floor(norm / slice) % activeOnes.length;
            render();
            setTimeout(() => document.getElementById('choice-overlay').classList.remove('hidden'), 500);
        }
    };
    loop();
};

function pickTask(type) {
    const p = players.filter(p => p.active)[designatedPlayerIdx];
    document.getElementById('active-player-reminder').src = p.img.src;
    document.getElementById('active-player-number').innerText = p.id;
    
    let task = defaultTasks.filter(t => t.type === type)[Math.floor(Math.random() * 2)];
    let text = task.text.replace("{X}", "le joueur à ta droite");

    document.getElementById('task-text').innerText = text;
    document.getElementById('choice-overlay').classList.add('hidden');
    document.getElementById('task-overlay').classList.remove('hidden');
    
    timerVal = 30; document.getElementById('timer-display').innerText = timerVal;
    document.getElementById('verdict-buttons').classList.add('hidden');
    clearInterval(currentTimer);
    currentTimer = setInterval(() => {
        timerVal--; document.getElementById('timer-display').innerText = timerVal;
        if (timerVal <= 0) { clearInterval(currentTimer); document.getElementById('verdict-buttons').classList.remove('hidden'); }
    }, 1000);
}

function endTurn(success) {
    if (!success) {
        players.filter(p => p.active)[designatedPlayerIdx].active = false;
        if (players.filter(p => p.active).length < 2) { alert("Game Over !"); location.reload(); }
    }
    document.getElementById('task-overlay').classList.add('hidden');
    render();
}

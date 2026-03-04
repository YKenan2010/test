const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* ===============================
   Responsive Canvas
=================================*/
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

/* ===============================
   INJECT CSS
=================================*/
(function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
        .ui {
            position: absolute;
            color: white;
            font-size: 18px;
            font-family: "GameFont", monospace;
            user-select: none;
            pointer-events: none;
            text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
        }
        #health { top: 10px; left: 15px; }
        #score  { top: 10px; left: 50%; transform: translateX(-50%); }
        #raid   { top: 10px; right: 15px; }
        #fps    { bottom: 5px; right: 10px; font-size: 12px; opacity: .6; }

        #bgToggle {
            position: absolute;
            top: 46px;
            left: 50%;
            transform: translateX(-50%);
            padding: 3px 14px;
            font-family: "GameFont", monospace;
            font-size: 13px;
            background: rgba(255,255,255,0.15);
            color: white;
            border: 1px solid rgba(255,255,255,0.35);
            cursor: pointer;
            border-radius: 4px;
            user-select: none;
            z-index: 10;
        }
        #bgToggle:active { background: rgba(255,255,255,0.3); }

        #joystick {
            position: absolute;
            bottom: 30px;
            left: 30px;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: rgba(255,255,255,0.08);
            border: 2px solid rgba(255,255,255,0.2);
            touch-action: none;
        }
        #stick {
            position: absolute;
            width: 60px;
            height: 60px;
            left: 30px;
            top: 30px;
            border-radius: 50%;
            background: rgba(255,255,255,0.3);
            transition: top 0.05s;
        }

        #shootBtn {
            position: absolute;
            bottom: 40px;
            right: 40px;
            width: 90px;
            height: 90px;
            background: url('./visuals/shoot_button.png') center/cover no-repeat;
            border: none;
            background-color: transparent;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
        }

        /* Player death blowup */
        #blowupGif {
            position: absolute;
            display: none;
            pointer-events: none;
            width: 140px;
            height: 140px;
            transform: translate(-50%, -50%);
            z-index: 20;
        }

        /* Enemy blowup clones */
        .enemyBlowup {
            position: absolute;
            display: block;
            pointer-events: none;
            width: 70px;
            height: 70px;
            transform: translate(-50%, -50%);
            z-index: 19;
        }

        #gameOver {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.6);
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            color: white;
            font-family: "GameFont", monospace;
            z-index: 30;
        }
        #gameOver h1 { font-size: 48px; margin-bottom: 10px; }
        #gameOver div { font-size: 22px; margin: 4px 0; }
        #gameOver button {
            margin-top: 10px;
            padding: 8px 25px;
            font-family: "GameFont", monospace;
            font-size: 16px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
})();

/* ===============================
   INJECT HTML UI
=================================*/
(function injectUI() {
    document.body.insertAdjacentHTML("beforeend", `
        <div id="health" class="ui"></div>
        <div id="score"  class="ui"></div>
        <div id="raid"   class="ui"></div>
        <div id="fps"    class="ui"></div>

        <button id="bgToggle">🌙 Night</button>

        <div id="joystick"><div id="stick"></div></div>
        <button id="shootBtn"></button>

        <img id="blowupGif" src="./visuals/blowup.gif" alt="">

        <div id="gameOver">
            <h1>GAME OVER</h1>
            <div id="finalScore"></div>
            <div id="highScore"></div>
            <button id="restartBtn">Restart</button>
            <button id="menuBtn">Menu</button>
        </div>
    `);

    document.getElementById("restartBtn").addEventListener("click", restartGame);
})();

/* ===============================
   FPS CONFIG
=================================*/
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

let lastFrame  = 0;
let fpsCounter = 0;
let fpsTimer   = 0;
let currentFPS = 0;

/* ===============================
   ASSET LOADING
=================================*/
const assets = [];

function load(src) {
    const img = new Image();
    img.src = src;
    assets.push(img);
    return img;
}

/* Backgrounds */
const bgNight = load("./visuals/night.png");
const bgDay   = load("./visuals/day.jpeg");

/* Default: night */
let isNight   = true;
let currentBg = bgNight;

/* Other assets */
const planeImg  = load("./visuals/plane.png");
const enemyImgs = [
    load("./visuals/enemy_1.png"),
    load("./visuals/enemy_2.png"),
    load("./visuals/enemy_3.png")
];
const bulletImg = load("./visuals/bullet.png");
const cloudImg  = load("./visuals/cloud.png");

/* ===============================
   AUDIO
=================================*/
const shootSoundSrc  = "./audio/shoot.mp3";
const explodeSound   = new Audio("./audio/explode.mp3");
explodeSound.volume  = 0.9;

/* Hit sound — cloned so overlapping hits don't cut each other */
function playHitSound() {
    const s = new Audio("./audio/hit.mp3");
    s.volume = 0.7;
    s.play().catch(() => {});
}

/* Clone-based pool for rapid shoot SFX */
function playShootSound() {
    const s = new Audio(shootSoundSrc);
    s.volume = 0.45;
    s.play().catch(() => {});
}

function playExplodeSound(vol = 0.9) {
    const s = new Audio("./audio/explode.mp3");
    s.volume = vol;
    s.play().catch(() => {});
}

/* ===============================
   EXPLOSION GIF
=================================*/
const blowupEl  = document.getElementById("blowupGif");
let   blowupTid = null;

const BLOWUP_DURATION = 1800; /* ms — match your GIF length */

function showBlowup(screenX, screenY) {
    blowupEl.style.left    = screenX + "px";
    blowupEl.style.top     = screenY + "px";
    /* Force GIF to restart from frame 1 */
    blowupEl.src = "./visuals/blowup.gif?" + Date.now();
    blowupEl.style.display = "block";

    clearTimeout(blowupTid);
    blowupTid = setTimeout(() => {
        blowupEl.style.display = "none";
    }, BLOWUP_DURATION);
}

/* Enemy blowup — half-size, auto-removes itself */
function showEnemyBlowup(screenX, screenY) {
    const img = document.createElement("img");
    img.className = "enemyBlowup";
    img.src = "./visuals/blowup.gif?" + Date.now();
    img.style.left = screenX + "px";
    img.style.top  = screenY + "px";
    document.body.appendChild(img);
    setTimeout(() => img.remove(), BLOWUP_DURATION);
}

/* ===============================
   DAY / NIGHT TOGGLE
=================================*/
const bgToggleBtn = document.getElementById("bgToggle");
bgToggleBtn.addEventListener("click", () => {
    isNight   = !isNight;
    currentBg = isNight ? bgNight : bgDay;
    bgToggleBtn.textContent = isNight ? "🌙 Night" : "☀️ Day";
});

/* ===============================
   GAME STATE
=================================*/
let player, bullets, enemies, clouds;
let score, raidCount, highScore;
let gameOver, playerVisible;

function resetGame() {
    player        = { x: 100, y: canvas.height / 2, health: 100 };
    bullets       = [];
    enemies       = [];
    clouds        = [];
    score         = 0;
    raidCount     = 0;
    highScore     = localStorage.getItem("planeHighScore") || 0;
    gameOver      = false;
    playerVisible = true;
    blowupEl.style.display = "none";
    clearTimeout(blowupTid);
}
resetGame();

/* ===============================
   CAMERA
=================================*/
let cameraY = 0;

/* ===============================
   CONTROLS
=================================*/
let moveY    = 0;
let dragging = false;

const joystick = document.getElementById("joystick");
const stick    = document.getElementById("stick");
const shootBtn = document.getElementById("shootBtn");

function handleMove(clientY) {
    const rect = joystick.getBoundingClientRect();
    let y = clientY - rect.top - 60;
    y = Math.max(-40, Math.min(40, y));
    stick.style.top = (30 + y) + "px";
    moveY = y / 40;
}

/* Mouse */
joystick.addEventListener("mousedown", () => dragging = true);
window.addEventListener("mouseup", () => {
    dragging = false;
    stick.style.top = "30px";
    moveY = 0;
});
window.addEventListener("mousemove", e => {
    if (!dragging) return;
    handleMove(e.clientY);
});

/* Touch */
joystick.addEventListener("touchstart", e => {
    e.preventDefault();
    dragging = true;
}, { passive: false });
window.addEventListener("touchend", () => {
    dragging = false;
    stick.style.top = "30px";
    moveY = 0;
});
window.addEventListener("touchmove", e => {
    if (!dragging) return;
    handleMove(e.touches[0].clientY);
});

/* Shooting */
function shoot() {
    if (gameOver) return;
    bullets.push({ x: player.x + 60, y: player.y + 20 });
    playShootSound();
    if (typeof triggerShake === "function") triggerShake(5);
}

shootBtn.addEventListener("mousedown", shoot);
shootBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    shoot();
}, { passive: false });

/* ===============================
   CLOUD SPAWN
=================================*/
setInterval(() => {
    clouds.push({
        x:     canvas.width,
        y:     Math.random() * canvas.height,
        speed: 1 + Math.random() * 2
    });
}, 1500);

/* ===============================
   RAID SPAWN
=================================*/
function spawnRaid() {
    if (gameOver) return;

    const count = 2 + Math.floor(Math.random() * 3);
    raidCount++;

    for (let i = 0; i < count; i++) {
        enemies.push({
            x:    canvas.width + i * 80,
            y:    Math.random() * (canvas.height - 60),
            type: Math.floor(Math.random() * 3),
            dir:  Math.random() > 0.5 ? 1 : -1
        });
    }

    setTimeout(spawnRaid, 3000 + Math.random() * 2000);
}
spawnRaid();

/* ===============================
   MAIN GAME LOOP
=================================*/
function gameLoop(timestamp) {

    if (timestamp - lastFrame < FRAME_TIME) {
        requestAnimationFrame(gameLoop);
        return;
    }
    lastFrame = timestamp;

    fpsCounter++;
    if (timestamp > fpsTimer + 1000) {
        currentFPS = fpsCounter;
        fpsCounter = 0;
        fpsTimer   = timestamp;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const shake = (typeof getShakeOffset === "function") ? getShakeOffset() : { x: 0, y: 0 };

    ctx.save();
    ctx.translate(shake.x, shake.y);

    ctx.drawImage(currentBg, 0, 0, canvas.width, canvas.height);

    cameraY += (player.y - cameraY) * 0.08;
    ctx.translate(0, -cameraY + canvas.height / 2 - 100);

    /* Player */
    player.y += moveY * 5;
    player.y  = Math.max(0, Math.min(canvas.height - 60, player.y));
    if (playerVisible) {
        ctx.drawImage(planeImg, player.x, player.y, 60, 60);
    }

    /* Bullets */
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += 8;
        ctx.drawImage(bulletImg, b.x, b.y, 20, 10);

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (b.x < e.x + 50 && b.x + 20 > e.x &&
                b.y < e.y + 50 && b.y + 10 > e.y) {
                /* Enemy screen position for GIF */
                const esx = e.x + 25;
                const esy = (e.y + 25) - cameraY + canvas.height / 2 - 100;
                showEnemyBlowup(esx, esy);
                playExplodeSound(0.45);

                enemies.splice(j, 1);
                bullets.splice(i, 1);
                score += 10;
                hit = true;
                break;
            }
        }
        if (!hit && b.x > canvas.width) bullets.splice(i, 1);
    }

    /* Enemies */
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x -= 3;
        e.y += e.dir * 2;
        if (e.y < 0 || e.y > canvas.height - 50) e.dir *= -1;

        ctx.drawImage(enemyImgs[e.type], e.x, e.y, 50, 50);

        if (e.x < player.x + 50 && e.x + 50 > player.x &&
            e.y < player.y + 50 && e.y + 50 > player.y) {
            player.health -= 10;
            playHitSound();
            if (typeof triggerDamageFlash === "function") triggerDamageFlash();
            enemies.splice(i, 1);
            continue;
        }
        if (e.x < -60) enemies.splice(i, 1);
    }

    /* Clouds */
    clouds.forEach(c => {
        c.x -= c.speed;
        ctx.globalAlpha = 0.4;
        ctx.drawImage(cloudImg, c.x, c.y, 120, 60);
        ctx.globalAlpha = 1;
    });

    ctx.restore();

    if (typeof drawDamageFlash === "function") drawDamageFlash(ctx, canvas);

    document.getElementById("health").innerText = "Health: " + player.health;
    document.getElementById("score").innerText  = "Score: "  + score;
    document.getElementById("raid").innerText   = "Raid: "   + raidCount;
    document.getElementById("fps").innerText    = "FPS: "    + currentFPS;

    /* Death check */
    if (player.health <= 0 && !gameOver) {
        triggerDeath();
        return;
    }

    requestAnimationFrame(gameLoop);
}

/* ===============================
   DEATH SEQUENCE
=================================*/
function triggerDeath() {
    gameOver      = true;
    playerVisible = false;

    /* Player centre in screen space */
    const sx = player.x + 30;
    const sy = (player.y + 30) - cameraY + canvas.height / 2 - 100;

    showBlowup(sx, sy);
    playExplodeSound(0.9);
    if (typeof triggerShake === "function") triggerShake(20);

    /* Keep rendering world during explosion, then show game-over */
    const startTime = performance.now();

    function deathLoop(timestamp) {
        if (timestamp - lastFrame >= FRAME_TIME) {
            lastFrame = timestamp;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const shake = (typeof getShakeOffset === "function") ? getShakeOffset() : { x: 0, y: 0 };

            ctx.save();
            ctx.translate(shake.x, shake.y);
            ctx.drawImage(currentBg, 0, 0, canvas.width, canvas.height);
            ctx.translate(0, -cameraY + canvas.height / 2 - 100);

            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                e.x -= 3;
                e.y += e.dir * 2;
                if (e.y < 0 || e.y > canvas.height - 50) e.dir *= -1;
                ctx.drawImage(enemyImgs[e.type], e.x, e.y, 50, 50);
                if (e.x < -60) enemies.splice(i, 1);
            }

            clouds.forEach(c => {
                c.x -= c.speed;
                ctx.globalAlpha = 0.35;
                ctx.drawImage(cloudImg, c.x, c.y, 120, 60);
                ctx.globalAlpha = 1;
            });

            ctx.restore();
            if (typeof drawDamageFlash === "function") drawDamageFlash(ctx, canvas);
        }

        if (timestamp - startTime < BLOWUP_DURATION) {
            requestAnimationFrame(deathLoop);
        } else {
            endGame();
        }
    }

    requestAnimationFrame(deathLoop);
}

/* ===============================
   GAME OVER SCREEN
=================================*/
function endGame() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("planeHighScore", highScore);
    }
    document.getElementById("finalScore").innerText = "Score: "      + score;
    document.getElementById("highScore").innerText  = "High Score: " + highScore;
    document.getElementById("gameOver").style.display = "flex";
}

function restartGame() {
    document.getElementById("gameOver").style.display = "none";
    resetGame();
    spawnRaid();
    requestAnimationFrame(gameLoop);
}

/* ===============================
   START AFTER ASSETS LOAD
=================================*/
(function startAfterLoad() {
    let loaded = 0;

    function checkDone() {
        loaded++;
        if (loaded >= assets.length) requestAnimationFrame(gameLoop);
    }

    assets.forEach(img => {
        if (img.complete) { checkDone(); }
        else { img.onload = checkDone; img.onerror = checkDone; }
    });
})();
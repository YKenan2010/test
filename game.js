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
   FPS CONFIG
=================================*/
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

let lastFrame = 0;
let fpsCounter = 0;
let fpsTimer = 0;
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

const bgImg = load("./visuals/background.png");
const planeImg = load("./visuals/plane.png");
const enemyImgs = [
    load("./visuals/enemy_1.png"),
    load("./visuals/enemy_2.png"),
    load("./visuals/enemy_3.png")
];
const bulletImg = load("./visuals/bullet.png");
const cloudImg = load("./visuals/cloud.png");

/* ===============================
   GAME STATE
=================================*/
let player, bullets, enemies, clouds;
let score, raidCount, highScore;
let gameOver;

function resetGame() {
    player = { x: 100, y: canvas.height / 2, health: 100 };
    bullets = [];
    enemies = [];
    clouds = [];
    score = 0;
    raidCount = 0;
    highScore = localStorage.getItem("planeHighScore") || 0;
    gameOver = false;
}
resetGame();

/* ===============================
   CAMERA
=================================*/
let cameraY = 0;

/* ===============================
   CONTROLS
=================================*/
let moveY = 0;
let dragging = false;

const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");
const shootBtn = document.getElementById("shootBtn");

/* Shared movement handler */
function handleMove(clientY) {
    let rect = joystick.getBoundingClientRect();
    let y = clientY - rect.top - 60;
    y = Math.max(-40, Math.min(40, y));
    stick.style.top = 30 + y + "px";
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
joystick.addEventListener("touchstart", () => dragging = true);
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
    triggerShake(5);
}

shootBtn.addEventListener("mousedown", shoot);
shootBtn.addEventListener("touchstart", shoot);

/* ===============================
   CLOUD SPAWN
=================================*/
setInterval(() => {
    clouds.push({
        x: canvas.width,
        y: Math.random() * canvas.height,
        speed: 1 + Math.random() * 2
    });
}, 1500);

/* ===============================
   RAID SPAWN
=================================*/
function spawnRaid() {
    if (gameOver) return;

    let count = 2 + Math.floor(Math.random() * 3);
    raidCount++;

    for (let i = 0; i < count; i++) {
        enemies.push({
            x: canvas.width + i * 80,
            y: Math.random() * (canvas.height - 60),
            type: Math.floor(Math.random() * 3),
            dir: Math.random() > 0.5 ? 1 : -1
        });
    }

    setTimeout(spawnRaid, 3000 + Math.random() * 2000);
}
spawnRaid();

/* ===============================
   GAME LOOP
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
        fpsTimer = timestamp;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* Get shake offset */
    const shake = getShakeOffset();

    /* ===============================
       WORLD DRAW
    =================================*/
    ctx.save();

    /* Apply shake only to world */
    ctx.translate(shake.x, shake.y);

    /* Draw background */
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    /* Smooth camera follow */
    cameraY += (player.y - cameraY) * 0.08;
    ctx.translate(0, -cameraY + canvas.height / 2 - 100);

    /* Player movement */
    player.y += moveY * 5;
    player.y = Math.max(0, Math.min(canvas.height - 60, player.y));

    ctx.drawImage(planeImg, player.x, player.y, 60, 60);

    /* Bullets */
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += 8;

        ctx.drawImage(bulletImg, b.x, b.y, 20, 10);

        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];

            if (
                b.x < e.x + 50 &&
                b.x + 20 > e.x &&
                b.y < e.y + 50 &&
                b.y + 10 > e.y
            ) {
                enemies.splice(j, 1);
                bullets.splice(i, 1);
                score += 10;
                break;
            }
        }

        if (b.x > canvas.width) bullets.splice(i, 1);
    }

    /* Enemies */
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];

        e.x -= 3;
        e.y += e.dir * 2;

        if (e.y < 0 || e.y > canvas.height - 50) e.dir *= -1;

        ctx.drawImage(enemyImgs[e.type], e.x, e.y, 50, 50);

        if (
            e.x < player.x + 50 &&
            e.x + 50 > player.x &&
            e.y < player.y + 50 &&
            e.y + 50 > player.y
        ) {
            player.health -= 10;
            triggerDamageFlash();
            enemies.splice(i, 1);
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

    /* ===============================
       SCREEN EFFECTS
    =================================*/
    drawDamageFlash(ctx, canvas);

    /* ===============================
       UI
    =================================*/
    document.getElementById("health").innerText = "Health: " + player.health;
    document.getElementById("score").innerText = "Score: " + score;
    document.getElementById("raid").innerText = "Raid: " + raidCount;
    document.getElementById("fps").innerText = "FPS: " + currentFPS;

    if (player.health <= 0) endGame();

    requestAnimationFrame(gameLoop);
}

/* ===============================
   GAME OVER
=================================*/
function endGame() {
    gameOver = true;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("planeHighScore", highScore);
    }

    document.getElementById("finalScore").innerText = "Score: " + score;
    document.getElementById("highScore").innerText = "High Score: " + highScore;
    document.getElementById("gameOver").style.display = "flex";
}

function restartGame() {
    document.getElementById("gameOver").style.display = "none";
    resetGame();
    spawnRaid();
}

/* ===============================
   START AFTER LOAD
=================================*/
function startAfterLoad() {
    let loaded = 0;

    assets.forEach(img => {
        img.onload = () => {
            loaded++;
            if (loaded === assets.length) {
                requestAnimationFrame(gameLoop);
            }
        };
    });
}
startAfterLoad();
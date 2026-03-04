let shakePower = 1;
let damageFlash = 0;

function triggerShake(power = 5) {
    shakePower = power;
}

function triggerDamageFlash() {
    damageFlash = 1;
}

function getShakeOffset() {
    if (shakePower <= 0) return { x: 0, y: 0 };

    const offset = {
        x: (Math.random() - 0.5) * shakePower,
        y: (Math.random() - 0.5) * shakePower
    };

    shakePower *= 0.9;
    return offset;
}

function drawDamageFlash(ctx, canvas) {
    if (damageFlash > 0) {
        ctx.fillStyle = "rgba(255,0,0,0.25)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        damageFlash -= 0.03;
    }
}
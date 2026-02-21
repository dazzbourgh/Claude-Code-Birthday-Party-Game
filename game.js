// Configuration
const CONFIG = {
    PLAYER_SPEED: 4 * 3,               // base speed
    BOOST_MULTIPLIER: 2.2,           // shift multiplier
    PLAYER_MASS: 5,                // simulated mass
    PUCK_MASS: 1,                  // simulated mass
    RINK_LINE_WIDTH: 4,            // thickness of the orange lines
    GOAL_WIDTH: 150,               // size of goals
    PLAYER_RADIUS: 25,             // size of player
    PUCK_RADIUS: 15,               // size of puck
    FPS: 60,                       // frames per second (logic)
    CORNER_RADIUS: 100,            // radius of rink corners
    FRICTION: 0.99,                // puck friction
    PLAYER_LERP: 0.2               // how fast players change direction/recover
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 1000;
canvas.height = 600;

// Load images
const imgP1 = new Image();
imgP1.src = 'claude_orange.svg';

const imgP2 = new Image();
imgP2.src = 'claude_pink.svg';

// Game State
const state = {
    p1: { x: 200, y: 340, vx: 0, vy: 0, radius: CONFIG.PLAYER_RADIUS, mass: CONFIG.PLAYER_MASS, score: 0, lastDx: 1, lastDy: 0, boosting: false },
    p2: { x: 800, y: 340, vx: 0, vy: 0, radius: CONFIG.PLAYER_RADIUS, mass: CONFIG.PLAYER_MASS, score: 0, lastDx: -1, lastDy: 0, boosting: false },
    puck: { x: 500, y: 340, vx: 0, vy: 0, radius: CONFIG.PUCK_RADIUS, mass: CONFIG.PUCK_MASS },
    keys: {}
};

// Input handling
window.addEventListener('keydown', (e) => state.keys[e.code] = true);
window.addEventListener('keyup', (e) => state.keys[e.code] = false);

// Drawing Rink
function drawRink() {
    ctx.strokeStyle = '#ff8800'; // Orange
    ctx.lineWidth = CONFIG.RINK_LINE_WIDTH;

    const m = CONFIG.RINK_LINE_WIDTH / 2; // margin
    const top = m + 80;
    const bottom = canvas.height - m;
    const centerY = top + (bottom - top) / 2;

    // Outer bounds with rounded corners
    ctx.beginPath();
    ctx.roundRect(m, top, canvas.width - 2 * m, bottom - top, CONFIG.CORNER_RADIUS);
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, top);
    ctx.lineTo(canvas.width / 2, bottom);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(canvas.width / 2, centerY, 75, 0, Math.PI * 2);
    ctx.stroke();

    // Draw goals (just visual for now)
    ctx.fillStyle = 'rgba(255, 136, 0, 0.2)';
    ctx.fillRect(0, centerY - CONFIG.GOAL_WIDTH / 2, 50, CONFIG.GOAL_WIDTH);
    ctx.fillRect(canvas.width - 50, centerY - CONFIG.GOAL_WIDTH / 2, 50, CONFIG.GOAL_WIDTH);
}

// Drawing player
function drawCircle(obj, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
    ctx.fill();

    // Optional border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawPlayer(obj, img, fallbackColor) {
    if (img.complete && img.naturalWidth !== 0) {
        // Draw the image centered around obj.x, obj.y
        ctx.drawImage(img, obj.x - obj.radius, obj.y - obj.radius, obj.radius * 2, obj.radius * 2);
    } else {
        // Fallback if image not loaded yet
        drawCircle(obj, fallbackColor);
    }
}

function resolveCollision(c1, c2) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return; // exactly overlapping, edge case

    if (dist < c1.radius + c2.radius) {
        const nx = dx / dist;
        const ny = dy / dist;

        const dvx = c2.vx - c1.vx;
        const dvy = c2.vy - c1.vy;

        const velAlongNormal = dvx * nx + dvy * ny;
        if (velAlongNormal > 0) return;

        const e = 1.0; // Perfect elasticity
        const j = -(1 + e) * velAlongNormal / (1 / c1.mass + 1 / c2.mass);

        const impulseX = j * nx;
        const impulseY = j * ny;

        c1.vx -= impulseX / c1.mass;
        c1.vy -= impulseY / c1.mass;
        c2.vx += impulseX / c2.mass;
        c2.vy += impulseY / c2.mass;

        // Positional correction
        const percent = 0.8;
        const slop = 0.01;
        const penetration = c1.radius + c2.radius - dist;
        const correction = Math.max(penetration - slop, 0) / (1 / c1.mass + 1 / c2.mass) * percent;

        c1.x -= correction * nx / c1.mass;
        c1.y -= correction * ny / c1.mass;
        c2.x += correction * nx / c2.mass;
        c2.y += correction * ny / c2.mass;
    }
}

function collideWithWalls(obj) {
    const m = CONFIG.RINK_LINE_WIDTH / 2;
    const R = CONFIG.CORNER_RADIUS;

    const left = m;
    const right = canvas.width - m;
    const top = m + 80;
    const bottom = canvas.height - m;
    const centerY = top + (bottom - top) / 2;

    const centerX1 = left + R;
    const centerY1 = top + R;
    const centerX2 = right - R;
    const centerY2 = bottom - R;

    let hit = false;
    let nx = 0, ny = 0, pen = 0;

    // Inside corners
    if (obj.x < centerX1 && obj.y < centerY1) {
        // Top-Left corner
        const dx = obj.x - centerX1;
        const dy = obj.y - centerY1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > R - obj.radius) {
            nx = -dx / dist; ny = -dy / dist;
            pen = dist - (R - obj.radius);
            hit = true;
        }
    } else if (obj.x > centerX2 && obj.y < centerY1) {
        // Top-Right corner
        const dx = obj.x - centerX2;
        const dy = obj.y - centerY1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > R - obj.radius) {
            nx = -dx / dist; ny = -dy / dist;
            pen = dist - (R - obj.radius);
            hit = true;
        }
    } else if (obj.x < centerX1 && obj.y > centerY2) {
        // Bottom-Left corner
        const dx = obj.x - centerX1;
        const dy = obj.y - centerY2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > R - obj.radius) {
            nx = -dx / dist; ny = -dy / dist;
            pen = dist - (R - obj.radius);
            hit = true;
        }
    } else if (obj.x > centerX2 && obj.y > centerY2) {
        // Bottom-Right corner
        const dx = obj.x - centerX2;
        const dy = obj.y - centerY2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > R - obj.radius) {
            nx = -dx / dist; ny = -dy / dist;
            pen = dist - (R - obj.radius);
            hit = true;
        }
    } else {
        // Straight walls
        if (obj.x - obj.radius < left) {
            if (obj === state.puck && Math.abs(obj.y - centerY) < CONFIG.GOAL_WIDTH / 2) {
                scoreGoal(2);
                return;
            }
            hit = true; nx = 1; ny = 0; pen = left - (obj.x - obj.radius);
        }
        else if (obj.x + obj.radius > right) {
            if (obj === state.puck && Math.abs(obj.y - centerY) < CONFIG.GOAL_WIDTH / 2) {
                scoreGoal(1);
                return;
            }
            hit = true; nx = -1; ny = 0; pen = (obj.x + obj.radius) - right;
        }
        else if (obj.y - obj.radius < top) { hit = true; nx = 0; ny = 1; pen = top - (obj.y - obj.radius); }
        else if (obj.y + obj.radius > bottom) { hit = true; nx = 0; ny = -1; pen = (obj.y + obj.radius) - bottom; }
    }

    if (hit) {
        // resolve wall collision (infinite mass)
        const velAlongNormal = obj.vx * nx + obj.vy * ny;
        if (velAlongNormal < 0) {
            const e = 1.0;
            const j = -(1 + e) * velAlongNormal;
            obj.vx += j * nx;
            obj.vy += j * ny;
        }
        obj.x += nx * pen;
        obj.y += ny * pen;
    }
}

function scoreGoal(player) {
    if (player === 1) state.p1.score++;
    if (player === 2) state.p2.score++;

    state.p1.x = 200; state.p1.y = 340; state.p1.vx = 0; state.p1.vy = 0;
    state.p2.x = 800; state.p2.y = 340; state.p2.vx = 0; state.p2.vy = 0;
    state.puck.x = 500; state.puck.y = 340; state.puck.vx = 0; state.puck.vy = 0;
}

function update(dt) {
    const timeScale = dt * 60 / 1000;

    // Player 1 Movement (WASD) Input
    let p1dx = 0, p1dy = 0;
    if (state.keys['KeyW']) p1dy -= 1;
    if (state.keys['KeyS']) p1dy += 1;
    if (state.keys['KeyA']) p1dx -= 1;
    if (state.keys['KeyD']) p1dx += 1;

    if (p1dx !== 0 || p1dy !== 0) {
        const len = Math.sqrt(p1dx * p1dx + p1dy * p1dy);
        p1dx /= len; p1dy /= len;
        state.p1.lastDx = p1dx; state.p1.lastDy = p1dy;
    }

    let p1TargetVx = p1dx * CONFIG.PLAYER_SPEED * (state.keys['ShiftLeft'] ? CONFIG.BOOST_MULTIPLIER : 1);
    let p1TargetVy = p1dy * CONFIG.PLAYER_SPEED * (state.keys['ShiftLeft'] ? CONFIG.BOOST_MULTIPLIER : 1);

    // Player 2 Movement (O, K, L, ;) Input
    let p2dx = 0, p2dy = 0;
    if (state.keys['KeyO']) p2dy -= 1;
    if (state.keys['KeyL']) p2dy += 1;
    if (state.keys['KeyK']) p2dx -= 1;
    if (state.keys['Semicolon']) p2dx += 1;

    if (p2dx !== 0 || p2dy !== 0) {
        const len = Math.sqrt(p2dx * p2dx + p2dy * p2dy);
        p2dx /= len; p2dy /= len;
        state.p2.lastDx = p2dx; state.p2.lastDy = p2dy;
    }

    let p2TargetVx = p2dx * CONFIG.PLAYER_SPEED * (state.keys['ShiftRight'] ? CONFIG.BOOST_MULTIPLIER : 1);
    let p2TargetVy = p2dy * CONFIG.PLAYER_SPEED * (state.keys['ShiftRight'] ? CONFIG.BOOST_MULTIPLIER : 1);

    // Apply Lerp to velocities so physics impulses can happen
    state.p1.vx += (p1TargetVx - state.p1.vx) * CONFIG.PLAYER_LERP;
    state.p1.vy += (p1TargetVy - state.p1.vy) * CONFIG.PLAYER_LERP;
    state.p2.vx += (p2TargetVx - state.p2.vx) * CONFIG.PLAYER_LERP;
    state.p2.vy += (p2TargetVy - state.p2.vy) * CONFIG.PLAYER_LERP;

    // Friction on puck
    state.puck.vx *= CONFIG.FRICTION;
    state.puck.vy *= CONFIG.FRICTION;

    // Apply velocities
    state.p1.x += state.p1.vx * timeScale;
    state.p1.y += state.p1.vy * timeScale;
    state.p2.x += state.p2.vx * timeScale;
    state.p2.y += state.p2.vy * timeScale;
    state.puck.x += state.puck.vx * timeScale;
    state.puck.y += state.puck.vy * timeScale;

    // Collisions
    resolveCollision(state.p1, state.p2);
    resolveCollision(state.p1, state.puck);
    resolveCollision(state.p2, state.puck);

    collideWithWalls(state.p1);
    collideWithWalls(state.p2);
    collideWithWalls(state.puck);

    // Apply center line constraints independently AFTER wall collisions
    if (state.p1.x + state.p1.radius > canvas.width / 2) {
        state.p1.x = canvas.width / 2 - state.p1.radius;
        if (state.p1.vx > 0) state.p1.vx = -state.p1.vx;
    }
    if (state.p2.x - state.p2.radius < canvas.width / 2) {
        state.p2.x = canvas.width / 2 + state.p2.radius;
        if (state.p2.vx < 0) state.p2.vx = -state.p2.vx;
    }
}

function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Rink
    drawRink();

    // Draw Score
    ctx.fillStyle = '#ff8800';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${state.p1.score} - ${state.p2.score}`, canvas.width / 2, 55);

    // Draw players & puck
    drawPlayer(state.p1, imgP1, '#00ff00'); // P1 (Orange Claude)
    drawPlayer(state.p2, imgP2, '#ff0000'); // P2 (Pink Claude)
    drawCircle(state.puck, '#ffffff'); // Puck White
}

// Main Loop
let lastTime = 0;
function loop(timestamp) {
    let dt = timestamp - lastTime;
    if (dt > 1000 / CONFIG.FPS) { // Frame capping roughly, although rAF usually runs at 60Hz
        update(dt);
        draw();
        lastTime = timestamp;
    }
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

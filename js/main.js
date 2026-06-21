/* ============================================
   CraftWeb — Main Module (v10)
   Renderer setup, scene, day/night cycle, game loop
   - Golden Days color palette (Beta 1.8 look)
   ============================================ */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { World } from "./world.js?v10";
import { Player, initParticles, updateParticles, sfx } from "./player.js?v10";
import { setupUI } from "./ui.js?v10";
import { MobManager } from "./mobs.js?v10";

// ============================
// RENDERER + SCENE + CAMERA
// ============================
const canvas   = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 400);

// ============================
// SKY / FOG COLORS — v10 Golden Days palette
// Sky: #7cadff (top) / #949eff (horizon)  Fog: #aec9ff
// Night: deep blue #0a0a2e, fog #050518
// ============================
const COL_DAY    = new THREE.Color(0x7cadff);  // Golden Days sky blue
const COL_SUNSET = new THREE.Color(0xff8844);  // warm sunset
const COL_NIGHT  = new THREE.Color(0x0a0a2e);
const FOG_DAY    = new THREE.Color(0xaec9ff);  // Golden Days fog
const FOG_NIGHT  = new THREE.Color(0x050518);

scene.background = COL_DAY.clone();
scene.fog = new THREE.Fog(FOG_DAY.clone(), 80, 220);

// ============================
// LIGHTS
// ============================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
const hemiLight    = new THREE.HemisphereLight(0xbfd8ff, 0x6b5538, 0.6);
const sunLight     = new THREE.DirectionalLight(0xfffae0, 1.0);  sunLight.position.set(100,200,80);
const fillLight    = new THREE.DirectionalLight(0x8ab4e8, 0.2);  fillLight.position.set(-50,-100,-50);
const moonLight    = new THREE.DirectionalLight(0xb0c8ff, 0.0);  moonLight.position.set(-100, 100, -50);
scene.add(ambientLight, hemiLight, sunLight, fillLight, moonLight);

// ============================
// SUN & MOON
// ============================
const sunMesh  = new THREE.Mesh(new THREE.SphereGeometry(3,12,12),
                  new THREE.MeshBasicMaterial({ color:0xFFDD44, fog:false, depthWrite:false }));
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(2,12,12),
                  new THREE.MeshBasicMaterial({ color:0xDDEEFF, fog:false, depthWrite:false }));
scene.add(sunMesh, moonMesh);

// ============================
// STARS (visible at night)
// ============================
const starGeo = new THREE.BufferGeometry();
const starPositions = new Float32Array(600 * 3);
for(let i=0; i<600; i++){
    const r = 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5; // upper hemisphere
    starPositions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i*3+1] = r * Math.cos(phi);
    starPositions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, transparent: true, opacity: 0, fog: false });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ============================
// CLOUDS
// ============================
const cloudGroup = new THREE.Group();
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, fog: false });
for(let i=0; i<30; i++){
    const w = 8 + Math.random() * 14;
    const h = 4 + Math.random() * 4;
    const d = 8 + Math.random() * 14;
    const geo = new THREE.BoxGeometry(w, h, d);
    const cloud = new THREE.Mesh(geo, cloudMat);
    cloud.position.set(
        (Math.random() - 0.5) * 200,
        50 + Math.random() * 20,
        (Math.random() - 0.5) * 200
    );
    cloudGroup.add(cloud);
}
scene.add(cloudGroup);

// ============================
// DAY / NIGHT CYCLE
// ============================
let timeOfDay = 0.30;
const CYCLE_SPEED = 0.0015;
const ORBIT_R = 120;

window.setTimeOfDay = (t) => { timeOfDay = t; };

function updateDayNight(dt){
    timeOfDay = (timeOfDay + CYCLE_SPEED * dt) % 1;
    const angle = timeOfDay * Math.PI * 2;
    const camPos = camera.position;

    sunMesh.position.set(camPos.x + Math.cos(angle)*ORBIT_R,
                         camPos.y + Math.sin(angle)*ORBIT_R,
                         camPos.z + 50);
    moonMesh.position.set(camPos.x - Math.cos(angle)*ORBIT_R,
                          camPos.y - Math.sin(angle)*ORBIT_R,
                          camPos.z + 50);
    stars.position.copy(camPos);

    const sunH = Math.sin(angle);
    let skyCol, fogCol, ambI, sunI, hemiI;
    if(sunH > 0.15){
        // Day
        skyCol = COL_DAY.clone();
        fogCol = FOG_DAY.clone();
        ambI  = 0.85 + sunH*0.10;
        sunI  = 0.90 + sunH*0.40;
        hemiI = 0.70 + sunH*0.20;
    } else if(sunH > -0.15){
        // Twilight
        const t = (sunH + 0.15) / 0.30;
        skyCol = COL_SUNSET.clone().lerp(COL_DAY, t);
        fogCol = new THREE.Color(0xFF8866).lerp(FOG_DAY, t);
        ambI  = 0.55 + t*0.30;
        sunI  = t * 0.9;
        hemiI = 0.40 + t*0.30;
    } else {
        // Night — v9: boosted brightness so blocks are still visible
        skyCol = COL_NIGHT.clone();
        fogCol = FOG_NIGHT.clone();
        ambI  = 0.70;  // was 0.45 — too dark, blocks looked like missing textures
        sunI  = 0;
        hemiI = 0.50;  // was 0.30
    }
    scene.background.copy(skyCol);
    scene.fog.color.copy(fogCol);
    ambientLight.intensity = ambI;
    sunLight.intensity     = sunI;
    sunLight.position.copy(sunMesh.position);
    hemiLight.intensity    = hemiI;
    moonLight.intensity    = (1 - sunI/1.3) * 0.35;
    moonLight.position.copy(moonMesh.position);

    // Stars opacity
    starMat.opacity = Math.max(0, -sunH * 1.5);

    // Cloud opacity (faded at night)
    cloudMat.opacity = 0.6 * Math.max(0.1, sunI/1.3);

    // Slowly drift clouds
    cloudGroup.position.x = (cloudGroup.position.x + dt * 0.5) % 200;
    cloudGroup.position.z = camPos.z;
}

// ============================
// PLAYER HAND (first-person arm)
// ============================
const handScene = new THREE.Scene();
const handCamera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.01, 10);
handScene.position.z = 0; // Will be set relative

// Arm geometry - simple box representing the player's arm
const armGroup = new THREE.Group();

// Load skin texture for the arm
const armTexLoader = new THREE.TextureLoader();
const armMat = new THREE.MeshLambertMaterial({ color: 0xc4956a }); // Steve skin color
const armGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
const arm = new THREE.Mesh(armGeo, armMat);
arm.position.set(0, -0.15, 0); // Center at grip point
armGroup.add(arm);

// Item held in hand (a small cube)
const heldItemGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const heldItemMat = new THREE.MeshLambertMaterial({ color: 0x6fbf52 }); // Default grass green
const heldItem = new THREE.Mesh(heldItemGeo, heldItemMat);
heldItem.position.set(0, 0.25, 0);
armGroup.add(heldItem);

// Position the arm group (bottom-right of screen, in camera space)
armGroup.position.set(0.7, -0.55, -0.5);
armGroup.rotation.set(-0.1, -0.3, 0.1);

// Add subtle ambient light for the hand
const handLight = new THREE.AmbientLight(0xffffff, 0.8);
handScene.add(handLight);
const handDirLight = new THREE.DirectionalLight(0xfffae0, 0.6);
handDirLight.position.set(1, 2, 1);
handScene.add(handDirLight);
handScene.add(armGroup);

// Hand swing animation state
let handSwingTime = 0;
let isSwinging = false;

window.triggerHandSwing = () => {
    isSwinging = true;
    handSwingTime = 0;
};

// Block color map for held item
const BLOCK_COLORS = {
    1: 0x808080, 2: 0x6fbf52, 3: 0x8b5a2b, 4: 0x7a7a7a, 5: 0x6e4f2a,
    6: 0x4a7a2a, 7: 0x333333, 8: 0x202020, 9: 0xc8a878, 10: 0x4ad8e8, 11: 0x9a4a4a,
    12: 0xe8d8a0, 14: 0xb89a5a, 15: 0xaaccdd, 16: 0xf0f0f8, 18: 0xd8c890,
    19: 0x808080, 24: 0x1a0a2a, 25: 0x9a4a4a
};

window.updateHeldItem = (blockId) => {
    const color = BLOCK_COLORS[blockId] || 0xaaaaaa;
    heldItemMat.color.setHex(color);
    // If inventory is empty for this block, hide the item
    if(window.hasBlockInInventory && !window.hasBlockInInventory(blockId)) {
        heldItem.visible = false;
    } else {
        heldItem.visible = true;
    }
};

// ============================
// WORLD + PLAYER + MOBS
// ============================
const world  = new World(scene);
const player = new Player(camera, world, canvas);
const mobs   = new MobManager(scene, world);
window.mobManager = mobs;
initParticles(scene);

// ============================
// BLOCK HIGHLIGHT
// ============================
const hlEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
const hlMat   = new THREE.LineBasicMaterial({ color:0x000000, transparent:true, opacity:0.45, fog:false, depthTest:true });
const highlight = new THREE.LineSegments(hlEdges, hlMat);
highlight.visible = false;
scene.add(highlight);

function updateHighlight(){
    if(!window.gameStarted || window.paused){ highlight.visible = false; return; }
    const r = player.raycastBlock();
    if(!r){ highlight.visible = false; return; }
    highlight.visible = true;
    highlight.position.set(r.bx + 0.5, r.by + 0.5, r.bz + 0.5);
}

// ============================
// UI
// ============================
setupUI(player);
const menuEl   = document.getElementById('menu');
const pauseEl  = document.getElementById('pause-screen');
const hudEl    = document.getElementById('hud');
const debugEl  = document.getElementById('debug');
const modeEl   = document.getElementById('mode-label');
const timeEl   = document.getElementById('time-display');
const fpsEl    = document.getElementById('fps-display');
const loadingEl= document.getElementById('loading-screen');
const loadingFill = document.getElementById('loading-fill');
const loadingText = document.getElementById('loading-text');

window.gameStarted = false;
window.paused = false;
let showDebug = false;

// ============================
// GAME STATE FUNCTIONS
// ============================
function startGame(mode){
    player.gameMode = 'survival';
    menuEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    modeEl.textContent = `Mode: ${mode}`;

    // Pre-generate chunks around spawn
    const sx = 8, sz = 8;
    const gh = world.getHeight(sx, sz);
    player.camera.position.set(sx + 0.5, gh + 2 + 1.75, sz + 0.5);
    player.yaw = 0; player.pitch = 0;
    camera.rotation.y = 0; camera.rotation.x = 0;

    // Force chunk pre-generation
    let progress = 0;
    const totalChunks = 8;
    loadingText.textContent = 'Génération du monde...';
    let i = 0;
    function genStep(){
        world.update(camera.position);
        i++;
        progress = (i / totalChunks) * 100;
        loadingFill.style.width = progress + '%';
        if(i < totalChunks){
            setTimeout(genStep, 30);
        } else {
            loadingEl.classList.add('hidden');
            player.hp = player.maxHp;
            player.food = player.maxFood;
            player.spawn();
            window.gameStarted = true;
            window.chatLog?.(`Jeu démarré en mode ${mode}`, 'system');
            setTimeout(() => player.lock(), 150);
        }
    }
    genStep();
}

function openPause(){
    pauseEl.classList.remove('hidden');
    window.paused = true;
    player.unlock();
}
function closePause(){
    pauseEl.classList.add('hidden');
    window.paused = false;
    setTimeout(() => player.lock(), 100);
}
function goMenu(){
    menuEl.classList.remove('hidden');
    pauseEl.classList.add('hidden');
    hudEl.classList.add('hidden');
    window.gameStarted = false;
    window.paused = false;
    player.unlock();
    // Clear mobs
    mobs.disposeAll();
}

// ============================
// BUTTON BINDINGS
// ============================
document.getElementById('btn-survival').onclick = () => startGame('survival');
document.getElementById('btn-resume').onclick   = closePause;
document.getElementById('btn-to-menu').onclick  = goMenu;
document.getElementById('btn-reset').onclick = () => {
    if(window.confirm('Réinitialiser le monde ? Toutes les modifications seront perdues.')){
        world.clearSave();
        world.disposeAll();
        world.update(camera.position);
        goMenu();
    }
};
document.getElementById('btn-respawn').onclick = () => {
    player._respawn();
};
document.getElementById('btn-death-menu').onclick = () => {
    player._respawn();
    goMenu();
};

// ============================
// POINTER LOCK -> PAUSE
// ============================
document.addEventListener('pointerlockchange', () => {
    if(!window.gameStarted) return;
    const locked = document.pointerLockElement === canvas;
    if(!locked && !window.paused && menuEl.classList.contains('hidden')){
        // Don't pause if inventory or chat is open
        const invOpen = !document.getElementById('inventory-screen').classList.contains('hidden');
        const chatOpen = !document.getElementById('chat-box').classList.contains('hidden');
        if(!invOpen && !chatOpen && !player._dead) openPause();
    }
});

// ============================
// KEYBOARD HANDLERS
// ============================
document.addEventListener('keydown', e => {
    if(e.code === 'F3'){
        e.preventDefault();
        showDebug = !showDebug;
        debugEl.classList.toggle('show', showDebug);
    }
    if(e.code === 'Escape'){
        // Inventory or chat open? close them first
        const invOpen = !document.getElementById('inventory-screen').classList.contains('hidden');
        const chatOpen = !document.getElementById('chat-box').classList.contains('hidden');
        if(invOpen) { window.toggleInventory(); return; }
        if(chatOpen){ document.getElementById('chat-box').classList.add('hidden');
                      if(window.gameStarted && !window.paused) player.lock(); return; }
    }
});

// Slot change event relay
document.addEventListener('slotChange', e => {
    document.dispatchEvent(new CustomEvent('uiSelectSlot', { detail: e.detail }));
});

// ============================
// RESIZE
// ============================
window.addEventListener('resize', () => {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    handCamera.aspect = innerWidth/innerHeight;
    handCamera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

// ============================
// GAME LOOP
// ============================
let last = performance.now();
let hudTimer = 0;
let fpsTimer = 0;
let fpsCount = 0;
let fps = 60;

(function animate(now){
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // FPS counter
    fpsCount++;
    fpsTimer += dt;
    if(fpsTimer >= 0.5){
        fps = Math.round(fpsCount / fpsTimer);
        fpsTimer = 0;
        fpsCount = 0;
        if(fpsEl) fpsEl.textContent = `${fps} FPS`;
    }

    if(window.gameStarted && !window.paused){
        world.update(camera.position);
        player.update(dt);
        mobs.update(dt, player, timeOfDay);
        updateDayNight(dt);
        updateHighlight();
        updateParticles(dt);

        hudTimer += dt;
        if(hudTimer > 0.2){
            hudTimer = 0;
            if(window.updateHUD)
                window.updateHUD(player.hp, player.maxHp, player.food, player.maxFood);
        }

        // Ingame clock
        if(timeEl){
            const h = Math.floor(((timeOfDay*24)+6) % 24);
            const m = Math.floor((timeOfDay*24*60 - Math.floor(timeOfDay*24)*60));
            timeEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        }

        // F3 debug overlay
        if(showDebug){
            const p = camera.position;
            const biome = world.getBiome(Math.floor(p.x), Math.floor(p.z)) || '?';
            debugEl.innerHTML =
                `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}<br>`+
                `Chunk: ${Math.floor(p.x/16)}, ${Math.floor(p.z/16)}<br>`+
                `Biome: ${biome}<br>`+
                `Mode: ${player.gameMode} | Sol: ${player.onGround}<br>`+
                `HP: ${player.hp}/${player.maxHp} | Faim: ${player.food}/${player.maxFood}<br>`+
                `Chunks: ${world.chunks.size} | Meshes: ${world.rayMeshes.length}<br>`+
                `Mods sauvées: ${world.mods.size} | Mobs: ${mobs.mobs.length}<br>`+
                `FPS: ${fps} | Heure: ${timeOfDay.toFixed(2)}`;
        }
    } else {
        // Still animate sky/clouds on menu
        updateDayNight(dt * 0.5);
        cloudGroup.position.x = (cloudGroup.position.x + dt * 0.5) % 200;
    }

    renderer.render(scene, camera);

    // Render hand on top (separate scene)
    if(window.gameStarted && !window.paused){
        // Hand swing animation
        if(isSwinging){
            handSwingTime += dt * 8;
            if(handSwingTime >= Math.PI){
                isSwinging = false;
                handSwingTime = 0;
                armGroup.rotation.set(-0.1, -0.3, 0.1);
            } else {
                const swing = Math.sin(handSwingTime) * 0.5;
                armGroup.rotation.set(-0.1 - swing, -0.3, 0.1);
            }
        }
        // Bob animation when walking
        if(player.isMoving && player.onGround){
            const bob = Math.sin(performance.now() * 0.006) * 0.02;
            armGroup.position.y = -0.55 + bob;
        } else {
            armGroup.position.y = -0.55;
        }
        
        // Update held item
        const selectedId = window.getSelectedBlockId ? window.getSelectedBlockId() : player.selectedBlock;
        window.updateHeldItem(selectedId);
        
        renderer.clearDepth();
        renderer.render(handScene, handCamera);
    }
})(performance.now());

// Initial loading message
loadingText.textContent = 'Prêt';
setTimeout(() => {
    loadingEl.classList.add('hidden');
}, 500);

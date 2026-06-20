import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { World }   from "./world.js";
import { Player }  from "./player.js";
import { setupUI } from "./ui.js";

// ── Renderer sur le canvas existant ──────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);

// ── Scène ────────────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 400);

// ── Couleurs jour/nuit ────────────────────────────────────────────────────
const COL_DAY    = new THREE.Color(0x87CEEB);
const COL_SUNSET = new THREE.Color(0xFF8844);
const COL_NIGHT  = new THREE.Color(0x0a0a2e);
const FOG_DAY    = new THREE.Color(0xC0D8FF);
const FOG_NIGHT  = new THREE.Color(0x050518);

scene.background = COL_DAY.clone();
scene.fog = new THREE.Fog(FOG_DAY.clone(), 80, 220);

// ── Lumières ─────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfffae0, 1.0);
sunLight.position.set(100,200,80);
scene.add(sunLight);
const fillLight = new THREE.DirectionalLight(0x8ab4e8, 0.2);
fillLight.position.set(-50,-100,-50);
scene.add(fillLight);

// ── Soleil & Lune ────────────────────────────────────────────────────────
const sunGeo  = new THREE.SphereGeometry(3,12,12);
const sunMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({color:0xFFDD44}));
scene.add(sunMesh);

const moonGeo  = new THREE.SphereGeometry(2,12,12);
const moonMesh = new THREE.Mesh(moonGeo, new THREE.MeshBasicMaterial({color:0xDDEEFF}));
scene.add(moonMesh);

// ── Cycle jour/nuit ───────────────────────────────────────────────────────
let timeOfDay = 0.25; // commence au matin
const CYCLE_SPEED = 0.004; // 1 jour ~4min
const ORBIT_R = 120;

function updateDayNight(dt){
    timeOfDay = (timeOfDay + CYCLE_SPEED * dt) % 1;
    const angle = timeOfDay * Math.PI * 2;

    // Position soleil/lune
    sunMesh.position.set(Math.cos(angle)*ORBIT_R, Math.sin(angle)*ORBIT_R, 0);
    moonMesh.position.set(-Math.cos(angle)*ORBIT_R, -Math.sin(angle)*ORBIT_R, 0);

    // Couleur ciel selon hauteur du soleil
    const sunH = Math.sin(angle); // -1 nuit, +1 midi
    let skyCol, fogCol, ambI, sunI;

    if(sunH > 0.15){
        // Jour
        const t = Math.min((sunH-0.15)/0.3,1);
        skyCol = COL_DAY.clone();
        fogCol = FOG_DAY.clone();
        ambI   = 0.5 + t*0.1;
        sunI   = 0.8 + t*0.4;
    } else if(sunH > -0.15){
        // Aube/crépuscule
        const t = (sunH+0.15)/0.3;
        skyCol = COL_SUNSET.clone().lerp(sunH>0?COL_DAY:COL_NIGHT, sunH>0?t:(1-t+0.5));
        fogCol = skyCol.clone();
        ambI   = 0.2 + t*0.3;
        sunI   = t*0.8;
    } else {
        // Nuit
        const t = Math.min((-sunH-0.15)/0.35,1);
        skyCol = COL_NIGHT.clone();
        fogCol = FOG_NIGHT.clone();
        ambI   = 0.08 + (1-t)*0.12;
        sunI   = 0;
    }

    scene.background.copy(skyCol);
    scene.fog.color.copy(fogCol);
    ambientLight.intensity = ambI;
    sunLight.intensity     = sunI;
    sunLight.position.copy(sunMesh.position);
}

// ── Monde & joueur ────────────────────────────────────────────────────────
const world  = new World(scene);
const player = new Player(camera, world, canvas);

// ── UI ────────────────────────────────────────────────────────────────────
setupUI(player);

// ── DOM ───────────────────────────────────────────────────────────────────
const menuEl  = document.getElementById('menu');
const pauseEl = document.getElementById('pause-screen');
const hudEl   = document.getElementById('hud');
const debugEl = document.getElementById('debug');
const modeEl  = document.getElementById('mode-label');
const timeEl  = document.getElementById('time-display');

let gameStarted=false, paused=false, showDebug=false;
let hp=20, food=20;

// ── Gestion état jeu ──────────────────────────────────────────────────────
function startGame(mode){
    player.gameMode=mode;
    modeEl.textContent = mode==='creative'?'✦ Créatif':'⚔ Survie';
    menuEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    paused=false; gameStarted=true;
    setTimeout(()=>player.lock(), 150);
    if(window.updateHUD) window.updateHUD(hp,20,food,20);
}

function openPause(){
    if(!gameStarted||paused) return;
    paused=true;
    pauseEl.classList.remove('hidden');
    player.unlock();
}

function closePause(){
    pauseEl.classList.add('hidden');
    paused=false;
    setTimeout(()=>player.lock(),100);
}

function goMenu(){
    pauseEl.classList.add('hidden');
    hudEl.classList.add('hidden');
    menuEl.classList.remove('hidden');
    player.unlock();
    gameStarted=false; paused=false;
}

// ── Boutons ───────────────────────────────────────────────────────────────
document.getElementById('btn-survival').addEventListener('click',()=>startGame('survival'));
document.getElementById('btn-creative').addEventListener('click',()=>startGame('creative'));
document.getElementById('btn-resume').addEventListener('click',()=>closePause());
document.getElementById('btn-to-menu').addEventListener('click',()=>goMenu());

// ── Pointer lock → pause ──────────────────────────────────────────────────
document.addEventListener('pointerlockchange',()=>{
    if(!gameStarted) return;
    const locked=document.pointerLockElement===canvas;
    if(!locked && !paused && menuEl.classList.contains('hidden')) openPause();
});

// ── Clavier ───────────────────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
    if(e.code==='Escape' && gameStarted){ if(paused) closePause(); }
    if(e.code==='F3'){ showDebug=!showDebug; debugEl.classList.toggle('show',showDebug); }
});

// Sync sélection hotbar depuis ui.js
document.addEventListener('slotChange',e=>{
    document.dispatchEvent(new CustomEvent('uiSelectSlot',{detail:e.detail}));
});

// ── Resize ────────────────────────────────────────────────────────────────
window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
});

// ── Boucle ────────────────────────────────────────────────────────────────
let last=performance.now(), hudTimer=0;

(function animate(now){
    requestAnimationFrame(animate);
    const dt=Math.min((now-last)/1000,0.05);
    last=now;

    if(gameStarted && !paused){
        world.update(camera.position);
        player.update(dt);
        updateDayNight(dt);

        hudTimer+=dt;
        if(hudTimer>0.2){ hudTimer=0; if(window.updateHUD) window.updateHUD(hp,20,food,20); }

        // Horloge ingame
        if(timeEl){
            const h=Math.floor(timeOfDay*24);
            const m=Math.floor((timeOfDay*24-h)*60);
            timeEl.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        }

        if(showDebug){
            const p=camera.position;
            debugEl.innerHTML=
                `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}<br>`+
                `Chunk: ${Math.floor(p.x/16)}, ${Math.floor(p.z/16)}<br>`+
                `Mode: ${player.gameMode} | Sol: ${player.onGround}<br>`+
                `Chunks: ${world.chunks.size} | Meshes: ${world.rayMeshes.length}`;
        }
    }

    renderer.render(scene,camera);
})(performance.now());

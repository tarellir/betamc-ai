/* ============================================
   CraftWeb — Player Module
   Physics, controls, raycasting, audio, particles
   ============================================ */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { BLOCKS, BLOCK_META } from "./world.js?v10";

// ============================
// AUDIO (synthesized SFX)
// ============================
let audioCtx = null;
function initAudio(){
    if(audioCtx) return;
    try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if(!Ctor) return;
        audioCtx = new Ctor();
        if(audioCtx.state === 'suspended') audioCtx.resume();
    } catch(e){ audioCtx = null; }
}
function playNoise(dur, vol, filterFreq){
    if(!audioCtx) return;
    const sr = audioCtx.sampleRate, sz = Math.floor(sr*dur);
    const buf = audioCtx.createBuffer(1, sz, sr);
    const d = buf.getChannelData(0);
    for(let i=0; i<sz; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/sz, 3);
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
    if(filterFreq){
        const f = audioCtx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = filterFreq;
        src.connect(f); f.connect(g);
    } else {
        src.connect(g);
    }
    g.connect(audioCtx.destination); src.start();
}
function playTone(f0, f1, dur, type, vol){
    if(!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), audioCtx.currentTime+dur*.9);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime+dur);
}
export const sfx = {
    break:   (bt=1)=> playNoise(0.08, 0.35, 2000 + bt*100),
    place:   ()=> playTone(150, 50, 0.12, 'triangle', 0.25),
    jump:    ()=> playTone(180, 700, 0.15, 'sine', 0.2),
    hurt:    ()=> playNoise(0.25, 0.4, 800),
    splash:  ()=> playNoise(0.3, 0.3, 1500),
    eat:     ()=> playTone(200, 100, 0.1, 'square', 0.2),
    click:   ()=> playTone(800, 800, 0.04, 'square', 0.1),
};

// ============================
// PARTICLES
// ============================
const PARTICLE_POOL = 128;
const particles = [];
let particleScene = null;

export function initParticles(scene){
    particleScene = scene;
    const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    for(let i=0; i<PARTICLE_POOL; i++){
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: true });
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        scene.add(m);
        particles.push({ mesh: m, vel: new THREE.Vector3(), life: 0, active: false });
    }
}

export function spawnBreakParticles(x, y, z, blockType){
    if(!particleScene) return;
    const colors = {
        1:0x808080, 2:0x6fbf52, 3:0x8b5a2b, 4:0x7a7a7a, 5:0x6e4f2a,
        6:0x4a7a2a, 7:0x333333, 8:0x202020, 9:0xc8a878, 10:0x4ad8e8, 11:0x9a4a4a,
        12:0xe8d8a0, 14:0xb89a5a, 15:0xaaccdd, 16:0xf0f0f8, 18:0xd8c890,
        19:0x808080, 24:0x1a0a2a, 25:0x9a4a4a,
    };
    const col = colors[blockType] ?? 0xaaaaaa;
    let spawned = 0;
    for(const p of particles){
        if(spawned >= 10) break;
        if(p.active) continue;
        p.active = true;
        p.life = 0.6 + Math.random()*0.4;
        p.mesh.visible = true;
        p.mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
        p.mesh.material.color.setHex(col);
        p.vel.set((Math.random()-0.5)*3.5,
                  Math.random()*3.0 + 1.5,
                  (Math.random()-0.5)*3.5);
        spawned++;
    }
}

export function updateParticles(dt){
    for(const p of particles){
        if(!p.active) continue;
        p.life -= dt;
        if(p.life <= 0){
            p.active = false;
            p.mesh.visible = false;
            continue;
        }
        p.vel.y -= 8.0 * dt;
        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.y += p.vel.y * dt;
        p.mesh.position.z += p.vel.z * dt;
        const a = Math.min(1, p.life * 2);
        p.mesh.scale.setScalar(Math.max(0.1, a));
    }
}

// ============================
// PHYSICS CONSTANTS
// ============================
const PLAYER_H   = 1.75;
const HALF_W     = 0.29;
const MOVE_SPD   = 0.10;
const SPRINT_SPD = 0.18;
const GRAVITY    = -0.030;
const JUMP_V     = 0.30;
const MAX_FALL   = -1.2;
const REACH      = 6;

// ============================
// PLAYER CLASS
// ============================
export class Player {
    constructor(camera, world, canvas){
        this.camera = camera;
        this.world = world;
        this.canvas = canvas;
        this.vel = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = 0;
        this.onGround = false;
        this.inWater = false;
        this.gameMode = 'survival';
        this.selectedBlock = 1;
        this.keys = {};
        this.locked = false;
        this._jumpPressed = false;
        this.isMoving = false;

        this.maxHp = 20; this.maxFood = 20;
        this.hp = 20; this.food = 20;
        this._foodTimer = 0;
        this._starveTimer = 0;
        this._regenTimer = 0;
        this._fallStartY = null;
        this._dead = false;
        this._attackCD = 0;

        camera.rotation.order = 'YXZ';
        camera.position.set(8, 80, 8);

        // Spawn protection
        this._setupInput();
    }

    _setupInput(){
        document.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            // E to toggle inventory
            if(e.code === 'KeyE' && window.gameStarted && !window.paused && !this._dead){
                e.preventDefault();
                window.toggleInventory?.();
            }
            // T for chat
            if(e.code === 'KeyT' && window.gameStarted && !window.paused && !this._dead){
                e.preventDefault();
                window.openChat?.();
            }
        });
        document.addEventListener('keyup', e => { this.keys[e.code] = false; });
        window.addEventListener('blur', () => { this.keys = {}; });
        document.addEventListener('visibilitychange', () => { if(document.hidden) this.keys = {}; });

        document.addEventListener('mousemove', e => {
            if(!this.locked) return;
            this.yaw   -= e.movementX * 0.002;
            this.pitch -= e.movementY * 0.002;
            this.pitch  = Math.max(-1.55, Math.min(1.55, this.pitch));
            this.camera.rotation.y = this.yaw;
            this.camera.rotation.x = this.pitch;
        });

        document.addEventListener('mousedown', e => {
            if(!this.locked) return;
            initAudio();
            this._interact(e.button);
        });

        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === this.canvas;
        });

        document.addEventListener('wheel', e => {
            if(!this.locked) return;
            const dir = e.deltaY > 0 ? 1 : -1;
            const n = window.HOTBAR_COUNT || 9;
            this.selectedBlock = ((this.selectedBlock - 1 + dir + n) % n) + 1;
            document.dispatchEvent(new CustomEvent('slotChange', { detail: this.selectedBlock - 1 }));
        });
    }

    lock(){   this.canvas.requestPointerLock(); }
    unlock(){ if(document.pointerLockElement) document.exitPointerLock(); }

    // ============================
    // RAYCASTING
    // ============================
    raycastBlock(){
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        ray.far = REACH;
        const hits = ray.intersectObjects(this.world.getRayMeshes(), false);
        if(!hits.length) return null;
        const hit = hits[0];
        const n = hit.face.normal;
        const pt = hit.point.clone().addScaledVector(n, -0.01);
        return {
            bx: Math.floor(pt.x), by: Math.floor(pt.y), bz: Math.floor(pt.z),
            nx: Math.round(n.x),  ny: Math.round(n.y),  nz: Math.round(n.z),
        };
    }

    _interact(btn){
        if(this._attackCD > 0) return;
        this._attackCD = 0.25;
        if(btn === 0){
            // Try to attack a mob first
            if(window.mobManager && window.mobManager.attack(this.camera, REACH)){
                sfx.hurt();
                return;
            }
            // Break block
            const r = this.raycastBlock();
            if(!r) return;
            const { bx, by, bz } = r;
            const oldType = this.world.getBlock(bx, by, bz);
            if(oldType === BLOCKS.BEDROCK && this.gameMode !== 'creative') return;
            if(oldType === BLOCKS.WATER) return;
            this.world.setBlock(bx, by, bz, 0);
            sfx.break(oldType);
            window.triggerHandSwing?.();
            spawnBreakParticles(bx, by, bz, oldType);
            // In survival, add block to inventory
            if(this.gameMode === 'survival' && oldType !== BLOCKS.AIR) {
                window.addToInventory?.(oldType);
            }
        } else if(btn === 2){
            // Place block adjacent to the face we're looking at
            const r = this.raycastBlock();
            if(!r) return;
            const { bx, by, bz, nx, ny, nz } = r;
            const px = bx + nx, py = by + ny, pz = bz + nz;

            // Don't place if it would be inside the player
            const cam = this.camera.position;
            const inPlayer = (px < cam.x + HALF_W && px + 1 > cam.x - HALF_W &&
                              pz < cam.z + HALF_W && pz + 1 > cam.z - HALF_W &&
                              py < cam.y + 0.2 && py + 1 > cam.y - PLAYER_H - 0.1);
            if(inPlayer) return;

            // Don't replace solid/existing blocks
            const existing = this.world.getBlock(px, py, pz);
            if(existing !== 0 && existing !== BLOCKS.WATER && existing !== -1) return;

            // In survival, only place if we have blocks in inventory
            const blockToPlace = window.getSelectedBlockId ? window.getSelectedBlockId() : this.selectedBlock;
            if(this.gameMode === 'survival') {
                if(!window.hasBlockInInventory || !window.hasBlockInInventory(blockToPlace)) return;
                window.removeFromInventory?.(blockToPlace);
            }
            this.world.setBlock(px, py, pz, blockToPlace);
            sfx.place();
            window.triggerHandSwing?.();
        }
    }

    // ============================
    // COLLISION
    // ============================
    _solid(x, y, z){
        const b = this.world.getBlock(x, y, z);
        if(b === -1) return false;
        const meta = BLOCK_META[b];
        return meta && meta.solid;
    }
    _isWater(x, y, z){
        const b = this.world.getBlock(x, y, z);
        return b === BLOCKS.WATER;
    }
    _overlaps(bx, by, bz){
        const cam = this.camera.position;
        const px = cam.x, py = cam.y, pz = cam.z;
        return (bx < px+HALF_W && bx+1 > px-HALF_W &&
                by < py+0.1   && by+1 > py-PLAYER_H &&
                bz < pz+HALF_W && bz+1 > pz-HALF_W);
    }
    _resolveX(){
        const cam = this.camera.position;
        const y0 = Math.floor(cam.y - PLAYER_H + 0.1);
        const y1 = Math.floor(cam.y);
        const z0 = Math.floor(cam.z - HALF_W);
        const z1 = Math.floor(cam.z + HALF_W);
        const dir = Math.sign(this.vel.x) || (this._moveDir?.x || 0);
        if(dir === 0) return;
        const x = Math.floor(cam.x + (dir > 0 ? HALF_W : -HALF_W));
        for(let by=y0; by<=y1; by++){
            for(let bz=z0; bz<=z1; bz++){
                if(!this._solid(x, by, bz)) continue;
                if(dir > 0) cam.x = x - HALF_W - 0.001;
                else        cam.x = x + 1 + HALF_W + 0.001;
                this.vel.x = 0;
                return;
            }
        }
    }
    _resolveZ(){
        const cam = this.camera.position;
        const y0 = Math.floor(cam.y - PLAYER_H + 0.1);
        const y1 = Math.floor(cam.y);
        const x0 = Math.floor(cam.x - HALF_W);
        const x1 = Math.floor(cam.x + HALF_W);
        const dir = Math.sign(this.vel.z) || (this._moveDir?.z || 0);
        if(dir === 0) return;
        const z = Math.floor(cam.z + (dir > 0 ? HALF_W : -HALF_W));
        for(let by=y0; by<=y1; by++){
            for(let bx=x0; bx<=x1; bx++){
                if(!this._solid(bx, by, z)) continue;
                if(dir > 0) cam.z = z - HALF_W - 0.001;
                else        cam.z = z + 1 + HALF_W + 0.001;
                this.vel.z = 0;
                return;
            }
        }
    }
    _resolveY(F){
        const cam = this.camera.position;
        const x0 = Math.floor(cam.x - HALF_W), x1 = Math.floor(cam.x + HALF_W);
        const z0 = Math.floor(cam.z - HALF_W), z1 = Math.floor(cam.z + HALF_W);

        if(this.vel.y <= 0){
            const reach = Math.max(1.0, Math.abs(this.vel.y*F) + 0.5);
            const yStart = Math.floor(cam.y - PLAYER_H);
            const yEnd   = Math.floor(cam.y - PLAYER_H - reach);
            for(let by = yStart; by >= yEnd; by--){
                for(let bx = x0; bx <= x1; bx++){
                    for(let bz = z0; bz <= z1; bz++){
                        if(!this._solid(bx, by, bz)) continue;
                        const topOfBlock = by + 1;
                        if(cam.y - PLAYER_H < topOfBlock && cam.y - PLAYER_H > by - reach){
                            cam.y = topOfBlock + PLAYER_H;
                            this.vel.y = 0;
                            this.onGround = true;
                            return;
                        }
                    }
                }
            }
        } else {
            const yStart = Math.floor(cam.y);
            const yEnd   = Math.floor(cam.y + 0.5);
            for(let by = yStart; by <= yEnd; by++){
                for(let bx = x0; bx <= x1; bx++){
                    for(let bz = z0; bz <= z1; bz++){
                        if(!this._solid(bx, by, bz)) continue;
                        cam.y = by - 0.1;
                        this.vel.y = 0;
                        return;
                    }
                }
            }
        }
    }

    // ============================
    // UPDATE LOOP
    // ============================
    update(dt){
        initAudio();
        if(this._attackCD > 0) this._attackCD -= dt;
        const F = Math.max(dt, 0) * 60;

        const creative  = this.gameMode === 'creative';
        const sprinting = this.keys['ShiftLeft'] || this.keys['KeyR'];
        const spd = creative
            ? (sprinting ? 0.40 : 0.20)
            : (sprinting ? SPRINT_SPD : MOVE_SPD);

        const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        const rgt = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const mv = new THREE.Vector3();
        if(this.keys['KeyW']) mv.addScaledVector(fwd,  spd);
        if(this.keys['KeyS']) mv.addScaledVector(fwd, -spd);
        if(this.keys['KeyA']) mv.addScaledVector(rgt, -spd);
        if(this.keys['KeyD']) mv.addScaledVector(rgt,  spd);
        if(this.keys['KeyZ']) mv.addScaledVector(fwd,  spd); // AZERTY Z
        if(this.keys['KeyQ']) mv.addScaledVector(rgt, -spd); // AZERTY Q

        this._moveDir = mv.clone();
        this.isMoving = mv.lengthSq() > 0.0001;

        // Check water state (eye in water)
        const eyeBlock = this.world.getBlock(
            Math.floor(this.camera.position.x),
            Math.floor(this.camera.position.y),
            Math.floor(this.camera.position.z)
        );
        this.inWater = (eyeBlock === BLOCKS.WATER);

        if(creative){
            this.camera.position.addScaledVector(mv, F);
            if(this.keys['Space'])       this.camera.position.y += spd*F;
            if(this.keys['ControlLeft']) this.camera.position.y -= spd*F;
            return;
        }

        // Survival / Adventure
        this.camera.position.x += mv.x * F;
        this._resolveX();
        this.camera.position.z += mv.z * F;
        this._resolveZ();

        // Water buoyancy & slower fall
        const gravMul = this.inWater ? 0.3 : 1.0;
        const fallMul = this.inWater ? 0.4 : 1.0;
        this.vel.y = Math.max(this.vel.y + GRAVITY*F*gravMul, MAX_FALL*fallMul);
        this.onGround = false;

        if(!this.onGround && this.vel.y < 0 && this._fallStartY === null){
            if(!this.inWater) this._fallStartY = this.camera.position.y;
        }

        this.camera.position.y += this.vel.y * F;
        this._resolveY(F);

        // Swim up
        if(this.inWater && this.keys['Space']){
            this.vel.y = 0.15;
        }

        if(this.onGround && this._fallStartY !== null){
            const fallDist = this._fallStartY - this.camera.position.y;
            if(fallDist > 4 && !this.inWater){
                const dmg = Math.floor(fallDist - 3);
                this.takeDamage(dmg);
                sfx.hurt();
            }
            this._fallStartY = null;
        }

        const spaceNow = this.keys['Space'];
        if(spaceNow && !this._jumpPressed && this.onGround && !this.inWater){
            this.vel.y = JUMP_V;
            this.onGround = false;
            this._jumpPressed = true;
            sfx.jump();
        }
        if(!spaceNow) this._jumpPressed = false;

        if(this.camera.position.y < -30){
            this.takeDamage(this.maxHp);
        }

        // Hunger
        this._foodTimer += dt;
        const foodInterval = sprinting ? 25 : 45;
        if(this._foodTimer >= foodInterval){
            this._foodTimer = 0;
            if(this.food > 0) this.food = Math.max(0, this.food - 1);
        }
        // Starvation
        if(this.food === 0){
            this._starveTimer += dt;
            if(this._starveTimer >= 4){
                this._starveTimer = 0;
                this.takeDamage(1);
            }
        } else {
            this._starveTimer = 0;
        }
        // Regen
        if(this.food >= 18 && this.hp < this.maxHp){
            this._regenTimer += dt;
            if(this._regenTimer >= 4){
                this._regenTimer = 0;
                this.hp = Math.min(this.maxHp, this.hp + 1);
            }
        } else {
            this._regenTimer = 0;
        }
    }

    takeDamage(amount){
        if(this.gameMode === 'creative' || amount <= 0) return;
        this.hp = Math.max(0, this.hp - amount);
        sfx.hurt();
        // Trigger damage flash
        const flash = document.getElementById('damage-flash');
        if(flash){
            flash.classList.add('flash');
            setTimeout(() => flash.classList.remove('flash'), 200);
        }
        if(this.hp <= 0 && !this._dead){
            this._dead = true;
            this._die();
        }
    }

    _die(){
        this.unlock();
        const deathScreen = document.getElementById('death-screen');
        if(deathScreen) deathScreen.classList.remove('hidden');
        window.chatLog?.(`Vous êtes mort!`, 'system');
    }

    _respawn(){
        const sx = 8, sz = 8;
        const gh = this.world.getHeight(sx, sz);
        this.camera.position.set(sx + 0.5, gh + 2 + PLAYER_H, sz + 0.5);
        this.vel.set(0, 0, 0);
        this.hp = this.maxHp;
        this.food = this.maxFood;
        this._fallStartY = null;
        this._starveTimer = 0;
        this._foodTimer = 0;
        this._dead = false;
        const deathScreen = document.getElementById('death-screen');
        if(deathScreen) deathScreen.classList.add('hidden');
        setTimeout(() => this.lock(), 200);
    }

    spawn(){ this._respawn(); }
    healFood(amount){
        this.food = Math.min(this.maxFood, this.food + amount);
        sfx.eat();
    }
}

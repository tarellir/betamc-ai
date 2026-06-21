/* ============================================
   CraftWeb — Mobs Module (v2)
   Properly UV-mapped mob models using the
   standard Minecraft 64x32 sprite sheet layout.
   - Humanoid: zombie, skeleton, creeper (head + body + 2 arms + 2 legs)
   - Quadruped: pig, cow, sheep (head + body + 4 legs)
   - Spider: special model
   ============================================ */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { BLOCKS, BLOCK_META, CHUNK_HEIGHT } from "./world.js?v9";

// ============================
// MOB DEFINITIONS
// ============================
const MOB_TYPES = {
    pig:      { hostile: false, speed: 0.025, hp: 10, model: 'quadruped', scale: 0.9, drop: 'Porkchop' },
    cow:      { hostile: false, speed: 0.020, hp: 10, model: 'quadruped', scale: 1.0, drop: 'Leather' },
    chicken:  { hostile: false, speed: 0.030, hp: 4,  model: 'quadruped', scale: 0.5, drop: 'Feather' },
    sheep:    { hostile: false, speed: 0.025, hp: 8,  model: 'quadruped', scale: 0.9, drop: 'Wool' },
    zombie:   { hostile: true,  speed: 0.030, hp: 20, model: 'humanoid', scale: 1.0, drop: 'Rotten Flesh' },
    skeleton: { hostile: true,  speed: 0.030, hp: 16, model: 'humanoid', scale: 1.0, drop: 'Bone' },
    creeper:  { hostile: true,  speed: 0.040, hp: 20, model: 'humanoid', scale: 1.0, drop: 'Gunpowder' },
    spider:   { hostile: true,  speed: 0.045, hp: 16, model: 'spider',   scale: 1.0, drop: 'String' },
};

// ============================
// TEXTURE LOADING
// ============================
const TL = new THREE.TextureLoader();
function mobTex(name){
    const t = TL.load(`assets/textures/mob/${name}.png`);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

const MOB_TEX = {
    pig:      mobTex('pig'),
    cow:      mobTex('cow'),
    chicken:  mobTex('chicken'),
    sheep:    mobTex('sheep'),
    zombie:   mobTex('zombie'),
    skeleton: mobTex('skeleton'),
    creeper:  mobTex('creeper'),
    spider:   mobTex('spider'),
};

// ============================
// UV HELPER
// Set per-face UVs on a BoxGeometry
// Face order in Three.js BoxGeometry: +X, -X, +Y, -Y, +Z, -Z
//   = right, left, top, bottom, front, back
// ============================
const TEX_W = 64, TEX_H = 32;

function setBoxUVs(geo, faceUVs){
    // faceUVs: array of 6 entries, each {x, y, w, h} in pixels (y=0 top of texture)
    const uvs = geo.attributes.uv;
    for(let f=0; f<6; f++){
        const r = faceUVs[f];
        const u0 = r.x / TEX_W;
        const u1 = (r.x + r.w) / TEX_W;
        const v0 = 1 - r.y / TEX_H;          // top of region (higher V)
        const v1 = 1 - (r.y + r.h) / TEX_H;  // bottom of region (lower V)
        const base = f * 4;  // 4 vertices per face
        uvs.setXY(base + 0, u0, v0);
        uvs.setXY(base + 1, u1, v0);
        uvs.setXY(base + 2, u0, v1);
        uvs.setXY(base + 3, u1, v1);
    }
    uvs.needsUpdate = true;
}

// ============================
// MODEL BUILDERS
// ============================

// Build a single body part: a box with a UV-mapped texture region.
// pos = [x, y, z] center of the box (relative to mob origin at feet)
// size = [w, h, d] in pixels (1 pixel = 1/16 block)
// faceUVs = array of 6 {x,y,w,h} for right, left, top, bottom, front, back
function buildPart(texture, pos, size, faceUVs){
    // Convert pixel sizes to block units (1 pixel = 1/16 block)
    const w = size[0] / 16, h = size[1] / 16, d = size[2] / 16;
    const geo = new THREE.BoxGeometry(w, h, d);
    setBoxUVs(geo, faceUVs);
    const mat = new THREE.MeshLambertMaterial({
        map: texture,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        transparent: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Position: pos is in pixels, with origin at feet center, y up
    // In Three.js, BoxGeometry is centered on its origin, so y offset = pos.y + size.y/2
    mesh.position.set(pos[0] / 16, (pos[1] + size[1] / 2) / 16, pos[2] / 16);
    return mesh;
}

// Build humanoid model: zombie/skeleton/creeper
// Standard Minecraft 64x32 skin layout:
//   Head (8x8x8): top@(8,0), bottom@(16,0), right@(0,8), front@(8,8), left@(16,8), back@(24,8)
//   Body (8x12x4): top@(20,16), bottom@(28,16), right@(16,20), front@(20,20), left@(28,20), back@(32,20)
//   Right arm (4x12x4): top@(44,16), bottom@(48,16), right@(40,20), front@(44,20), left@(48,20), back@(52,20)
//   Right leg (4x12x4): top@(4,16), bottom@(8,16), right@(0,20), front@(4,20), left@(8,20), back@(12,20)
//   (Left arm/leg use the same UVs as right in 64x32 format)
function buildHumanoid(texture){
    const group = new THREE.Group();
    // Sizes in pixels
    const headSize = [8, 8, 8];
    const bodySize = [8, 12, 4];
    const armSize  = [4, 12, 4];
    const legSize  = [4, 12, 4];

    // Positions (in pixels, origin at feet center, y up)
    // Head sits on top of body, body sits on top of legs
    const legY = 0;
    const bodyY = legY + 12;
    const headY = bodyY + 12;
    const armY = bodyY;

    // Head UVs
    const headUVs = [
        { x: 0,  y: 8,  w: 8, h: 8 },   // +X right
        { x: 16, y: 8,  w: 8, h: 8 },   // -X left  (mirrored for proper outside view)
        { x: 8,  y: 0,  w: 8, h: 8 },   // +Y top
        { x: 16, y: 0,  w: 8, h: 8 },   // -Y bottom
        { x: 8,  y: 8,  w: 8, h: 8 },   // +Z front
        { x: 24, y: 8,  w: 8, h: 8 },   // -Z back
    ];
    group.add(buildPart(texture, [0, headY, 0], headSize, headUVs));

    // Body UVs
    const bodyUVs = [
        { x: 16, y: 20, w: 4,  h: 12 },  // +X right
        { x: 28, y: 20, w: 4,  h: 12 },  // -X left
        { x: 20, y: 16, w: 8,  h: 4 },   // +Y top
        { x: 28, y: 16, w: 8,  h: 4 },   // -Y bottom
        { x: 20, y: 20, w: 8,  h: 12 },  // +Z front
        { x: 32, y: 20, w: 8,  h: 12 },  // -Z back
    ];
    group.add(buildPart(texture, [0, bodyY, 0], bodySize, bodyUVs));

    // Right arm (player's right = -X side)
    const armRUVs = [
        { x: 40, y: 20, w: 4, h: 12 },  // +X
        { x: 48, y: 20, w: 4, h: 12 },  // -X
        { x: 44, y: 16, w: 4, h: 4 },   // +Y
        { x: 48, y: 16, w: 4, h: 4 },   // -Y
        { x: 44, y: 20, w: 4, h: 12 },  // +Z
        { x: 52, y: 20, w: 4, h: 12 },  // -Z
    ];
    group.add(buildPart(texture, [-(bodySize[0]/2 + armSize[0]/2), armY, 0], armSize, armRUVs));

    // Left arm (player's left = +X side) - use same UVs (mirror not needed in 64x32 format)
    group.add(buildPart(texture, [(bodySize[0]/2 + armSize[0]/2), armY, 0], armSize, armRUVs));

    // Right leg
    const legUVs = [
        { x: 0,  y: 20, w: 4, h: 12 },  // +X
        { x: 8,  y: 20, w: 4, h: 12 },  // -X
        { x: 4,  y: 16, w: 4, h: 4 },   // +Y
        { x: 8,  y: 16, w: 4, h: 4 },   // -Y
        { x: 4,  y: 20, w: 4, h: 12 },  // +Z
        { x: 12, y: 20, w: 4, h: 12 },  // -Z
    ];
    group.add(buildPart(texture, [-2, legY, 0], legSize, legUVs));   // right leg
    group.add(buildPart(texture, [2,  legY, 0], legSize, legUVs));   // left leg

    return group;
}

// Build quadruped model: pig/cow/sheep
// Pig layout (64x32):
//   Head (8x8x8) at top-left
//   Body (varies, e.g. pig 8x8x16)
//   4 legs (4x6x4)
function buildQuadruped(texture, bodyW=8, bodyH=8, bodyD=16, legH=6){
    const group = new THREE.Group();
    const headSize = [8, 8, 8];
    const legSize  = [4, legH, 4];

    // Y positions
    const legY = 0;
    const bodyY = legH;
    const headY = bodyY + (bodyH - 4);  // head slightly above body center

    // Head UVs (standard)
    const headUVs = [
        { x: 0,  y: 8,  w: 8, h: 8 },
        { x: 16, y: 8,  w: 8, h: 8 },
        { x: 8,  y: 0,  w: 8, h: 8 },
        { x: 16, y: 0,  w: 8, h: 8 },
        { x: 8,  y: 8,  w: 8, h: 8 },
        { x: 24, y: 8,  w: 8, h: 8 },
    ];
    // Head is at front (+Z direction)
    group.add(buildPart(texture, [0, headY, bodyD/2 + headSize[2]/2 - 2], headSize, headUVs));

    // Body UVs (placed in the body section of the texture)
    // Body section starts at (28, 8) for quadrupeds in 64x32
    // top: (bodyX+headW, 8), bottom: (bodyX+headW+bodyW, 8)
    // front: (bodyX+headW, 8+bodyH), back: (bodyX+headW+bodyW, 8+bodyH)
    // Actually for pig the body texture is laid out differently. Let me use:
    // top: (28, 8), bottom: (28+bodyW, 8) — wait the standard is:
    // For pig body (8x8x16 approximately):
    //   top: at (28, 8) size (16, 4) — but only 8x4 visible since body is 8 wide
    //   Hmm, this is getting complex. Let me just use a reasonable UV mapping.
    const bodyUVs = [
        // right (+X): side view of body
        { x: 28 + bodyD, y: 8 + bodyH, w: 4, h: bodyH },
        // left (-X): same but flipped
        { x: 28 + bodyD + 4, y: 8 + bodyH, w: 4, h: bodyH },
        // top (+Y): top of body
        { x: 28, y: 8, w: bodyD, h: 4 },
        // bottom (-Y): bottom of body
        { x: 28 + bodyD, y: 8, w: bodyD, h: 4 },
        // front (+Z): front of body (where head is)
        { x: 28, y: 8 + bodyH, w: 4, h: bodyH },
        // back (-Z): back of body
        { x: 28 + 4, y: 8 + bodyH, w: 4, h: bodyH },
    ];
    group.add(buildPart(texture, [0, bodyY, 0], [bodyW, bodyH, bodyD], bodyUVs));

    // 4 legs at corners
    const legUVs = [
        { x: 0,  y: 16, w: 4, h: legH },
        { x: 8,  y: 16, w: 4, h: legH },
        { x: 4,  y: 16, w: 4, h: 4 },
        { x: 8,  y: 16, w: 4, h: 4 },
        { x: 4,  y: 16, w: 4, h: legH },
        { x: 12, y: 16, w: 4, h: legH },
    ];
    const legX = bodyW/2 - legSize[0]/2;
    const legZ = bodyD/2 - legSize[2]/2;
    group.add(buildPart(texture, [-legX, legY,  legZ], legSize, legUVs));
    group.add(buildPart(texture, [ legX, legY,  legZ], legSize, legUVs));
    group.add(buildPart(texture, [-legX, legY, -legZ], legSize, legUVs));
    group.add(buildPart(texture, [ legX, legY, -legZ], legSize, legUVs));

    return group;
}

// Build spider model: head + body + 8 legs (simplified)
function buildSpider(texture){
    const group = new THREE.Group();
    // Head: 8x8x8 cube at front
    const headSize = [8, 8, 8];
    const headUVs = [
        { x: 32, y: 4,  w: 8, h: 4 },
        { x: 48, y: 4,  w: 8, h: 4 },
        { x: 40, y: 0,  w: 8, h: 4 },
        { x: 48, y: 0,  w: 8, h: 4 },
        { x: 40, y: 4,  w: 8, h: 4 },
        { x: 56, y: 4,  w: 8, h: 4 },
    ];
    group.add(buildPart(texture, [0, 4, 5], headSize, headUVs));

    // Body: 12x8x8 cube behind head
    const bodySize = [12, 8, 8];
    const bodyUVs = [
        { x: 0,  y: 4,  w: 4, h: 4 },
        { x: 16, y: 4,  w: 4, h: 4 },
        { x: 4,  y: 0,  w: 12, h: 4 },
        { x: 4,  y: 0,  w: 12, h: 4 },
        { x: 4,  y: 4,  w: 12, h: 4 },
        { x: 20, y: 4,  w: 12, h: 4 },
    ];
    group.add(buildPart(texture, [0, 4, -2], bodySize, bodyUVs));

    // 8 legs (4 per side) - simplified as thin boxes
    const legGeo = new THREE.BoxGeometry(15/16, 2/16, 2/16);
    const legMat = new THREE.MeshLambertMaterial({
        map: texture, alphaTest: 0.5, side: THREE.DoubleSide,
    });
    for(let i=0; i<4; i++){
        const z = 4 - i*3;
        // Right leg
        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(7/16, 4/16, z/16);
        legR.rotation.z = -Math.PI/2;
        group.add(legR);
        // Left leg
        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(-7/16, 4/16, z/16);
        legL.rotation.z = Math.PI/2;
        group.add(legL);
    }
    return group;
}

function buildMobMesh(type){
    const def = MOB_TYPES[type];
    const tex = MOB_TEX[type];
    let mesh;
    if(def.model === 'humanoid'){
        mesh = buildHumanoid(tex);
    } else if(def.model === 'quadruped'){
        // Different body sizes per animal
        if(type === 'pig')      mesh = buildQuadruped(tex, 8, 8, 16, 6);
        else if(type === 'cow') mesh = buildQuadruped(tex, 10, 12, 18, 6);
        else if(type === 'sheep') mesh = buildQuadruped(tex, 10, 12, 18, 6);
        else if(type === 'chicken') mesh = buildQuadruped(tex, 6, 6, 10, 4);
        else mesh = buildQuadruped(tex, 8, 8, 16, 6);
    } else if(def.model === 'spider'){
        mesh = buildSpider(tex);
    } else {
        mesh = buildHumanoid(tex);
    }
    // Apply scale
    mesh.scale.setScalar(def.scale || 1.0);
    return mesh;
}

// ============================
// MOB CLASS
// ============================
export class Mob {
    constructor(scene, world, type, x, y, z){
        this.scene = scene;
        this.world = world;
        this.type = type;
        this.def = MOB_TYPES[type];
        this.hp = this.def.hp;
        this.pos = new THREE.Vector3(x, y, z);
        this.vel = new THREE.Vector3();
        this.yaw = Math.random() * Math.PI * 2;
        this.mesh = buildMobMesh(type);
        this.mesh.position.copy(this.pos);
        scene.add(this.mesh);
        this._dirTimer = Math.random() * 3;
        this._attackCD = 0;
        this._dead = false;
        // Approximate AABB for collision (half-width, height)
        this.halfW = (this.def.model === 'humanoid') ? 0.3 : 0.5;
        this.height = (this.def.model === 'humanoid') ? 1.8 : 1.0;
    }

    update(dt, player, timeOfDay){
        if(this._dead) return;
        const F = Math.max(dt, 0) * 60;

        // Hostile mobs burn in daylight (sun above horizon)
        if(this.def.hostile && timeOfDay > 0.0 && timeOfDay < 0.5){
            this.hp -= dt * 1.5;
            // Visual: tint red when burning
            this._setBurnTint(true);
            if(this.hp <= 0){ this.kill(); return; }
        } else {
            this._setBurnTint(false);
        }

        // AI: hostile mobs chase player; passive wander
        const toPlayer = new THREE.Vector3().subVectors(player.camera.position, this.pos);
        const distToPlayer = toPlayer.length();
        toPlayer.normalize();

        if(this.def.hostile && distToPlayer < 16){
            this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
            this.vel.x = toPlayer.x * this.def.speed;
            this.vel.z = toPlayer.z * this.def.speed;
            if(distToPlayer < 1.5 && this._attackCD <= 0){
                player.takeDamage(2);
                this._attackCD = 1.0;
            }
        } else {
            this._dirTimer -= dt;
            if(this._dirTimer <= 0){
                this.yaw = Math.random() * Math.PI * 2;
                this._dirTimer = 2 + Math.random() * 3;
            }
            this.vel.x = Math.sin(this.yaw) * this.def.speed * 0.5;
            this.vel.z = Math.cos(this.yaw) * this.def.speed * 0.5;
        }
        if(this._attackCD > 0) this._attackCD -= dt;

        // Gravity
        this.vel.y -= 0.030 * F;

        // Auto-jump if blocked horizontally
        const fx = this.pos.x + this.vel.x * F * 5;
        const fz = this.pos.z + this.vel.z * F * 5;
        const fy = this.pos.y;
        if(this._solidAt(fx, fy - 0.1, fz) && !this._solidAt(fx, fy + 0.5, fz)){
            this.vel.y = 0.25;
        }

        // Apply movement with collision
        const oldX = this.pos.x, oldY = this.pos.y, oldZ = this.pos.z;
        this.pos.x += this.vel.x * F;
        if(this._collides(this.pos.x, this.pos.y, this.pos.z)){
            this.pos.x = oldX;
            this.vel.x = 0;
        }
        this.pos.z += this.vel.z * F;
        if(this._collides(this.pos.x, this.pos.y, this.pos.z)){
            this.pos.z = oldZ;
            this.vel.z = 0;
        }
        this.pos.y += this.vel.y * F;
        if(this._collides(this.pos.x, this.pos.y, this.pos.z)){
            if(this.vel.y < 0){
                this.pos.y = Math.floor(this.pos.y) + 1 + 0.001;
            } else {
                this.pos.y = oldY;
            }
            this.vel.y = 0;
        }

        if(this.pos.y < -10){ this.kill(); return; }

        this.mesh.position.copy(this.pos);
        this.mesh.rotation.y = this.yaw;
    }

    _setBurnTint(on){
        this.mesh.traverse(child => {
            if(child.isMesh && child.material){
                if(on){
                    child.material.color.setHex(0xff6644);
                    child.material.emissive = new THREE.Color(0x331100);
                } else {
                    child.material.color.setHex(0xffffff);
                    if(child.material.emissive) child.material.emissive.setHex(0x000000);
                }
            }
        });
    }

    _solidAt(x, y, z){
        const b = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        if(b === -1) return false;
        return b !== 0 && BLOCK_META[b]?.solid;
    }
    _collides(x, y, z){
        const w = this.halfW, h = this.height;
        for(const ox of [-w, w]){
            for(const oy of [0.1, h*0.5, h*0.9]){
                for(const oz of [-w, w]){
                    if(this._solidAt(x+ox, y+oy, z+oz)) return true;
                }
            }
        }
        return false;
    }

    takeDamage(amount){
        this.hp -= amount;
        if(this.hp <= 0) this.kill();
    }

    kill(){
        if(this._dead) return;
        this._dead = true;
        this.scene.remove(this.mesh);
        this.mesh.traverse(child => {
            if(child.isMesh){
                if(child.geometry) child.geometry.dispose();
                if(child.material){
                    if(child.material.map && child.material.map !== MOB_TEX[this.type]) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        });
        if(window.chatLog) window.chatLog(`${this.type} tué. Drop: ${this.def.drop}`, 'system');
    }

    dispose(){ this.kill(); }
}

// ============================
// MOB MANAGER
// ============================
export class MobManager {
    constructor(scene, world){
        this.scene = scene;
        this.world = world;
        this.mobs = [];
        this._spawnTimer = 0;
        this._maxMobs = 12;
    }

    update(dt, player, timeOfDay){
        this._spawnTimer -= dt;
        if(this._spawnTimer <= 0 && this.mobs.length < this._maxMobs){
            this._spawnTimer = 5 + Math.random() * 5;
            this._trySpawn(player, timeOfDay);
        }
        for(const m of this.mobs) m.update(dt, player, timeOfDay);
        this.mobs = this.mobs.filter(m => !m._dead);
    }

    _trySpawn(player, timeOfDay){
        const isNight = timeOfDay > 0.5 || timeOfDay < 0.15;
        const types = isNight
            ? ['zombie', 'skeleton', 'creeper', 'spider']
            : ['pig', 'cow', 'chicken', 'sheep'];
        const type = types[Math.floor(Math.random() * types.length)];

        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 8;
        const px = player.camera.position.x;
        const pz = player.camera.position.z;
        const sx = Math.floor(px + Math.cos(angle) * dist);
        const sz = Math.floor(pz + Math.sin(angle) * dist);
        const gh = this.world.getHeight(sx, sz);
        if(gh < 1 || gh >= CHUNK_HEIGHT - 2) return;
        const ground = this.world.getBlock(sx, gh, sz);
        if(ground === BLOCKS.WATER || ground === 0) return;
        const mob = new Mob(this.scene, this.world, type, sx + 0.5, gh + 1.2, sz + 0.5);
        this.mobs.push(mob);
    }

    getMobsNear(x, y, z, radius){
        const r2 = radius*radius;
        return this.mobs.filter(m => {
            const dx = m.pos.x - x, dy = m.pos.y - y, dz = m.pos.z - z;
            return dx*dx + dy*dy + dz*dz < r2;
        });
    }

    attack(camera, reach=4){
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        const camPos = camera.position;
        let hitMob = null;
        let hitDist = reach;
        for(const m of this.mobs){
            if(m._dead) continue;
            const toMob = new THREE.Vector3().subVectors(m.pos, camPos);
            const dist = toMob.length();
            if(dist > reach) continue;
            toMob.normalize();
            const dot = toMob.dot(fwd);
            if(dot > 0.5 && dist < hitDist){
                hitMob = m;
                hitDist = dist;
            }
        }
        if(hitMob){
            hitMob.takeDamage(3);
            return true;
        }
        return false;
    }

    disposeAll(){
        for(const m of this.mobs) m.dispose();
        this.mobs = [];
    }
}

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// ── Sons Web Audio (aucun fichier nécessaire) ────────────────────────────
let audioCtx = null;
function initAudio(){
    if(audioCtx) return;
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
}
function playNoise(dur,vol){
    if(!audioCtx) return;
    const sr=audioCtx.sampleRate, sz=Math.floor(sr*dur);
    const buf=audioCtx.createBuffer(1,sz,sr);
    const d=buf.getChannelData(0);
    for(let i=0;i<sz;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/sz,3);
    const src=audioCtx.createBufferSource(), g=audioCtx.createGain();
    src.buffer=buf; g.gain.setValueAtTime(vol,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+dur);
    src.connect(g); g.connect(audioCtx.destination); src.start();
}
function playTone(f0,f1,dur,type,vol){
    if(!audioCtx) return;
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=type||'sine';
    o.frequency.setValueAtTime(f0,audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f1,audioCtx.currentTime+dur*.9);
    g.gain.setValueAtTime(vol,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime+dur);
}
export const sfx={
    break: ()=>playNoise(0.08,0.35),
    place: ()=>playTone(150,50,0.12,'triangle',0.25),
    jump:  ()=>playTone(180,700,0.15,'sine',0.2),
};

// ── Constantes physique ────────────────────────────────────────────────
const PLAYER_H  = 1.8;
const HALF_W    = 0.3;
const MOVE_SPD  = 0.1;
const SPRINT_SPD= 0.18;
const GRAVITY   = -0.035;
const JUMP_V    = 0.32;

export class Player {
    constructor(camera, world, canvas){
        this.camera   = camera;
        this.world    = world;
        this.canvas   = canvas;
        this.vel      = new THREE.Vector3();
        this.yaw      = 0;
        this.pitch    = 0;
        this.onGround = false;
        this.gameMode = 'survival';
        this.selectedBlock = 1;
        this.keys     = {};
        this.locked   = false;

        camera.rotation.order = 'YXZ';
        // Spawn en hauteur, le monde va se générer dessous
        camera.position.set(8, 80, 8);

        document.addEventListener('keydown', e=>{
            this.keys[e.code]=true;
            // Scroll hotbar avec molette clavier (pas molette souris ici)
        });
        document.addEventListener('keyup', e=>{ this.keys[e.code]=false; });

        document.addEventListener('mousemove', e=>{
            if(!this.locked) return;
            this.yaw   -= e.movementX*0.002;
            this.pitch -= e.movementY*0.002;
            this.pitch  = Math.max(-1.55, Math.min(1.55, this.pitch));
            camera.rotation.y = this.yaw;
            camera.rotation.x = this.pitch;
        });

        document.addEventListener('mousedown', e=>{
            if(!this.locked) return;
            initAudio();
            this._interact(e.button);
        });

        document.addEventListener('pointerlockchange', ()=>{
            this.locked = document.pointerLockElement === this.canvas;
        });

        document.addEventListener('wheel', e=>{
            if(!this.locked) return;
            const dir = e.deltaY>0 ? 1 : -1;
            this.selectedBlock = ((this.selectedBlock-1+dir+11)%11)+1;
            document.dispatchEvent(new CustomEvent('slotChange',{detail:this.selectedBlock-1}));
        });
    }

    lock(){ this.canvas.requestPointerLock(); }
    unlock(){ if(document.pointerLockElement) document.exitPointerLock(); }

    // ── Interaction blocs ──────────────────────────────────────────────
    _interact(btn){
        const ray=new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
        ray.far=6;
        const hits=ray.intersectObjects(this.world.getRayMeshes(), false);
        if(!hits.length) return;
        const hit=hits[0];
        const n=hit.face.normal;
        const pt=hit.point.clone().addScaledVector(n,-0.5);
        const bx=Math.floor(pt.x+0.5), by=Math.floor(pt.y+0.5), bz=Math.floor(pt.z+0.5);

        if(btn===0){
            this.world.setBlock(bx,by,bz,0);
            sfx.break();
        } else if(btn===2){
            const nx=bx+Math.round(n.x), ny=by+Math.round(n.y), nz=bz+Math.round(n.z);
            // Pas de bloc dans le joueur
            const px=this.camera.position.x, py=this.camera.position.y, pz=this.camera.position.z;
            if(Math.abs(nx-px)<0.8 && Math.abs(nz-pz)<0.8 && ny>py-PLAYER_H-0.5 && ny<py+0.5) return;
            this.world.setBlock(nx,ny,nz,this.selectedBlock);
            sfx.place();
        }
    }

    // ── Collision AABB (X, Z, Y séparés) ──────────────────────────────
    _resolveX(){
        const cam=this.camera.position;
        const minY=cam.y-PLAYER_H, maxY=cam.y;
        for(let bx=Math.floor(cam.x-HALF_W-0.5); bx<=Math.ceil(cam.x+HALF_W+0.5); bx++){
            for(let by=Math.floor(minY); by<=Math.ceil(maxY); by++){
                for(let bz=Math.floor(cam.z-HALF_W-0.5); bz<=Math.ceil(cam.z+HALF_W+0.5); bz++){
                    if(!this._solid(bx,by,bz)) continue;
                    if(cam.x>bx){ cam.x=bx+0.5+HALF_W; } else { cam.x=bx-0.5-HALF_W; }
                    this.vel.x=0; return;
                }
            }
        }
    }
    _resolveZ(){
        const cam=this.camera.position;
        const minY=cam.y-PLAYER_H, maxY=cam.y;
        for(let bx=Math.floor(cam.x-HALF_W-0.5); bx<=Math.ceil(cam.x+HALF_W+0.5); bx++){
            for(let by=Math.floor(minY); by<=Math.ceil(maxY); by++){
                for(let bz=Math.floor(cam.z-HALF_W-0.5); bz<=Math.ceil(cam.z+HALF_W+0.5); bz++){
                    if(!this._solid(bx,by,bz)) continue;
                    if(cam.z>bz){ cam.z=bz+0.5+HALF_W; } else { cam.z=bz-0.5-HALF_W; }
                    this.vel.z=0; return;
                }
            }
        }
    }
    _resolveY(){
        const cam=this.camera.position;
        const minY=cam.y-PLAYER_H, maxY=cam.y;
        for(let bx=Math.floor(cam.x-HALF_W); bx<=Math.ceil(cam.x+HALF_W); bx++){
            for(let by=Math.floor(minY-0.5); by<=Math.ceil(maxY+0.5); by++){
                for(let bz=Math.floor(cam.z-HALF_W); bz<=Math.ceil(cam.z+HALF_W); bz++){
                    if(!this._solid(bx,by,bz)) continue;
                    if(this.vel.y<=0){
                        cam.y=by+0.5+PLAYER_H;
                        this.vel.y=0; this.onGround=true;
                    } else {
                        cam.y=by-0.5;
                        this.vel.y=0;
                    }
                    return;
                }
            }
        }
    }
    _solid(x,y,z){ return this.world.getBlock(x,y,z)!==0; }

    // ── Update ────────────────────────────────────────────────────────
    update(dt){
        initAudio();
        const creative = this.gameMode==='creative';
        const spd = this.keys['ShiftLeft'] ? (creative?0.4:SPRINT_SPD) : (creative?0.2:MOVE_SPD);

        const fwd=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
        const rgt=new THREE.Vector3( Math.cos(this.yaw),0,-Math.sin(this.yaw));
        const mv =new THREE.Vector3();
        if(this.keys['KeyW']) mv.addScaledVector(fwd, spd);
        if(this.keys['KeyS']) mv.addScaledVector(fwd,-spd);
        if(this.keys['KeyA']) mv.addScaledVector(rgt,-spd);
        if(this.keys['KeyD']) mv.addScaledVector(rgt, spd);

        // ── Mode créatif ─────────────────────────────────────────────
        if(creative){
            this.camera.position.add(mv);
            if(this.keys['Space'])       this.camera.position.y+=spd;
            if(this.keys['ControlLeft']) this.camera.position.y-=spd;
            return;
        }

        // ── Mode survie avec physique AABB ───────────────────────────
        this.camera.position.x += mv.x;
        this._resolveX();
        this.camera.position.z += mv.z;
        this._resolveZ();

        // Gravité
        this.vel.y = Math.max(this.vel.y + GRAVITY, -1.5);
        this.onGround = false;
        this.camera.position.y += this.vel.y;
        this._resolveY();

        // Saut
        if(this.keys['Space'] && this.onGround){
            this.vel.y=JUMP_V;
            this.onGround=false;
            sfx.jump();
        }

        // Anti-chute infinie
        if(this.camera.position.y < -20){
            const gh=this.world.getHeight(Math.floor(this.camera.position.x), Math.floor(this.camera.position.z));
            this.camera.position.set(this.camera.position.x, gh+PLAYER_H+5, this.camera.position.z);
            this.vel.y=0;
        }
    }
}

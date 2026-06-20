import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 64;

export const BLOCKS = {
    AIR:0, STONE:1, GRASS:2, DIRT:3, COBBLESTONE:4, WOOD:5,
    LEAVES:6, BEDROCK:7, COAL_ORE:8, IRON_ORE:9, DIAMOND_ORE:10, BRICK:11
};

// ── Textures ────────────────────────────────────────────────────────────
const TL = new THREE.TextureLoader();
function t(p){ const tx=TL.load(p); tx.magFilter=THREE.NearestFilter; tx.minFilter=THREE.NearestFilter; return tx; }

const TX = {
    stone   : t('assets/textures/blocks/stone.png'),
    dirt    : t('assets/textures/blocks/dirt.png'),
    cobble  : t('assets/textures/blocks/cobblestone.png'),
    bedrock : t('assets/textures/blocks/bedrock.png'),
    gtop    : t('assets/textures/blocks/grass_top.png'),
    gside   : t('assets/textures/blocks/grass_side.png'),
    tside   : t('assets/textures/blocks/tree_side.png'),
    ttop    : t('assets/textures/blocks/tree_top.png'),
    leaves  : t('assets/textures/blocks/leaves.png'),
    coal    : t('assets/textures/blocks/coal_ore.png'),
    iron    : t('assets/textures/blocks/iron_ore.png'),
    diamond : t('assets/textures/blocks/diamond_ore.png'),
    brick   : t('assets/textures/blocks/brick.png'),
};

function mat(tx,col){ const m=new THREE.MeshLambertMaterial({map:tx}); if(col) m.color.set(col); return m; }

// Matériaux indexés par [blockType][face: 0=+Y,1=-Y,2=+X,3=-X,4=+Z,5=-Z]
const MATS = {
    [BLOCKS.STONE]      : Array(6).fill(mat(TX.stone)),
    [BLOCKS.DIRT]       : Array(6).fill(mat(TX.dirt)),
    [BLOCKS.COBBLESTONE]: Array(6).fill(mat(TX.cobble)),
    [BLOCKS.BEDROCK]    : Array(6).fill(mat(TX.bedrock)),
    [BLOCKS.COAL_ORE]   : Array(6).fill(mat(TX.coal)),
    [BLOCKS.IRON_ORE]   : Array(6).fill(mat(TX.iron)),
    [BLOCKS.DIAMOND_ORE]: Array(6).fill(mat(TX.diamond)),
    [BLOCKS.BRICK]      : Array(6).fill(mat(TX.brick)),
    [BLOCKS.GRASS]      : [mat(TX.gtop,0x71bc4a), mat(TX.dirt), mat(TX.gside), mat(TX.gside), mat(TX.gside), mat(TX.gside)],
    [BLOCKS.WOOD]       : [mat(TX.ttop), mat(TX.ttop), mat(TX.tside), mat(TX.tside), mat(TX.tside), mat(TX.tside)],
    [BLOCKS.LEAVES]     : Array(6).fill(mat(TX.leaves,0x4c8e2b)),
};

// ── Bruit ───────────────────────────────────────────────────────────────
function hash(x,z){ const s=Math.sin(x*127.1+z*311.7)*43758.5453; return s-Math.floor(s); }
function lerp(a,b,t){ return a+(b-a)*t; }
function smooth(t){ return t*t*(3-2*t); }
function noise(x,z,sc){
    const fx=x*sc, fz=z*sc, ix=Math.floor(fx), iz=Math.floor(fz);
    const dx=fx-ix, dz=fz-iz;
    return lerp(lerp(hash(ix,iz),hash(ix+1,iz),smooth(dx)),
                lerp(hash(ix,iz+1),hash(ix+1,iz+1),smooth(dx)), smooth(dz));
}
function getH(x,z){
    return Math.floor(14 + noise(x,z,0.025)*15 + noise(x+500,z+500,0.07)*5);
}

// ── Géométrie des faces ─────────────────────────────────────────────────
const DIR  = [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
const NORM = [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
const VERTS = [
    [[0,1,0],[1,1,0],[1,1,1],[0,1,1]],   // +Y top
    [[0,0,1],[1,0,1],[1,0,0],[0,0,0]],   // -Y bot
    [[1,0,0],[1,1,0],[1,1,1],[1,0,1]],   // +X
    [[0,0,1],[0,1,1],[0,1,0],[0,0,0]],   // -X
    [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],   // +Z
    [[1,0,0],[0,0,0],[0,1,0],[1,1,0]],   // -Z
];
const UVS  = [[0,0],[1,0],[1,1],[0,1]];
const IDX  = [0,1,2, 0,2,3];

export class World {
    constructor(scene){
        this.scene  = scene;
        this.chunks = new Map();
        this.rayMeshes = [];
        this.renderDistance = 3;
    }

    chunkKey(cx,cz){ return `${cx},${cz}`; }
    getHeight(x,z){ return getH(x,z); }

    getBlock(x,y,z){
        if(y<0||y>=CHUNK_HEIGHT) return 0;
        const cx=Math.floor(x/CHUNK_SIZE), cz=Math.floor(z/CHUNK_SIZE);
        const ch=this.chunks.get(this.chunkKey(cx,cz));
        if(!ch) return 0;
        const bx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
        const bz=((z%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
        return ch.data[bx + bz*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE];
    }

    setBlock(x,y,z,type){
        if(y<0||y>=CHUNK_HEIGHT) return;
        const cx=Math.floor(x/CHUNK_SIZE), cz=Math.floor(z/CHUNK_SIZE);
        const ch=this.chunks.get(this.chunkKey(cx,cz));
        if(!ch) return;
        const bx=((x%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
        const bz=((z%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
        ch.data[bx + bz*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE] = type;
        this._rebuild(cx,cz);
        if(bx===0)           this._rebuild(cx-1,cz);
        if(bx===CHUNK_SIZE-1)this._rebuild(cx+1,cz);
        if(bz===0)           this._rebuild(cx,cz-1);
        if(bz===CHUNK_SIZE-1)this._rebuild(cx,cz+1);
    }

    _gen(cx,cz){
        const key=this.chunkKey(cx,cz);
        if(this.chunks.has(key)) return;
        const data=new Uint8Array(CHUNK_SIZE*CHUNK_SIZE*CHUNK_HEIGHT);

        for(let lx=0;lx<CHUNK_SIZE;lx++){
            for(let lz=0;lz<CHUNK_SIZE;lz++){
                const ax=cx*CHUNK_SIZE+lx, az=cz*CHUNK_SIZE+lz;
                const gh=getH(ax,az);

                for(let y=0;y<CHUNK_HEIGHT;y++){
                    const i=lx+lz*CHUNK_SIZE+y*CHUNK_SIZE*CHUNK_SIZE;
                    if(y===0)         data[i]=BLOCKS.BEDROCK;
                    else if(y<gh-3)   data[i]=BLOCKS.STONE;
                    else if(y<gh)     data[i]=BLOCKS.DIRT;
                    else if(y===gh)   data[i]=BLOCKS.GRASS;
                }

                // Minerais
                for(let y=1;y<gh-4;y++){
                    const r=hash(ax*3+y*7, az*7+y*13);
                    const i=lx+lz*CHUNK_SIZE+y*CHUNK_SIZE*CHUNK_SIZE;
                    if     (r<0.012)       data[i]=BLOCKS.COAL_ORE;
                    else if(r<0.017)       data[i]=BLOCKS.IRON_ORE;
                    else if(r<0.019&&y<16) data[i]=BLOCKS.DIAMOND_ORE;
                }

                // Arbres (peu fréquents)
                if(gh<CHUNK_HEIGHT-10 && hash(ax*17+3,az*31+7)<0.016){
                    for(let ty=1;ty<=5;ty++){
                        const iy=gh+ty;
                        if(iy<CHUNK_HEIGHT) data[lx+lz*CHUNK_SIZE+iy*CHUNK_SIZE*CHUNK_SIZE]=BLOCKS.WOOD;
                    }
                    for(let lx2=-2;lx2<=2;lx2++) for(let lz2=-2;lz2<=2;lz2++) for(let ly=2;ly<=5;ly++){
                        if(Math.abs(lx2)+Math.abs(lz2)+Math.abs(ly-4)>4) continue;
                        const fx=lx+lx2, fz_=lz+lz2, fy=gh+ly;
                        if(fx>=0&&fx<CHUNK_SIZE&&fz_>=0&&fz_<CHUNK_SIZE&&fy<CHUNK_HEIGHT){
                            const fi=fx+fz_*CHUNK_SIZE+fy*CHUNK_SIZE*CHUNK_SIZE;
                            if(!data[fi]) data[fi]=BLOCKS.LEAVES;
                        }
                    }
                }
            }
        }
        this.chunks.set(key,{data,meshes:[],cx,cz});
    }

    _rebuild(cx,cz){
        const key=this.chunkKey(cx,cz);
        const ch=this.chunks.get(key);
        if(!ch) return;

        // Nettoyer
        for(const m of ch.meshes){ this.scene.remove(m); m.geometry.dispose(); }
        ch.meshes=[];
        this.rayMeshes=this.rayMeshes.filter(m=>m.userData.cx!==cx||m.userData.cz!==cz);

        // Construire buffers par (blockType × faceIndex)
        const bufs=new Map();
        const x0=cx*CHUNK_SIZE, z0=cz*CHUNK_SIZE;

        for(let lx=0;lx<CHUNK_SIZE;lx++){
            for(let lz=0;lz<CHUNK_SIZE;lz++){
                for(let y=0;y<CHUNK_HEIGHT;y++){
                    const bt=ch.data[lx+lz*CHUNK_SIZE+y*CHUNK_SIZE*CHUNK_SIZE];
                    if(!bt) continue;
                    const ax=x0+lx, az=z0+lz;

                    for(let f=0;f<6;f++){
                        const d=DIR[f];
                        const nb=this.getBlock(ax+d[0],y+d[1],az+d[2]);
                        if(nb!==0 && !(nb===BLOCKS.LEAVES&&bt!==BLOCKS.LEAVES)) continue;

                        const key2=bt*6+f;
                        if(!bufs.has(key2)) bufs.set(key2,{pos:[],uv:[],nor:[],idx:[],n:0,bt,f});
                        const b=bufs.get(key2), vs=VERTS[f], base=b.n;

                        for(let v=0;v<4;v++){
                            b.pos.push(ax+vs[v][0], y+vs[v][1], az+vs[v][2]);
                            b.uv.push(UVS[v][0],UVS[v][1]);
                            b.nor.push(...NORM[f]);
                        }
                        for(const i of IDX) b.idx.push(base+i);
                        b.n+=4;
                    }
                }
            }
        }

        for(const [,b] of bufs){
            if(!b.pos.length) continue;
            const geo=new THREE.BufferGeometry();
            geo.setAttribute('position',new THREE.Float32BufferAttribute(b.pos,3));
            geo.setAttribute('uv',      new THREE.Float32BufferAttribute(b.uv,2));
            geo.setAttribute('normal',  new THREE.Float32BufferAttribute(b.nor,3));
            geo.setIndex(b.idx);
            const matList=MATS[b.bt];
            const mesh=new THREE.Mesh(geo, matList?matList[b.f]:MATS[BLOCKS.STONE][0]);
            mesh.userData={cx,cz};
            this.scene.add(mesh);
            ch.meshes.push(mesh);
            this.rayMeshes.push(mesh);
        }
    }

    update(pos){
        const pcx=Math.floor(pos.x/CHUNK_SIZE), pcz=Math.floor(pos.z/CHUNK_SIZE);
        const rd=this.renderDistance;
        let built=0;

        for(let dx=-rd;dx<=rd&&built<2;dx++){
            for(let dz=-rd;dz<=rd&&built<2;dz++){
                const cx=pcx+dx, cz=pcz+dz;
                if(!this.chunks.has(this.chunkKey(cx,cz))){
                    this._gen(cx,cz);
                    this._rebuild(cx,cz);
                    built++;
                }
            }
        }

        const ul=rd+2;
        for(const [k,ch] of this.chunks){
            if(Math.abs(ch.cx-pcx)>ul||Math.abs(ch.cz-pcz)>ul){
                for(const m of ch.meshes){ this.scene.remove(m); m.geometry.dispose(); }
                this.rayMeshes=this.rayMeshes.filter(m=>m.userData.cx!==ch.cx||m.userData.cz!==ch.cz);
                this.chunks.delete(k);
            }
        }
    }

    getRayMeshes(){ return this.rayMeshes; }
}

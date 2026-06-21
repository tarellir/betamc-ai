/* ============================================
   CraftWeb — World Module (v10)
   - Real Perlin noise (gradient noise) for natural terrain
   - Golden Days color palette (vibrant Beta 1.8 look)
   - Proper sand beaches around water
   - Correct face winding (CCW from outside)
   ============================================ */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { perlin2, fbm2, ridged2 } from "./noise.js?v10";

export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 64;
export const SEA_LEVEL    = 14;

export const BLOCKS = {
    AIR:0, STONE:1, GRASS:2, DIRT:3, COBBLESTONE:4, WOOD:5,
    LEAVES:6, BEDROCK:7, COAL_ORE:8, IRON_ORE:9, DIAMOND_ORE:10, BRICK:11,
    SAND:12, WATER:13, PLANKS:14, GLASS:15, SNOW:16, PUMPKIN:17,
    SANDSTONE:18, GRAVEL:19, FLOWER_RED:20, FLOWER_YELLOW:21, MUSHROOM_RED:22,
    CACTUS:23, OBSIDIAN:24, BRICKS:25
};

export const BLOCK_META = {
    [BLOCKS.AIR]:           { name: 'Air',        solid: false, transparent: true,  liquid: false },
    [BLOCKS.STONE]:         { name: 'Pierre',     solid: true,  transparent: false, liquid: false },
    [BLOCKS.GRASS]:         { name: 'Herbe',      solid: true,  transparent: false, liquid: false },
    [BLOCKS.DIRT]:          { name: 'Terre',      solid: true,  transparent: false, liquid: false },
    [BLOCKS.COBBLESTONE]:   { name: 'Cobble',     solid: true,  transparent: false, liquid: false },
    [BLOCKS.WOOD]:          { name: 'Bois',       solid: true,  transparent: false, liquid: false },
    [BLOCKS.LEAVES]:        { name: 'Feuilles',   solid: true,  transparent: true,  liquid: false },
    [BLOCKS.BEDROCK]:       { name: 'Bedrock',    solid: true,  transparent: false, liquid: false },
    [BLOCKS.COAL_ORE]:      { name: 'Charbon',    solid: true,  transparent: false, liquid: false },
    [BLOCKS.IRON_ORE]:      { name: 'Fer',        solid: true,  transparent: false, liquid: false },
    [BLOCKS.DIAMOND_ORE]:   { name: 'Diamant',    solid: true,  transparent: false, liquid: false },
    [BLOCKS.BRICK]:         { name: 'Brique',     solid: true,  transparent: false, liquid: false },
    [BLOCKS.SAND]:          { name: 'Sable',      solid: true,  transparent: false, liquid: false },
    [BLOCKS.WATER]:         { name: 'Eau',        solid: false, transparent: true,  liquid: true  },
    [BLOCKS.PLANKS]:        { name: 'Planches',   solid: true,  transparent: false, liquid: false },
    [BLOCKS.GLASS]:         { name: 'Verre',      solid: true,  transparent: true,  liquid: false },
    [BLOCKS.SNOW]:          { name: 'Neige',      solid: true,  transparent: false, liquid: false },
    [BLOCKS.PUMPKIN]:       { name: 'Citrouille', solid: true,  transparent: false, liquid: false },
    [BLOCKS.SANDSTONE]:     { name: 'Grès',       solid: true,  transparent: false, liquid: false },
    [BLOCKS.GRAVEL]:        { name: 'Gravier',    solid: true,  transparent: false, liquid: false },
    [BLOCKS.FLOWER_RED]:    { name: 'Fleur',      solid: false, transparent: true,  liquid: false },
    [BLOCKS.FLOWER_YELLOW]: { name: 'Tournesol',  solid: false, transparent: true,  liquid: false },
    [BLOCKS.MUSHROOM_RED]:  { name: 'Champignon', solid: false, transparent: true,  liquid: false },
    [BLOCKS.CACTUS]:        { name: 'Cactus',     solid: true,  transparent: false, liquid: false },
    [BLOCKS.OBSIDIAN]:      { name: 'Obsidienne', solid: true,  transparent: false, liquid: false },
    [BLOCKS.BRICKS]:        { name: 'Briques',    solid: true,  transparent: false, liquid: false },
};

export const HOTBAR_BLOCKS = [
    BLOCKS.GRASS, BLOCKS.DIRT, BLOCKS.STONE, BLOCKS.COBBLESTONE,
    BLOCKS.WOOD, BLOCKS.PLANKS, BLOCKS.LEAVES, BLOCKS.SAND,
    BLOCKS.SANDSTONE, BLOCKS.GLASS, BLOCKS.BRICK, BLOCKS.BRICKS,
    BLOCKS.COAL_ORE, BLOCKS.IRON_ORE, BLOCKS.DIAMOND_ORE, BLOCKS.GRAVEL,
    BLOCKS.PUMPKIN, BLOCKS.CACTUS, BLOCKS.OBSIDIAN, BLOCKS.SNOW,
    BLOCKS.BEDROCK, BLOCKS.WATER
];

// ============================
// TEXTURE LOADING
// BUGFIX v9: Disable mipmaps for ALL textures (pixel art should be crisp, not blurry)
// ============================
const TL = new THREE.TextureLoader();
function tex(p){
    const t = TL.load(p);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;  // v9: no mipmaps - keeps pixel art crisp
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function texAlpha(p){
    // Same as tex() - no mipmaps for pixel art
    return tex(p);
}

const TX = {
    stone:     tex('assets/textures/blocks/stone.png'),
    dirt:      tex('assets/textures/blocks/dirt.png'),
    cobble:    tex('assets/textures/blocks/cobblestone.png'),
    bedrock:   tex('assets/textures/blocks/bedrock.png'),
    gtop:      tex('assets/textures/blocks/grass_top_tinted.png'),
    gside:     tex('assets/textures/blocks/grass_side.png'),
    tside:     tex('assets/textures/blocks/tree_side.png'),
    ttop:      tex('assets/textures/blocks/tree_top.png'),
    leaves:    texAlpha('assets/textures/blocks/leaves_tinted.png'),
    coal:      tex('assets/textures/blocks/coal_ore.png'),
    iron:      tex('assets/textures/blocks/iron_ore.png'),
    diamond:   tex('assets/textures/blocks/diamond_ore.png'),
    brick:     tex('assets/textures/blocks/brick.png'),
    sand:      tex('assets/textures/blocks/dirt.png'),
    water:     texAlpha('assets/textures/blocks/dirt.png'),
    planks:    tex('assets/textures/blocks/tree_top.png'),
    glass:     texAlpha('assets/textures/blocks/leaves.png'),
    snow:      tex('assets/textures/blocks/dirt.png'),
    pumpkin:   tex('assets/textures/blocks/brick.png'),
    sandstone: tex('assets/textures/blocks/cobblestone.png'),
    gravel:    tex('assets/textures/blocks/cobblestone.png'),
    flower_red:    texAlpha('assets/textures/blocks/leaves.png'),
    flower_yellow: texAlpha('assets/textures/blocks/leaves.png'),
    mushroom:      texAlpha('assets/textures/blocks/leaves.png'),
    cactus:    tex('assets/textures/blocks/grass_top.png'),
    obsidian:  tex('assets/textures/blocks/stone.png'),
    bricks:    tex('assets/textures/blocks/brick.png'),
};

function mat(tx, opts={}){
    return new THREE.MeshLambertMaterial({ map: tx, ...opts });
}
function tintMat(tx, color, opts={}){
    return new THREE.MeshLambertMaterial({ map: tx, color, ...opts });
}
function uniformMat(tx, opts={}){
    const m = mat(tx, opts);
    return [m, m, m, m, m, m];
}

const M = {
    [BLOCKS.STONE]:       uniformMat(TX.stone),
    [BLOCKS.DIRT]:        uniformMat(TX.dirt),
    [BLOCKS.COBBLESTONE]: uniformMat(TX.cobble),
    [BLOCKS.BEDROCK]:     uniformMat(TX.bedrock),
    [BLOCKS.COAL_ORE]:    uniformMat(TX.coal),
    [BLOCKS.IRON_ORE]:    uniformMat(TX.iron),
    [BLOCKS.DIAMOND_ORE]: uniformMat(TX.diamond),
    [BLOCKS.BRICK]:       uniformMat(TX.brick),
    [BLOCKS.BRICKS]:      uniformMat(TX.bricks),
    [BLOCKS.PLANKS]:      uniformMat(TX.planks),
    [BLOCKS.SANDSTONE]:   uniformMat(TX.sandstone),
    [BLOCKS.GRAVEL]:      uniformMat(TX.gravel),
    [BLOCKS.PUMPKIN]:     uniformMat(TX.pumpkin),
    [BLOCKS.OBSIDIAN]:    [tintMat(TX.obsidian, 0x1a0a2a), tintMat(TX.obsidian, 0x1a0a2a),
                            tintMat(TX.obsidian, 0x1a0a2a), tintMat(TX.obsidian, 0x1a0a2a),
                            tintMat(TX.obsidian, 0x1a0a2a), tintMat(TX.obsidian, 0x1a0a2a)],
    // v10: Golden Days sand color (warm beach sand)
    [BLOCKS.SAND]:        [tintMat(TX.sand, 0xdbd3a0), tintMat(TX.sand, 0xdbd3a0),
                            tintMat(TX.sand, 0xdbd3a0), tintMat(TX.sand, 0xdbd3a0),
                            tintMat(TX.sand, 0xdbd3a0), tintMat(TX.sand, 0xdbd3a0)],
    [BLOCKS.SNOW]:        [tintMat(TX.snow, 0xf0f0f8), tintMat(TX.snow, 0xf0f0f8),
                            tintMat(TX.snow, 0xf0f0f8), tintMat(TX.snow, 0xf0f0f8),
                            tintMat(TX.snow, 0xf0f0f8), tintMat(TX.snow, 0xf0f0f8)],
    [BLOCKS.CACTUS]:      [tintMat(TX.cactus, 0x2a6a2a), tintMat(TX.cactus, 0x2a6a2a),
                            tintMat(TX.cactus, 0x4a8a4a), tintMat(TX.cactus, 0x4a8a4a),
                            tintMat(TX.cactus, 0x4a8a4a), tintMat(TX.cactus, 0x4a8a4a)],
    // v10: Golden Days water color (#3f76e4 - vibrant blue)
    [BLOCKS.WATER]:       [tintMat(TX.water, 0x3f76e4, { transparent: true, opacity: 0.80, depthWrite: true, side: THREE.DoubleSide }),
                            tintMat(TX.water, 0x3f76e4, { transparent: true, opacity: 0.80, depthWrite: true, side: THREE.DoubleSide }),
                            tintMat(TX.water, 0x3f76e4, { transparent: true, opacity: 0.80, depthWrite: true, side: THREE.DoubleSide }),
                            tintMat(TX.water, 0x3f76e4, { transparent: true, opacity: 0.80, depthWrite: true, side: THREE.DoubleSide }),
                            tintMat(TX.water, 0x3f76e4, { transparent: true, opacity: 0.80, depthWrite: true, side: THREE.DoubleSide }),
                            tintMat(TX.water, 0x3f76e4, { transparent: true, opacity: 0.80, depthWrite: true, side: THREE.DoubleSide })],
    [BLOCKS.GLASS]:       Array(6).fill(null).map(() => mat(TX.glass, { transparent: true, opacity: 0.4, depthWrite: true, side: THREE.DoubleSide })),
    // v10: Golden Days grass (#7cbd6c) and foliage (#5bab47) colors
    [BLOCKS.GRASS]:       [tintMat(TX.gtop,  0x7cbd6c), mat(TX.dirt), tintMat(TX.gside, 0x7cbd6c), tintMat(TX.gside, 0x7cbd6c), tintMat(TX.gside, 0x7cbd6c), tintMat(TX.gside, 0x7cbd6c)],
    [BLOCKS.WOOD]:        [mat(TX.ttop), mat(TX.ttop), mat(TX.tside), mat(TX.tside), mat(TX.tside), mat(TX.tside)],
    // v10: Leaves tinted with Golden Days foliage color (#5bab47)
    [BLOCKS.LEAVES]:      Array(6).fill(null).map(() => tintMat(TX.leaves, 0x5bab47, { alphaTest: 0.5, side: THREE.DoubleSide, transparent: false })),
    [BLOCKS.FLOWER_RED]:    Array(6).fill(null).map(() => tintMat(TX.flower_red,    0xff3030, { alphaTest: 0.5, side: THREE.DoubleSide, transparent: false })),
    [BLOCKS.FLOWER_YELLOW]: Array(6).fill(null).map(() => tintMat(TX.flower_yellow, 0xffdd30, { alphaTest: 0.5, side: THREE.DoubleSide, transparent: false })),
    [BLOCKS.MUSHROOM_RED]:  Array(6).fill(null).map(() => tintMat(TX.mushroom,      0xcc2222, { alphaTest: 0.5, side: THREE.DoubleSide, transparent: false })),
};

// ============================
// NOISE — now using real Perlin gradient noise (v10)
// Reference: https://fr.wikipedia.org/wiki/Bruit_de_Perlin
// ============================

// Simple hash for ore/decoration distribution (deterministic)
function hash(x, z){
    let s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

// Biome map: slow Perlin noise determines biome
function getBiome(x, z){
    // Use Perlin at large scale for smooth biome transitions
    const b = (perlin2(x * 0.008, z * 0.008) + 1) / 2;  // [0, 1]
    if(b < 0.30)      return 'desert';
    else if(b < 0.55) return 'plains';
    else if(b < 0.75) return 'forest';
    else if(b < 0.90) return 'mountain';
    else              return 'snow';
}

// Terrain height using fBm (fractal Brownian motion) of Perlin noise
// Mimics Minecraft Beta 1.8 terrain: gentle rolling hills, occasional mountains
function getH(x, z){
    const biome = getBiome(x, z);

    // Base sea level
    const SEA = 14;
    let h;

    if(biome === 'mountain'){
        // Mountains: ridged noise for sharp peaks
        const ridge = ridged2(x, z, 4, 0.5, 2.0, 0.008);
        const base = fbm2(x, z, 3, 0.5, 2.0, 0.02);
        h = SEA + 4 + ridge * 22 + base * 6;
    } else if(biome === 'desert'){
        // Desert: smooth, low
        const base = fbm2(x, z, 3, 0.5, 2.0, 0.015);
        h = SEA - 1 + base * 6;
    } else if(biome === 'snow'){
        // Snow: medium hills
        const base = fbm2(x, z, 4, 0.5, 2.0, 0.015);
        h = SEA + 2 + base * 12;
    } else if(biome === 'forest'){
        // Forest: rolling hills
        const base = fbm2(x, z, 4, 0.5, 2.0, 0.018);
        const detail = fbm2(x, z, 2, 0.4, 2.0, 0.08);
        h = SEA + 1 + base * 10 + detail * 2;
    } else {
        // Plains: gentle
        const base = fbm2(x, z, 4, 0.5, 2.0, 0.012);
        const detail = fbm2(x, z, 2, 0.4, 2.0, 0.06);
        h = SEA + base * 6 + detail * 2;
    }

    return { h: Math.floor(h), biome };
}

// ============================
// FACE TABLES — FIXED v9
// Vertices are now CCW when viewed from OUTSIDE the cube.
// This ensures Three.js back-face culling works correctly
// and computeVertexNormals() produces outward-facing normals.
//
// Face order: [+Y top, -Y bottom, +X right, -X left, +Z front, -Z back]
// ============================

// Direction vectors for each face (outward normal direction)
const FACE_DIR = [
    [ 0, 1, 0],  // 0: +Y top
    [ 0,-1, 0],  // 1: -Y bottom
    [ 1, 0, 0],  // 2: +X right
    [-1, 0, 0],  // 3: -X left
    [ 0, 0, 1],  // 4: +Z front (south)
    [ 0, 0,-1],  // 5: -Z back (north)
];

// Vertex positions for each face (4 vertices, CCW from outside)
// Each vertex is [x, y, z] in unit cube space (0..1)
// VERIFIED v9: cross product of (v1-v0) x (v2-v0) gives the outward normal
const FACE_VTX = [
    // +Y top: viewed from above (+Y looking down -Y), CCW order
    // Vertices: (0,1,0) -> (0,1,1) -> (1,1,1) -> (1,1,0)
    [[0,1,0], [0,1,1], [1,1,1], [1,1,0]],
    // -Y bottom: viewed from below (-Y looking up +Y), CCW order
    // Vertices: (0,0,0) -> (1,0,0) -> (1,0,1) -> (0,0,1)
    [[0,0,0], [1,0,0], [1,0,1], [0,0,1]],
    // +X right: viewed from +X looking -X, CCW order
    // Vertices: (1,0,0) -> (1,1,0) -> (1,1,1) -> (1,0,1)
    [[1,0,0], [1,1,0], [1,1,1], [1,0,1]],
    // -X left: viewed from -X looking +X, CCW order
    // Vertices: (0,0,1) -> (0,1,1) -> (0,1,0) -> (0,0,0)
    [[0,0,1], [0,1,1], [0,1,0], [0,0,0]],
    // +Z front: viewed from +Z looking -Z, CCW order
    // Vertices: (0,0,1) -> (1,0,1) -> (1,1,1) -> (0,1,1)
    [[0,0,1], [1,0,1], [1,1,1], [0,1,1]],
    // -Z back: viewed from -Z looking +Z, CCW order
    // Vertices: (1,0,0) -> (0,0,0) -> (0,1,0) -> (1,1,0)
    [[1,0,0], [0,0,0], [0,1,0], [1,1,0]],
];

// UV mapping for each face: [v0, v1, v2, v3] each [u, v]
// Maps the 4 vertices to texture corners
const FACE_UV = [
    [[0,0], [0,1], [1,1], [1,0]],  // +Y top
    [[0,0], [1,0], [1,1], [0,1]],  // -Y bottom
    [[0,0], [0,1], [1,1], [1,0]],  // +X right
    [[0,0], [0,1], [1,1], [1,0]],  // -X left
    [[0,0], [1,0], [1,1], [0,1]],  // +Z front
    [[0,0], [1,0], [1,1], [0,1]],  // -Z back
];

// Index pattern: two triangles per quad
const FACE_IDX = [0, 1, 2,  0, 2, 3];

// ============================
// WORLD CLASS
// ============================
export class World {
    constructor(scene){
        this.scene     = scene;
        this.chunks    = new Map();
        this.rayMeshes = [];
        this.renderDistance = 4;
        this.mods = new Map();
        this._loadMods();
    }

    chunkKey(cx, cz){ return `${cx},${cz}`; }
    getHeight(x, z){ return getH(x, z).h; }
    getBiome(x, z){ return getH(x, z).biome; }

    getBlock(x, y, z){
        if(y < 0 || y >= CHUNK_HEIGHT) return 0;
        const cx = Math.floor(x/CHUNK_SIZE), cz = Math.floor(z/CHUNK_SIZE);
        const ch = this.chunks.get(this.chunkKey(cx, cz));
        if(!ch) return -1;
        const bx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const bz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return ch.data[bx + bz*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE];
    }

    setBlock(x, y, z, type){
        if(y < 0 || y >= CHUNK_HEIGHT) return;
        const cx = Math.floor(x/CHUNK_SIZE), cz = Math.floor(z/CHUNK_SIZE);
        const ch = this.chunks.get(this.chunkKey(cx, cz));
        if(!ch) return;
        const bx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const bz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        ch.data[bx + bz*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE] = type;
        this.mods.set(`${x},${y},${z}`, type);
        this._rebuild(cx, cz);
        if(bx === 0)              this._rebuild(cx-1, cz);
        if(bx === CHUNK_SIZE-1)   this._rebuild(cx+1, cz);
        if(bz === 0)              this._rebuild(cx, cz-1);
        if(bz === CHUNK_SIZE-1)   this._rebuild(cx, cz+1);
        this._scheduleSave();
    }

    _loadMods(){
        try {
            const raw = localStorage.getItem('craftweb_mods_v2');
            if(!raw) return;
            const arr = JSON.parse(raw);
            if(Array.isArray(arr))
                for(const [k,v] of arr) this.mods.set(k, v);
        } catch(e){ console.warn('load mods failed', e); }
    }
    _scheduleSave(){
        if(this._saveTimer) return;
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._saveNow();
        }, 1500);
    }
    _saveNow(){
        try {
            const arr = [...this.mods.entries()];
            localStorage.setItem('craftweb_mods_v2', JSON.stringify(arr));
        } catch(e){ console.warn('save mods failed', e); }
    }
    clearSave(){
        try { localStorage.removeItem('craftweb_mods_v2'); } catch(e){}
        this.mods.clear();
    }

    // ============================
    // CHUNK GENERATION
    // ============================
    _gen(cx, cz){
        const key = this.chunkKey(cx, cz);
        if(this.chunks.has(key)) return;
        const data = new Uint8Array(CHUNK_SIZE*CHUNK_SIZE*CHUNK_HEIGHT);

        for(let lx=0; lx<CHUNK_SIZE; lx++){
            for(let lz=0; lz<CHUNK_SIZE; lz++){
                const ax = cx*CHUNK_SIZE+lx, az = cz*CHUNK_SIZE+lz;
                const { h: gh, biome } = getH(ax, az);

                for(let y=0; y<CHUNK_HEIGHT; y++){
                    const i = lx + lz*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE;

                    if(y === 0){
                        data[i] = BLOCKS.BEDROCK;
                        continue;
                    }

                    // v9: NO CAVES — caves caused dark holes that looked like missing textures

                    if(y < gh-4){
                        data[i] = BLOCKS.STONE;
                    } else if(y < gh-1){
                        if(biome === 'desert' && y >= gh-3) data[i] = BLOCKS.SAND;
                        else if(biome === 'desert')         data[i] = BLOCKS.SANDSTONE;
                        else data[i] = BLOCKS.DIRT;
                    } else if(y === gh-1){
                        if(biome === 'desert')      data[i] = BLOCKS.SAND;
                        else if(biome === 'mountain' && gh > 30) data[i] = BLOCKS.STONE;
                        else data[i] = BLOCKS.DIRT;
                    } else if(y === gh){
                        // v10: Beaches — sand near water level (Beta 1.8 style)
                        if(biome === 'desert')      data[i] = BLOCKS.SAND;
                        else if(biome === 'snow')   data[i] = BLOCKS.SNOW;
                        else if(biome === 'mountain' && gh > 30) data[i] = BLOCKS.STONE;
                        // Beach: 3-block sand belt around water
                        else if(gh <= SEA_LEVEL + 2) data[i] = BLOCKS.SAND;
                        else                        data[i] = BLOCKS.GRASS;
                    } else if(y <= SEA_LEVEL && y > gh){
                        data[i] = BLOCKS.WATER;
                    }
                }

                // Ores
                for(let y=1; y < gh-4; y++){
                    const r = hash(ax*3+y*7, az*7+y*13);
                    const i = lx + lz*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE;
                    if(data[i] !== BLOCKS.STONE) continue;
                    if     (r < 0.012)                    data[i] = BLOCKS.COAL_ORE;
                    else if(r < 0.017)                    data[i] = BLOCKS.IRON_ORE;
                    else if(r < 0.019 && y < 16)          data[i] = BLOCKS.DIAMOND_ORE;
                    if(r > 0.97 && y < gh-6) data[i] = BLOCKS.GRAVEL;
                }

                // Vegetation
                if(gh < CHUNK_HEIGHT-8 && gh >= SEA_LEVEL){
                    const surf = data[lx + lz*CHUNK_SIZE + gh*CHUNK_SIZE*CHUNK_SIZE];
                    if(surf === BLOCKS.GRASS){
                        const treeChance = (biome === 'forest') ? 0.06 : 0.015;
                        if(hash(ax*17+3, az*31+7) < treeChance){
                            this._placeTree(data, lx, lz, gh, lx, lz);
                        } else {
                            const r = hash(ax*23+5, az*13+9);
                            if(r < 0.005){
                                const iy = gh+1;
                                if(iy < CHUNK_HEIGHT) data[lx+lz*CHUNK_SIZE+iy*CHUNK_SIZE*CHUNK_SIZE] = BLOCKS.FLOWER_RED;
                            } else if(r < 0.010){
                                const iy = gh+1;
                                if(iy < CHUNK_HEIGHT) data[lx+lz*CHUNK_SIZE+iy*CHUNK_SIZE*CHUNK_SIZE] = BLOCKS.FLOWER_YELLOW;
                            } else if(r < 0.012){
                                const iy = gh+1;
                                if(iy < CHUNK_HEIGHT) data[lx+lz*CHUNK_SIZE+iy*CHUNK_SIZE*CHUNK_SIZE] = BLOCKS.MUSHROOM_RED;
                            }
                        }
                    } else if(surf === BLOCKS.SAND && biome === 'desert'){
                        if(hash(ax*41+1, az*29+3) < 0.02){
                            const ch = 1 + Math.floor(hash(ax, az)*3);
                            for(let c=1; c<=ch; c++){
                                const iy = gh+c;
                                if(iy < CHUNK_HEIGHT) data[lx+lz*CHUNK_SIZE+iy*CHUNK_SIZE*CHUNK_SIZE] = BLOCKS.CACTUS;
                            }
                        }
                    }
                }
            }
        }

        // Apply player modifications
        const x0 = cx*CHUNK_SIZE, z0 = cz*CHUNK_SIZE;
        const x1 = x0 + CHUNK_SIZE - 1, z1 = z0 + CHUNK_SIZE - 1;
        for(const [k, type] of this.mods){
            const parts = k.split(',');
            const mx = +parts[0], my = +parts[1], mz = +parts[2];
            if(mx < x0 || mx > x1 || mz < z0 || mz > z1) continue;
            if(my < 0 || my >= CHUNK_HEIGHT) continue;
            const lx = mx - x0, lz = mz - z0;
            data[lx + lz*CHUNK_SIZE + my*CHUNK_SIZE*CHUNK_SIZE] = type;
        }

        this.chunks.set(key, { data, meshes: [], cx, cz });
    }

    _placeTree(data, lx, lz, gh, clx, clz){
        const trunkH = 4 + Math.floor(hash(clx*7+clz*13, clx+clz) * 3);
        for(let ty=1; ty<=trunkH; ty++){
            const iy = gh+ty;
            if(iy < CHUNK_HEIGHT) data[lx+lz*CHUNK_SIZE+iy*CHUNK_SIZE*CHUNK_SIZE] = BLOCKS.WOOD;
        }
        for(let dx=-2; dx<=2; dx++){
            for(let dz=-2; dz<=2; dz++){
                for(let dy=trunkH-2; dy<=trunkH+1; dy++){
                    const dist = Math.abs(dx)+Math.abs(dz)+Math.abs(dy-trunkH);
                    if(dist > 3) continue;
                    if(dx === 0 && dz === 0 && dy < trunkH) continue;
                    const fx = lx+dx, fz_ = lz+dz, fy = gh+dy;
                    if(fx>=0 && fx<CHUNK_SIZE && fz_>=0 && fz_<CHUNK_SIZE && fy<CHUNK_HEIGHT){
                        const fi = fx + fz_*CHUNK_SIZE + fy*CHUNK_SIZE*CHUNK_SIZE;
                        if(!data[fi]) data[fi] = BLOCKS.LEAVES;
                    }
                }
            }
        }
    }

    // ============================
    // MESHING — v9 CLEAN IMPLEMENTATION
    // ============================
    _rebuild(cx, cz){
        const key = this.chunkKey(cx, cz);
        const ch = this.chunks.get(key);
        if(!ch) return;

        // Dispose old meshes
        for(const m of ch.meshes){ this.scene.remove(m); m.geometry.dispose(); }
        ch.meshes = [];
        this.rayMeshes = this.rayMeshes.filter(m => m.userData.cx!==cx || m.userData.cz!==cz);

        const x0 = cx*CHUNK_SIZE, z0 = cz*CHUNK_SIZE;
        // Group vertices by (blockType, faceIndex) for efficient meshing
        const bufs = new Map();

        for(let lx=0; lx<CHUNK_SIZE; lx++){
            for(let lz=0; lz<CHUNK_SIZE; lz++){
                for(let y=0; y<CHUNK_HEIGHT; y++){
                    const bt = ch.data[lx + lz*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE];
                    if(!bt) continue;            // AIR
                    if(bt === BLOCKS.WATER) continue;  // water handled separately
                    if(!M[bt]) continue;          // unknown block
                    const ax = x0+lx, az = z0+lz;
                    const meta = BLOCK_META[bt] || { transparent: false };

                    for(let f=0; f<6; f++){
                        const d = FACE_DIR[f];
                        const nb = this.getBlock(ax+d[0], y+d[1], az+d[2]);
                        // Face culling rules (v9 clean):
                        //   - AIR (0) → show face
                        //   - unloaded (-1) → show face (solid wall until neighbor loads)
                        //   - same block type → hide (no inner faces)
                        //   - transparent neighbor (different type) → show
                        //   - opaque neighbor → hide
                        let show = false;
                        if(nb === 0) show = true;
                        else if(nb === -1) show = true;
                        else if(nb === bt) show = false;
                        else {
                            const nbMeta = BLOCK_META[nb] || { transparent: false };
                            show = nbMeta.transparent;
                        }
                        if(!show) continue;

                        const k = bt*6 + f;
                        if(!bufs.has(k)) bufs.set(k, { pos:[], uv:[], idx:[], n:0, bt, f });
                        const b = bufs.get(k);
                        const vs = FACE_VTX[f];
                        const uvs = FACE_UV[f];
                        const base = b.n;

                        for(let v=0; v<4; v++){
                            b.pos.push(ax + vs[v][0], y + vs[v][1], az + vs[v][2]);
                            b.uv.push(uvs[v][0], uvs[v][1]);
                        }
                        // Two triangles: (0,1,2) and (0,2,3)
                        b.idx.push(base+0, base+1, base+2, base+0, base+2, base+3);
                        b.n += 4;
                    }
                }
            }
        }

        // Build meshes — use computeVertexNormals() for correct lighting
        for(const [, b] of bufs){
            if(!b.pos.length) continue;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
            geo.setAttribute('uv',       new THREE.Float32BufferAttribute(b.uv, 2));
            geo.setIndex(b.idx);
            // v9: compute normals from vertices — guarantees correct outward normals
            geo.computeVertexNormals();

            const mat = M[b.bt]?.[b.f] ?? M[BLOCKS.STONE][0];
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = { cx, cz, bt: b.bt };
            this.scene.add(mesh);
            ch.meshes.push(mesh);
            this.rayMeshes.push(mesh);
        }

        // Build water mesh
        this._buildWaterMesh(cx, cz, ch);
    }

    _buildWaterMesh(cx, cz, ch){
        const x0 = cx*CHUNK_SIZE, z0 = cz*CHUNK_SIZE;
        const pos = [], uv = [], idx = [];
        let n = 0;
        for(let lx=0; lx<CHUNK_SIZE; lx++){
            for(let lz=0; lz<CHUNK_SIZE; lz++){
                for(let y=0; y<CHUNK_HEIGHT; y++){
                    const bt = ch.data[lx + lz*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE];
                    if(bt !== BLOCKS.WATER) continue;
                    const ax = x0+lx, az = z0+lz;
                    for(let f=0; f<6; f++){
                        const d = FACE_DIR[f];
                        const nb = this.getBlock(ax+d[0], y+d[1], az+d[2]);
                        if(nb === BLOCKS.WATER) continue;
                        if(nb === -1) {
                            // show face for unloaded neighbors
                        } else if(nb !== 0 && !BLOCK_META[nb]?.transparent) continue;
                        const vs = FACE_VTX[f], uvs = FACE_UV[f], base = n;
                        for(let v=0; v<4; v++){
                            const yOff = (f === 0) ? -0.1 : 0;
                            pos.push(ax+vs[v][0], y+vs[v][1]+yOff, az+vs[v][2]);
                            uv.push(uvs[v][0], uvs[v][1]);
                        }
                        idx.push(base+0, base+1, base+2, base+0, base+2, base+3);
                        n += 4;
                    }
                }
            }
        }
        if(!pos.length) return;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        const waterMat = M[BLOCKS.WATER][0];
        const mesh = new THREE.Mesh(geo, waterMat);
        mesh.userData = { cx, cz, bt: BLOCKS.WATER, water: true };
        this.scene.add(mesh);
        ch.meshes.push(mesh);
    }

    // ============================
    // CHUNK STREAMING
    // ============================
    update(pos){
        const pcx = Math.floor(pos.x/CHUNK_SIZE);
        const pcz = Math.floor(pos.z/CHUNK_SIZE);
        const rd = this.renderDistance;
        let built = 0;

        for(let r=0; r<=rd && built<3; r++){
            for(let dx=-r; dx<=r && built<3; dx++){
                for(let dz=-r; dz<=r && built<3; dz++){
                    if(Math.abs(dx)!==r && Math.abs(dz)!==r) continue;
                    const cx = pcx+dx, cz = pcz+dz;
                    if(!this.chunks.has(this.chunkKey(cx, cz))){
                        this._gen(cx, cz);
                        this._rebuild(cx, cz);
                        this._rebuild(cx-1, cz);
                        this._rebuild(cx+1, cz);
                        this._rebuild(cx, cz-1);
                        this._rebuild(cx, cz+1);
                        built++;
                    }
                }
            }
        }

        const ul = rd + 2;
        for(const [k, ch] of this.chunks){
            if(Math.abs(ch.cx-pcx) > ul || Math.abs(ch.cz-pcz) > ul){
                for(const m of ch.meshes){ this.scene.remove(m); m.geometry.dispose(); }
                this.rayMeshes = this.rayMeshes.filter(m => m.userData.cx!==ch.cx || m.userData.cz!==ch.cz);
                this.chunks.delete(k);
            }
        }
    }

    getRayMeshes(){ return this.rayMeshes; }

    disposeAll(){
        for(const [, ch] of this.chunks){
            for(const m of ch.meshes){ this.scene.remove(m); m.geometry.dispose(); }
        }
        this.chunks.clear();
        this.rayMeshes = [];
    }
}

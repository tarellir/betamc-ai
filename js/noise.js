/* ============================================
   CraftWeb — Perlin Noise Module
   Real gradient Perlin noise (improved version by Ken Perlin)
   + Fractal Brownian Motion (fBm) for natural terrain
   Reference: https://fr.wikipedia.org/wiki/Bruit_de_Perlin
   ============================================ */

// Permutation table (Ken Perlin's original)
const perm = new Uint8Array(512);
const basePerm = new Uint8Array([
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
    8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
    35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
    134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
    55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
    18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
    250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
    189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
    172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
    228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
    107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
    138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
]);
for(let i = 0; i < 256; i++) perm[i] = basePerm[i];
for(let i = 0; i < 256; i++) perm[i + 256] = basePerm[i];

// Fade function: 6t^5 - 15t^4 + 10t^3
function fade(t){
    return t * t * t * (t * (t * 6 - 15) + 10);
}

// Linear interpolation
function lerp(a, b, t){
    return a + t * (b - a);
}

// Gradient function — maps hash to gradient vector dot product
function grad(hash, x, y, z){
    // Use the lower 4 bits of the hash to pick a gradient direction
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * 3D Perlin noise — returns value in range [-1, 1]
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number} noise value in [-1, 1]
 */
export function perlin3(x, y, z){
    // Find unit cube containing the point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    // Relative position inside the cube
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    // Fade curves
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);

    // Hash coordinates of the 8 cube corners
    const A  = perm[X    ] + Y;
    const AA = perm[A    ] + Z;
    const AB = perm[A + 1] + Z;
    const B  = perm[X + 1] + Y;
    const BA = perm[B    ] + Z;
    const BB = perm[B + 1] + Z;

    // Interpolate along X
    const x1 = lerp(grad(perm[AA    ], x    , y    , z    ),
                    grad(perm[BA    ], x - 1, y    , z    ), u);
    const x2 = lerp(grad(perm[AB    ], x    , y - 1, z    ),
                    grad(perm[BB    ], x - 1, y - 1, z    ), u);
    const x3 = lerp(grad(perm[AA + 1], x    , y    , z - 1),
                    grad(perm[BA + 1], x - 1, y    , z - 1), u);
    const x4 = lerp(grad(perm[AB + 1], x    , y - 1, z - 1),
                    grad(perm[BB + 1], x - 1, y - 1, z - 1), u);

    // Interpolate along Y
    const y1 = lerp(x1, x2, v);
    const y2 = lerp(x3, x4, v);

    // Interpolate along Z
    return lerp(y1, y2, w);  // range [-1, 1]
}

/**
 * 2D Perlin noise — returns value in range [-1, 1]
 * Uses perlin3 with z=0
 */
export function perlin2(x, y){
    return perlin3(x, y, 0);
}

/**
 * Fractal Brownian Motion (fBm) — sums multiple octaves of Perlin noise
 * for natural-looking terrain with detail at multiple scales.
 * @param {number} x
 * @param {number} y
 * @param {number} octaves    - number of noise layers (4-6 typical)
 * @param {number} persistence - amplitude decay per octave (0.5 typical)
 * @param {number} lacunarity  - frequency growth per octave (2.0 typical)
 * @param {number} scale       - base frequency (lower = smoother)
 * @returns {number} value in [-1, 1] (approximately)
 */
export function fbm2(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0, scale = 0.01){
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;  // for normalization

    for(let i = 0; i < octaves; i++){
        total += perlin2(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue;  // normalize to [-1, 1]
}

/**
 * Ridged multifractal noise — creates sharp ridges (good for mountains)
 */
export function ridged2(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0, scale = 0.01){
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;

    for(let i = 0; i < octaves; i++){
        const n = 1 - Math.abs(perlin2(x * frequency, y * frequency));
        total += n * n * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return (total / maxValue) * 2 - 1;  // normalize to [-1, 1]
}

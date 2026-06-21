/* ============================================
   CraftWeb — UI Module
   HUD, hotbar, hearts, food, inventory, chat
   ============================================ */

import { BLOCKS, BLOCK_META, HOTBAR_BLOCKS } from "./world.js?v10";

// Hotbar - first 9 of HOTBAR_BLOCKS for visible hotbar
const HOTBAR_COUNT = 9;
window.HOTBAR_COUNT = HOTBAR_COUNT;

const NAMES = ['Pierre','Herbe','Terre','Cobble','Bois','Planches','Feuilles','Sable','Grès',
               'Verre','Brique','Briques','Charbon','Fer','Diamant','Gravier','Citrouille',
               'Cactus','Obsidienne','Neige','Bedrock','Eau'];

// Map block ID -> hotbar icon image filename (reuse existing items folder + add fallbacks)
const ICON_FILES = {
    [BLOCKS.STONE]:         'stone',
    [BLOCKS.GRASS]:         'grass',
    [BLOCKS.DIRT]:          'dirt',
    [BLOCKS.COBBLESTONE]:   'cobblestone',
    [BLOCKS.WOOD]:          'wood',
    [BLOCKS.PLANKS]:        'wood',         // reuse wood icon
    [BLOCKS.LEAVES]:        'leaves',
    [BLOCKS.SAND]:          'dirt',         // tinted at draw time
    [BLOCKS.SANDSTONE]:     'cobblestone',  // tinted
    [BLOCKS.GLASS]:         'leaves',       // tinted
    [BLOCKS.BRICK]:         'brick',
    [BLOCKS.BRICKS]:        'brick',
    [BLOCKS.COAL_ORE]:      'coal_ore',
    [BLOCKS.IRON_ORE]:      'iron_ore',
    [BLOCKS.DIAMOND_ORE]:   'diamond_ore',
    [BLOCKS.GRAVEL]:        'cobblestone',  // tinted
    [BLOCKS.PUMPKIN]:       'brick',        // tinted
    [BLOCKS.CACTUS]:        'grass',        // tinted
    [BLOCKS.OBSIDIAN]:      'stone',        // tinted
    [BLOCKS.SNOW]:          'dirt',         // tinted white
    [BLOCKS.BEDROCK]:       'bedrock',
    [BLOCKS.WATER]:         'dirt',         // tinted blue
};

const TINT_COLORS = {
    [BLOCKS.SAND]:      '#e8d8a0',
    [BLOCKS.SANDSTONE]: '#d8c890',
    [BLOCKS.GLASS]:     '#aaccdd',
    [BLOCKS.GRAVEL]:    '#808080',
    [BLOCKS.PUMPKIN]:   '#dd8822',
    [BLOCKS.CACTUS]:    '#4a8a4a',
    [BLOCKS.OBSIDIAN]:  '#1a0a2a',
    [BLOCKS.SNOW]:      '#f0f0f8',
    [BLOCKS.WATER]:     '#2a4acc',
    [BLOCKS.PLANKS]:    null,
};

function getIconPath(blockId){
    const f = ICON_FILES[blockId];
    return f ? `assets/textures/items/${f}.png` : 'assets/textures/items/stone.png';
}

export function setupUI(player){
    const hotbarEl = document.getElementById('hotbar');
    const labelEl  = document.getElementById('block-label');
    const heartsEl = document.getElementById('hud-hearts');
    const foodEl   = document.getElementById('hud-food');
    const invGrid  = document.getElementById('inventory-grid');
    const invScreen= document.getElementById('inventory-screen');

    function img(s){ const i = new Image(); i.src = s; return i; }
    const HF = img('assets/textures/hud/heart_full.png');
    const HE = img('assets/textures/hud/heart_empty.png');
    const FF = img('assets/textures/hud/food_full.png');
    const FE = img('assets/textures/hud/food_empty.png');

    // Preload hotbar block icons
    const hotbarBlockIds = HOTBAR_BLOCKS.slice(0, HOTBAR_COUNT);
    const blockImgs = {};
    for(const id of hotbarBlockIds){
        blockImgs[id] = img(getIconPath(id));
    }

    // Build hotbar slots
    const slots = [];
    for(let i=0; i<HOTBAR_COUNT; i++){
        const div = document.createElement('div');
        div.className = 'slot' + (i===0 ? ' selected' : '');
        const cv = document.createElement('canvas');
        cv.width = cv.height = 36;
        const num = document.createElement('span');
        num.className = 'slot-num';
        num.textContent = i+1;
        div.append(cv, num);
        const blockId = hotbarBlockIds[i];
        div.onclick = () => select(i);
        div.title = NAMES[blockId - 1] || `Block ${blockId}`;
        hotbarEl.appendChild(div);
        slots.push({ div, cv, ctx: cv.getContext('2d'), blockId });
    }

    let cur = 0;
    function select(i){
        if(i<0 || i>=HOTBAR_COUNT) return;
        slots[cur].div.classList.remove('selected');
        cur = i;
        slots[cur].div.classList.add('selected');
        player.selectedBlock = i+1;
        const bid = slots[i].blockId;
        labelEl.textContent = NAMES[bid - 1] || `Block ${bid}`;
        labelEl.style.opacity = '1';
        clearTimeout(labelEl._t);
        labelEl._t = setTimeout(() => labelEl.style.opacity = '0', 1800);
    }

    // Number keys 1-9
    document.addEventListener('keydown', e => {
        const n = parseInt(e.key);
        if(n>=1 && n<=9) select(n-1);
    });
    document.addEventListener('uiSelectSlot', e => { select(e.detail); });

    function mkCv(w,h){ const c = document.createElement('canvas'); c.width=w; c.height=h; return c; }

    function drawSlotIcon(ctx, blockId){
        const im = blockImgs[blockId];
        if(!im || !im.complete || im.naturalWidth === 0) return false;
        ctx.clearRect(0, 0, 36, 36);
        ctx.imageSmoothingEnabled = false;
        const tint = TINT_COLORS[blockId];
        if(tint){
            // Draw image then overlay tint with multiply
            ctx.drawImage(im, 0, 0, 36, 36);
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = tint;
            ctx.fillRect(0, 0, 36, 36);
            ctx.globalCompositeOperation = 'source-over';
        } else {
            ctx.drawImage(im, 0, 0, 36, 36);
        }
        return true;
    }

    function drawSlots(){
        for(let i=0; i<HOTBAR_COUNT; i++){
            drawSlotIcon(slots[i].ctx, slots[i].blockId);
        }
    }

    function drawHearts(hp, max){
        heartsEl.innerHTML = '';
        for(let i=0; i<max/2; i++){
            const cv = mkCv(20, 20);
            const c = cv.getContext('2d');
            c.imageSmoothingEnabled = false;
            c.drawImage(HE, 0, 0, 20, 20);
            const f = hp - i*2;
            if(f >= 2) c.drawImage(HF, 0, 0, 20, 20);
            else if(f === 1){
                c.save(); c.beginPath(); c.rect(0, 0, 10, 20); c.clip();
                c.drawImage(HF, 0, 0, 20, 20); c.restore();
            }
            heartsEl.appendChild(cv);
        }
    }

    function drawFood(fp, max){
        foodEl.innerHTML = '';
        for(let i=max/2-1; i>=0; i--){
            const cv = mkCv(20, 20);
            const c = cv.getContext('2d');
            c.imageSmoothingEnabled = false;
            c.drawImage(FE, 0, 0, 20, 20);
            const f = fp - i*2;
            if(f >= 2) c.drawImage(FF, 0, 0, 20, 20);
            else if(f === 1){
                c.save(); c.beginPath(); c.rect(0, 0, 10, 20); c.clip();
                c.drawImage(FF, 0, 0, 20, 20); c.restore();
            }
            foodEl.insertBefore(cv, foodEl.firstChild);
        }
    }

    function trySlots(n=0){
        drawSlots();
        const done = hotbarBlockIds.every(id => {
            const im = blockImgs[id];
            return im && im.complete && im.naturalWidth > 0;
        });
        if(!done && n<30) setTimeout(() => trySlots(n+1), 150);
    }
    setTimeout(() => {
        trySlots();
        drawHearts(20, 20);
        drawFood(20, 20);
        select(0);
    }, 200);

    // ============================
    // INVENTORY (E key)
    // ============================
    function buildInventory(){
        invGrid.innerHTML = '';
        for(const blockId of HOTBAR_BLOCKS){
            const div = document.createElement('div');
            div.className = 'inv-slot';
            const cv = document.createElement('canvas');
            cv.width = cv.height = 36;
            const ctx = cv.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            const im = new Image();
            im.src = getIconPath(blockId);
            im.onload = () => {
                const tint = TINT_COLORS[blockId];
                ctx.drawImage(im, 0, 0, 36, 36);
                if(tint){
                    ctx.globalCompositeOperation = 'multiply';
                    ctx.fillStyle = tint;
                    ctx.fillRect(0, 0, 36, 36);
                    ctx.globalCompositeOperation = 'source-over';
                }
            };
            const label = document.createElement('div');
            label.className = 'inv-name';
            label.textContent = NAMES[blockId - 1] || `#${blockId}`;
            div.append(cv, label);
            div.onclick = () => {
                // Find this block in hotbar; if not, replace current slot
                let hotIdx = hotbarBlockIds.indexOf(blockId);
                if(hotIdx >= 0){
                    select(hotIdx);
                } else {
                    // Replace current slot with this block
                    slots[cur].blockId = blockId;
                    hotbarBlockIds[cur] = blockId;
                    drawSlots();
                    select(cur);
                }
                closeInventory();
            };
            invGrid.appendChild(div);
        }
    }

    function openInventory(){
        buildInventory();
        invScreen.classList.remove('hidden');
        player.unlock();
    }
    function closeInventory(){
        invScreen.classList.add('hidden');
        if(window.gameStarted && !window.paused && !player._dead) player.lock();
    }
    invScreen.addEventListener('click', e => {
        if(e.target === invScreen) closeInventory();
    });

    window.toggleInventory = () => {
        if(invScreen.classList.contains('hidden')) openInventory();
        else closeInventory();
    };

    window.getSelectedBlockId = () => {
        return slots[cur].blockId;
    };

    // ============================
    // CHAT (T key)
    // ============================
    const chatBox = document.getElementById('chat-box');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');

    function addChatLine(text, type='normal'){
        const line = document.createElement('div');
        line.className = `chat-line ${type}`;
        const time = new Date();
        const ts = `${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;
        line.textContent = `[${ts}] ${text}`;
        chatMessages.appendChild(line);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        // Keep last 50 lines
        while(chatMessages.children.length > 50) chatMessages.removeChild(chatMessages.firstChild);
    }
    window.chatLog = addChatLine;

    function openChat(){
        chatBox.classList.remove('hidden');
        chatInput.value = '';
        setTimeout(() => chatInput.focus(), 50);
        player.unlock();
    }
    function closeChat(){
        chatBox.classList.add('hidden');
        if(window.gameStarted && !window.paused && !player._dead) player.lock();
    }
    window.openChat = openChat;

    chatInput.addEventListener('keydown', e => {
        e.stopPropagation();
        if(e.key === 'Enter'){
            const text = chatInput.value.trim();
            if(text){
                if(text.startsWith('/')){
                    handleCommand(text);
                } else {
                    addChatLine(`<Joueur> ${text}`, 'player');
                }
            }
            closeChat();
        } else if(e.key === 'Escape'){
            closeChat();
        }
    });

    function handleCommand(cmd){
        const parts = cmd.slice(1).toLowerCase().split(/\s+/);
        const c = parts[0];
        if(c === 'help'){
            addChatLine('Commandes disponibles:', 'system');
            addChatLine('  /help - Affiche cette aide', 'system');
            addChatLine('  /time day|night|noon - Change l\'heure', 'system');
            addChatLine('  /tp <x> <y> <z> - Téléporte', 'system');
            addChatLine('  /heal - Restaure la vie', 'system');
            addChatLine('  /feed - Restaure la faim', 'system');
            addChatLine('  /gamemode survival|creative', 'system');
            addChatLine('  /spawn - Retour au spawn', 'system');
        } else if(c === 'time'){
            if(parts[1] === 'day')   window.setTimeOfDay?.(0.0);
            else if(parts[1] === 'noon')   window.setTimeOfDay?.(0.25);
            else if(parts[1] === 'night') window.setTimeOfDay?.(0.75);
            else addChatLine('Usage: /time day|night|noon', 'system');
            addChatLine(`Heure réglée: ${parts[1]}`, 'system');
        } else if(c === 'tp'){
            const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
            if(!isNaN(x) && !isNaN(y) && !isNaN(z)){
                player.camera.position.set(x, y, z);
                addChatLine(`Téléporté à ${x}, ${y}, ${z}`, 'system');
            } else {
                addChatLine('Usage: /tp <x> <y> <z>', 'system');
            }
        } else if(c === 'heal'){
            player.hp = player.maxHp;
            addChatLine('Vie restaurée', 'system');
        } else if(c === 'feed'){
            player.food = player.maxFood;
            addChatLine('Faim restaurée', 'system');
        } else if(c === 'gamemode'){
            if(parts[1] === 'survival' || parts[1] === 'creative'){
                player.gameMode = parts[1];
                const modeEl = document.getElementById('mode-label');
                if(modeEl) modeEl.textContent = `Mode: ${parts[1]}`;
                addChatLine(`Mode de jeu: ${parts[1]}`, 'system');
            } else {
                addChatLine('Usage: /gamemode survival|creative', 'system');
            }
        } else if(c === 'spawn'){
            player.spawn();
            addChatLine('Téléporté au spawn', 'system');
        } else {
            addChatLine(`Commande inconnue: /${c}. Tapez /help`, 'system');
        }
    }

    // Initial chat messages
    setTimeout(() => {
        addChatLine('Bienvenue dans CraftWeb Beta 1.8!', 'system');
        addChatLine('Tapez /help pour la liste des commandes', 'system');
    }, 1000);

    // ============================
    // HUD UPDATE (called from main.js)
    // ============================
    window.updateHUD = (hp, mhp, fp, mfp) => {
        drawHearts(hp, mhp);
        drawFood(fp, mfp);
    };
}

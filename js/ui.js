const NAMES=['','Pierre','Herbe','Terre','Cobble','Bois','Feuilles','Bedrock','Charbon','Fer','Diamant','Brique'];
const ICONS=['','stone','grass','dirt','cobblestone','wood','leaves','bedrock','coal_ore','iron_ore','diamond_ore','brick'];

export function setupUI(player){
    const hotbarEl  =document.getElementById('hotbar');
    const labelEl   =document.getElementById('block-label');
    const heartsEl  =document.getElementById('hud-hearts');
    const foodEl    =document.getElementById('hud-food');

    function img(s){ const i=new Image(); i.src=s; return i; }
    const HF=img('assets/textures/hud/heart_full.png');
    const HE=img('assets/textures/hud/heart_empty.png');
    const FF=img('assets/textures/hud/food_full.png');
    const FE=img('assets/textures/hud/food_empty.png');
    const blockImgs=ICONS.map(n=>n?img(`assets/textures/items/${n}.png`):null);

    // Slots
    const slots=[];
    for(let i=0;i<9;i++){
        const div=document.createElement('div'); div.className='slot'+(i===0?' selected':'');
        const cv=document.createElement('canvas'); cv.width=cv.height=36;
        const num=document.createElement('span'); num.className='slot-num'; num.textContent=i+1;
        div.append(cv,num);
        div.onclick=()=>select(i);
        hotbarEl.appendChild(div);
        slots.push({div,cv,ctx:cv.getContext('2d')});
    }

    let cur=0;
    function select(i){
        slots[cur].div.classList.remove('selected');
        cur=i; slots[cur].div.classList.add('selected');
        player.selectedBlock=i+1;
        labelEl.textContent=NAMES[i+1]||'';
        labelEl.style.opacity='1';
        clearTimeout(labelEl._t);
        labelEl._t=setTimeout(()=>labelEl.style.opacity='0',1800);
    }
    document.addEventListener('keydown',e=>{ const n=parseInt(e.key); if(n>=1&&n<=9) select(n-1); });

    function mkCv(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }

    function drawSlots(){
        for(let i=0;i<9;i++){
            const {ctx}=slots[i]; ctx.clearRect(0,0,36,36);
            ctx.imageSmoothingEnabled=false;
            const im=blockImgs[i+1];
            if(im&&im.complete&&im.naturalWidth>0) ctx.drawImage(im,0,0,36,36);
        }
    }

    function drawHearts(hp,max){
        heartsEl.innerHTML='';
        for(let i=0;i<max/2;i++){
            const cv=mkCv(20,20); const c=cv.getContext('2d');
            c.imageSmoothingEnabled=false;
            c.drawImage(HE,0,0,20,20);
            const f=hp-i*2;
            if(f>=2){ c.drawImage(HF,0,0,20,20); }
            else if(f===1){ c.save();c.beginPath();c.rect(0,0,10,20);c.clip();c.drawImage(HF,0,0,20,20);c.restore(); }
            heartsEl.appendChild(cv);
        }
    }

    function drawFood(fp,max){
        foodEl.innerHTML='';
        for(let i=max/2-1;i>=0;i--){
            const cv=mkCv(20,20); const c=cv.getContext('2d');
            c.imageSmoothingEnabled=false;
            c.drawImage(FE,0,0,20,20);
            const f=fp-i*2;
            if(f>=2){ c.drawImage(FF,0,0,20,20); }
            else if(f===1){ c.save();c.beginPath();c.rect(0,0,10,20);c.clip();c.drawImage(FF,0,0,20,20);c.restore(); }
            foodEl.insertBefore(cv,foodEl.firstChild);
        }
    }

    function trySlots(n=0){
        drawSlots();
        const done=ICONS.slice(1).every((_,i)=>{ const im=blockImgs[i+1]; return im&&im.complete; });
        if(!done&&n<20) setTimeout(()=>trySlots(n+1),200);
    }
    setTimeout(()=>{ trySlots(); drawHearts(20,20); drawFood(20,20); select(0); },200);

    window.updateHUD=(hp,mhp,fp,mfp)=>{ drawHearts(hp,mhp); drawFood(fp,mfp); };
}

// Sync depuis molette souris (player.js envoie slotChange)
document.addEventListener('uiSelectSlot', e=>{ select(e.detail); });

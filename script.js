import { randomScrambleForEvent } from "https://cdn.cubing.net/v0/js/cubing/scramble";

/* =========================================================
   1. 基礎配置
   ========================================================= */

const FACE_COLORS = {
    U: 0xFFFFFF, F: 0x00FF00, R: 0xFF0000, 
    D: 0xFFFF00, L: 0xFFA500, B: 0x0000FF 
};

const PALETTE = [
    { id: 'W', hex: '#FFFFFF', val: 0xFFFFFF },
    { id: 'Y', hex: '#FFFF00', val: 0xFFFF00 },
    { id: 'G', hex: '#00FF00', val: 0x00FF00 },
    { id: 'R', hex: '#FF0000', val: 0xFF0000 },
    { id: 'O', hex: '#FFA500', val: 0xFFA500 },
    { id: 'B', hex: '#0000FF', val: 0x0000FF }
];

// UI 下拉選單邏輯配置
const UI_COLOR_LABELS = {
    'W': '⚪ 白色 (White)',
    'Y': '🟡 黃色 (Yellow)',
    'G': '🟢 綠色 (Green)',
    'R': '🔴 紅色 (Red)',
    'B': '🔵 藍色 (Blue)',
    'O': '🟠 橘色 (Orange)'
};

// 定義不同底色 (Cross) 對應的有效側面 (Facing)
const FACING_MAP = {
    'W': ['G', 'R', 'B', 'O'], // 白底 -> 側面: 綠紅藍橘
    'Y': ['G', 'R', 'B', 'O'], // 黃底 -> 側面: 綠紅藍橘
    'R': ['G', 'W', 'B', 'Y'], // 紅底 -> 側面: 綠白藍黃
    'O': ['G', 'W', 'B', 'Y'], // 橘底 -> 側面: 綠白藍黃
    'G': ['W', 'R', 'Y', 'O'], // 綠底 -> 側面: 白紅黃橘
    'B': ['W', 'O', 'Y', 'R']  // 藍底 -> 側面: 白橘黃紅
};

let currentColorHex = 0xFFFFFF;
let scene, camera, renderer, cubeGroup;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let isAnimating = false;
let targetRotX = 0; 
let targetRotY = 0;
let currentWcaScramble = ""; 

/* =========================================================
   2. 初始化與 3D 建置
   ========================================================= */
init();
animate();

function init() {
    const container = document.getElementById('canvas-wrapper');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x121212);
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 10; 
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 8);
    scene.add(dirLight);
    createCube();
    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    setupPalette();
    setupRotateButtons();
    
    // 初始視角
    cubeGroup.rotation.x = 0.2;
    cubeGroup.rotation.y = -0.3;
    targetRotX = 0.2;
    targetRotY = -0.3;

    // 初始化下拉選單
    updateFacingOptions();
}

function createCube() {
    cubeGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.94, 0.94, 0.94); 
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); 
    for(let x=-1; x<=1; x++) {
        for(let y=-1; y<=1; y++) {
            for(let z=-1; z<=1; z++) {
                const mats = [
                    x===1 ? getMat(FACE_COLORS.R) : coreMat,
                    x===-1 ? getMat(FACE_COLORS.L) : coreMat,
                    y===1 ? getMat(FACE_COLORS.U) : coreMat,
                    y===-1 ? getMat(FACE_COLORS.D) : coreMat,
                    z===1 ? getMat(FACE_COLORS.F) : coreMat,
                    z===-1 ? getMat(FACE_COLORS.B) : coreMat
                ];
                const mesh = new THREE.Mesh(geometry, mats);
                mesh.position.set(x, y, z);
                mesh.userData = { x, y, z };
                cubeGroup.add(mesh);
            }
        }
    }
    scene.add(cubeGroup);
}

function getMat(colorHex) {
    return new THREE.MeshStandardMaterial({ 
        color: colorHex, roughness: 0.3, metalness: 0.05
    });
}

function onResize() {
    const container = document.getElementById('canvas-wrapper');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
    renderer.render(scene, camera);
}

/* =========================================================
   3. 互動與 UI
   ========================================================= */

function setupPalette() {
    const p = document.getElementById('palette');
    PALETTE.forEach((c, idx) => {
        const dot = document.createElement('div');
        dot.className = 'color-dot';
        if(idx === 0) dot.classList.add('selected'); 
        dot.style.backgroundColor = c.hex;
        dot.onclick = () => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
            dot.classList.add('selected');
            currentColorHex = c.val;
        };
        p.appendChild(dot);
    });
}

function setupRotateButtons() {
    const step = Math.PI / 2;
    const bindBtn = (id, dx, dy) => {
        const btn = document.getElementById(id);
        if(!btn) return;
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation(); 
            rotateView(dx, dy);
        });
    };
    bindBtn('r-up', -step, 0);
    bindBtn('r-down', step, 0);
    bindBtn('r-left', 0, -step);
    bindBtn('r-right', 0, step);
}

function rotateView(dx, dy) {
    if(isAnimating) return;
    isAnimating = true;
    targetRotX += dx;
    targetRotY += dy;
    new TWEEN.Tween(cubeGroup.rotation).to({ x: targetRotX, y: targetRotY }, 400)
        .easing(TWEEN.Easing.Quadratic.Out).onComplete(() => isAnimating = false).start();
}

function onPointerDown(event) {
    event.preventDefault();
    const rect = renderer.domElement.getBoundingClientRect();
    const clientX = event.clientX || (event.touches ? event.touches[0].clientX : 0);
    const clientY = event.clientY || (event.touches ? event.touches[0].clientY : 0);
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(cubeGroup.children);
    if (intersects.length > 0) {
        const hit = intersects[0];
        const matIndex = hit.face.materialIndex;
        if (hit.object.material[matIndex].color.getHex() !== 0x000000) {
            hit.object.material[matIndex].color.setHex(currentColorHex);
            
            // [修正] 當使用者手動點擊方塊修改顏色時，代表脫離 WCA 狀態
            // 此時才清除 WCA 記錄，轉為手動模式
            currentWcaScramble = "";
            
            const wcaText = document.getElementById('wca-scramble-text');
            if(wcaText) wcaText.innerText = "手動輸入 (無 WCA 打亂)";
            
            const invScrText = document.getElementById('inverse-scramble-text');
            if(invScrText) invScrText.innerText = "-";
            
            // inverse-solution-text 待會按計算時會重新生成
        }
    }
}

// --- 修正後的選項更新邏輯 ---
function updateFacingOptions() {
    const crossSelect = document.getElementById('cross-color');
    const facingSelect = document.getElementById('facing-color');
    
    if(!crossSelect || !facingSelect) return;

    const crossVal = crossSelect.value;
    const currentFacing = facingSelect.value;
    
    // 清空現有選項
    facingSelect.innerHTML = '';
    
    // 獲取有效選項列表
    const validOptions = FACING_MAP[crossVal] || ['G', 'R', 'B', 'O'];
    
    validOptions.forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.text = UI_COLOR_LABELS[code];
        facingSelect.appendChild(opt);
    });
    
    // 嚴格檢查：如果當前選項不在有效列表中，強制選第一個
    if (validOptions.includes(currentFacing)) {
        facingSelect.value = currentFacing;
    } else {
        facingSelect.value = validOptions[0];
    }
    
    handleModeChange();
}
// 綁定到 window 以供 HTML 呼叫
window.updateFacingOptions = updateFacingOptions;

function handleModeChange() {
    const text = document.getElementById('solution-text');
    if (text) {
        text.innerText = "設定已變更，請按計算";
        text.style.color = "#FFD60A";
    }
    
    // [修正] 只有在「非 WCA 模式 (手動模式)」下才清除資訊
    // 這樣保留了 WCA 打亂，讓使用者可以切換底色/正面來解同一個打亂
    if (!currentWcaScramble) {
        const wcaField = document.getElementById('wca-scramble-text');
        if (wcaField) wcaField.innerText = "-";

        const invScrambleField = document.getElementById('inverse-scramble-text');
        if (invScrambleField) invScrambleField.innerText = "-";

        const invSolField = document.getElementById('inverse-solution-text');
        if (invSolField) invSolField.innerText = "-";
    }
}
window.handleModeChange = handleModeChange;

function resetColors(keepInfo = false) {
    scene.remove(cubeGroup);
    createCube();
    
    targetRotX = 0.2;
    targetRotY = -0.3;
    cubeGroup.rotation.x = targetRotX;
    cubeGroup.rotation.y = targetRotY;
    
    const solText = document.getElementById('solution-text');
    if(solText) {
        solText.innerText = "已重置";
        solText.style.color = "#FFD60A";
    }
    
    if (!keepInfo) {
        currentWcaScramble = "";
        const wcaText = document.getElementById('wca-scramble-text');
        if(wcaText) wcaText.innerText = "-";
        
        const invScrText = document.getElementById('inverse-scramble-text');
        if(invScrText) invScrText.innerText = "-";
        
        const invSolText = document.getElementById('inverse-solution-text');
        if(invSolText) invSolText.innerText = "-";
    }

    const player = document.getElementById('solution-player');
    if(player) {
        player.alg = "";
        player.experimentalSetupAlg = "";
        player.timestamp = 0;
    }
}
window.resetColors = resetColors;

/* =========================================================
   WCA 打亂與核心邏輯 (純數據交換，解決黑面問題)
   ========================================================= */

async function generateRandomScramble() {
    const text = document.getElementById('solution-text');
    text.innerText = "生成打亂中...";
    
    try {
        const scramble = await randomScrambleForEvent("333");
        currentWcaScramble = scramble.toString();
        
        document.getElementById('wca-scramble-text').innerText = currentWcaScramble;
        document.getElementById('inverse-scramble-text').innerText = invertAlgString(currentWcaScramble);
        
        resetColors(true); 
        applyScrambleToVisualCube(currentWcaScramble);
        solve(true); 

    } catch (e) {
        text.innerText = "打亂生成失敗，請重試";
        console.error(e);
    }
}
window.generateRandomScramble = generateRandomScramble;

function applyScrambleToVisualCube(scrambleStr) {
    const moves = scrambleStr.split(/\s+/);
    moves.forEach(move => {
        if(!move) return;
        const base = move[0];
        const modifier = move.length > 1 ? move[1] : '';
        let times = 1;
        if(modifier === '2') times = 2;
        let isClockwise = (modifier !== "'");
        for(let i=0; i<times; i++) {
            performVisualMove(base, isClockwise);
        }
    });
}

function performVisualMove(face, isClockwise) {
    let layerAxis = ''; 
    let layerVal = 0;   
    
    if (face === 'R') { layerAxis = 'x'; layerVal = 1; }
    if (face === 'L') { layerAxis = 'x'; layerVal = -1; }
    if (face === 'U') { layerAxis = 'y'; layerVal = 1; }
    if (face === 'D') { layerAxis = 'y'; layerVal = -1; }
    if (face === 'F') { layerAxis = 'z'; layerVal = 1; }
    if (face === 'B') { layerAxis = 'z'; layerVal = -1; }

    cubeGroup.children.forEach(mesh => {
        const x = Math.round(mesh.userData.x);
        const y = Math.round(mesh.userData.y);
        const z = Math.round(mesh.userData.z);

        let inLayer = false;
        if (layerAxis === 'x' && x === layerVal) inLayer = true;
        if (layerAxis === 'y' && y === layerVal) inLayer = true;
        if (layerAxis === 'z' && z === layerVal) inLayer = true;

        if (inLayer) {
            let nx = x, ny = y, nz = z;

            if (face === 'R') { 
                if (isClockwise) { ny = z; nz = -y; } else { ny = -z; nz = y; }
            }
            else if (face === 'L') { 
                if (isClockwise) { ny = -z; nz = y; } else { ny = z; nz = -y; }
            }
            else if (face === 'U') { 
                if (isClockwise) { nx = -z; nz = x; } else { nx = z; nz = -x; }
            }
            else if (face === 'D') { 
                if (isClockwise) { nx = z; nz = -x; } else { nx = -z; nz = x; }
            }
            else if (face === 'F') { 
                if (isClockwise) { nx = y; ny = -x; } else { nx = -y; ny = x; }
            }
            else if (face === 'B') { 
                if (isClockwise) { nx = -y; ny = x; } else { nx = y; ny = -x; }
            }

            mesh.position.set(nx, ny, nz);
            mesh.userData = { x: nx, y: ny, z: nz }; 

            const m = mesh.material;
            const newM = new Array(6);
            for(let i=0; i<6; i++) newM[i] = m[i]; 

            if (face === 'R') {
                if (isClockwise) { 
                    newM[5] = m[2]; newM[3] = m[5]; newM[4] = m[3]; newM[2] = m[4];
                } else { 
                    newM[4] = m[2]; newM[3] = m[4]; newM[5] = m[3]; newM[2] = m[5];
                }
            }
            else if (face === 'L') {
                if (isClockwise) { 
                    newM[4] = m[2]; newM[3] = m[4]; newM[5] = m[3]; newM[2] = m[5];
                } else {
                    newM[5] = m[2]; newM[3] = m[5]; newM[4] = m[3]; newM[2] = m[4];
                }
            }
            else if (face === 'U') {
                if (isClockwise) { 
                    newM[1] = m[4]; newM[5] = m[1]; newM[0] = m[5]; newM[4] = m[0];
                } else {
                    newM[0] = m[4]; newM[5] = m[0]; newM[1] = m[5]; newM[4] = m[1];
                }
            }
            else if (face === 'D') {
                if (isClockwise) { 
                    newM[0] = m[4]; newM[5] = m[0]; newM[1] = m[5]; newM[4] = m[1];
                } else {
                    newM[1] = m[4]; newM[5] = m[1]; newM[0] = m[5]; newM[4] = m[0];
                }
            }
            else if (face === 'F') {
                if (isClockwise) { 
                    newM[0] = m[2]; newM[3] = m[0]; newM[1] = m[3]; newM[2] = m[1];
                } else {
                    newM[1] = m[2]; newM[3] = m[1]; newM[0] = m[3]; newM[2] = m[0];
                }
            }
            else if (face === 'B') {
                if (isClockwise) { 
                    newM[1] = m[2]; newM[3] = m[1]; newM[0] = m[3]; newM[2] = m[0];
                } else {
                    newM[0] = m[2]; newM[3] = m[0]; newM[1] = m[3]; newM[2] = m[1];
                }
            }

            mesh.material = newM;
        }
    });
}

/* =========================================================
   Solver 相關
   ========================================================= */

const C_W = 0, C_Y = 1, C_G = 2, C_R = 3, C_O = 4, C_B = 5;

function getHexId(hex) {
    if(hex === 0xFFFFFF) return C_W;
    if(hex === 0xFFFF00) return C_Y;
    if(hex === 0x00FF00) return C_G;
    if(hex === 0xFF0000) return C_R;
    if(hex === 0xFFA500) return C_O;
    if(hex === 0x0000FF) return C_B;
    return -1;
}

const ROTATION_LOGIC = {
    'y': { coord: (x,y,z) => ({x: -z, y: y, z: x}), colorPerm: [5, 4, 2, 3, 0, 1] },
    "y'": { coord: (x,y,z) => ({x: z, y: y, z: -x}), colorPerm: [4, 5, 2, 3, 1, 0] },
    'y2': { coord: (x,y,z) => ({x: -x, y: y, z: -z}), colorPerm: [1, 0, 2, 3, 5, 4] },
    'z2': { coord: (x,y,z) => ({x: -x, y: -y, z: z}), colorPerm: [1, 0, 3, 2, 4, 5] },
    'x': { coord: (x,y,z) => ({x: x, y: z, z: -y}), colorPerm: [0, 1, 4, 5, 3, 2] }, 
    "x'": { coord: (x,y,z) => ({x: x, y: -z, z: y}), colorPerm: [0, 1, 5, 4, 2, 3] },
    'x2': { coord: (x,y,z) => ({x: x, y: -y, z: -z}), colorPerm: [0, 1, 3, 2, 5, 4] },
    'z': { coord: (x,y,z) => ({x: y, y: -x, z: z}), colorPerm: [2, 3, 1, 0, 4, 5] },
    "z'": { coord: (x,y,z) => ({x: -y, y: x, z: z}), colorPerm: [3, 2, 0, 1, 4, 5] }
};

function transformEdges(edges, rotSeq) {
    return edges.map(edge => {
        let currPos = { x: edge.rawX, y: edge.rawY, z: edge.rawZ };
        let currColors = [...edge.rawColors]; 

        if (rotSeq && rotSeq.length > 0) {
            rotSeq.forEach(rot => {
                const logic = ROTATION_LOGIC[rot];
                if(logic) {
                    currPos = logic.coord(currPos.x, currPos.y, currPos.z);
                    const newColors = new Array(6);
                    for(let i=0; i<6; i++) {
                        newColors[i] = currColors[logic.colorPerm[i]];
                    }
                    currColors = newColors;
                }
            });
        }

        let nC = { x: -1, y: -1, z: -1 };
        if(currPos.x===1) nC.x = currColors[0]; if(currPos.x===-1) nC.x = currColors[1];
        if(currPos.y===1) nC.y = currColors[2]; if(currPos.y===-1) nC.y = currColors[3];
        if(currPos.z===1) nC.z = currColors[4]; if(currPos.z===-1) nC.z = currColors[5];

        return { nC, x: currPos.x, y: currPos.y, z: currPos.z };
    });
}

function readAndTransformState(targetColorId, rotSeq) {
    let rawEdges = [];
    cubeGroup.children.forEach(mesh => {
        const {x, y, z} = mesh.userData;
        if(Math.abs(x)+Math.abs(y)+Math.abs(z) !== 2) return; 

        let c = [
             (x===1)?mesh.material[0].color.getHex():-1, 
             (x===-1)?mesh.material[1].color.getHex():-1,
             (y===1)?mesh.material[2].color.getHex():-1, 
             (y===-1)?mesh.material[3].color.getHex():-1,
             (z===1)?mesh.material[4].color.getHex():-1, 
             (z===-1)?mesh.material[5].color.getHex():-1
        ].map(getHexId);
        rawEdges.push({ rawX: x, rawY: y, rawZ: z, rawColors: c });
    });

    let transformed = transformEdges(rawEdges, rotSeq);
    let solverEdges = [];
    transformed.forEach(t => {
        let { nC, x, y, z } = t;
        let hasTarget = (nC.x===targetColorId || nC.y===targetColorId || nC.z===targetColorId);

        if(hasTarget) {
            let otherColor = (nC.x!==-1 && nC.x!==targetColorId) ? nC.x : ((nC.y!==-1 && nC.y!==targetColorId) ? nC.y : nC.z);
            let pos = -1;
            if(y===-1 && z===1) pos=0;      // DF
            else if(y===-1 && x===1) pos=1; // DR
            else if(y===-1 && z===-1) pos=2;// DB
            else if(y===-1 && x===-1) pos=3;// DL
            else if(z===1 && x===1) pos=4;  // FR
            else if(z===-1 && x===1) pos=5; // BR
            else if(z===-1 && x===-1) pos=6;// BL
            else if(z===1 && x===-1) pos=7; // FL
            else if(y===1 && z===1) pos=8;  // UF
            else if(y===1 && x===1) pos=9;  // UR
            else if(y===1 && z===-1) pos=10;// UB
            else if(y===1 && x===-1) pos=11;// UL

            let isGood = false;
            if(pos>=0 && pos<=3) isGood = (nC.y === targetColorId);
            else if(pos>=8 && pos<=11) isGood = (nC.y === targetColorId); 
            else if(pos>=4 && pos<=7) isGood = (nC.z === targetColorId); 

            solverEdges.push({ targetColor: otherColor, pos: pos, ori: isGood?0:1 });
        }
    });
    return solverEdges;
}

const BASE_MOVES_LOGIC = {
    'F': [ {s:8,e:4,f:1}, {s:4,e:0,f:1}, {s:0,e:7,f:1}, {s:7,e:8,f:1} ],
    'B': [ {s:10,e:6,f:1}, {s:6,e:2,f:1}, {s:2,e:5,f:1}, {s:5,e:10,f:1} ],
    'R': [ {s:9,e:5,f:0}, {s:5,e:1,f:0}, {s:1,e:4,f:0}, {s:4,e:9,f:0} ],
    'L': [ {s:11,e:7,f:0}, {s:7,e:3,f:0}, {s:3,e:6,f:0}, {s:6,e:11,f:0} ],
    'U': [ {s:8,e:11,f:0}, {s:11,e:10,f:0}, {s:10,e:9,f:0}, {s:9,e:8,f:0} ],
    'D': [ {s:0,e:1,f:0}, {s:1,e:2,f:0}, {s:2,e:3,f:0}, {s:3,e:0,f:0} ]
};

let SOLVER_CACHE = null;

function initSolver() {
    if (SOLVER_CACHE) return;
    const prioritizedMoves = [
        {f:'R',v:''}, {f:'L',v:''}, {f:'U',v:''}, {f:'D',v:''}, {f:'F',v:''},
        {f:'R',v:"'"}, {f:'L',v:"'"}, {f:'U',v:"'"}, {f:'D',v:"'"}, {f:'F',v:"'"},
        {f:'R',v:'2'}, {f:'L',v:'2'}, {f:'U',v:'2'}, {f:'D',v:'2'}, {f:'F',v:'2'},
        {f:'B',v:''}, {f:'B',v:"'"}, {f:'B',v:'2'}
    ];
    const faceMap = {'R':0, 'L':1, 'U':2, 'D':3, 'F':4, 'B':5};
    const moveFaces = prioritizedMoves.map(m => faceMap[m.f]);
    const moveNames = prioritizedMoves.map(m => m.f + m.v);
    
    const table = new Int8Array(18 * 24);
    prioritizedMoves.forEach((pm, moveIdx) => {
        const baseTrans = BASE_MOVES_LOGIC[pm.f];
        const times = (pm.v === "'") ? 3 : (pm.v === '2' ? 2 : 1);
        for (let state = 0; state < 24; state++) {
            let pos = state >> 1;
            let ori = state & 1;
            for (let t = 0; t < times; t++) {
                const logic = baseTrans.find(x => x.s === pos);
                if (logic) {
                    pos = logic.e;
                    ori = (ori + logic.f) % 2;
                }
            }
            table[moveIdx * 24 + state] = (pos << 1) | ori;
        }
    });
    SOLVER_CACHE = { table, moveNames, moveFaces };
}

function scoreSolution(path) {
    let backMoves = 0;
    for (let m of path) {
        if (m.startsWith('B')) backMoves++;
    }
    return { backMoves };
}

// 核心修正：將「視覺移動」轉換為「標準視角的移動」
function transformMove(move, rotType) {
    if (!move) return "";
    let base = move[0];
    let mod = move.length > 1 ? move[1] : "";
    
    const map = {
        'z2': { 'R':'L', 'L':'R', 'U':'D', 'D':'U', 'F':'F', 'B':'B' },
        'y':  { 'R':'B', 'B':'L', 'L':'F', 'F':'R', 'U':'U', 'D':'D' },
        'y\'':{ 'R':'F', 'F':'L', 'L':'B', 'B':'R', 'U':'U', 'D':'D' },
        'y2': { 'R':'L', 'L':'R', 'F':'B', 'B':'F', 'U':'U', 'D':'D' },
        'x':  { 'F':'D', 'D':'B', 'B':'U', 'U':'F', 'R':'R', 'L':'L' },
        'x\'':{ 'F':'U', 'U':'B', 'B':'D', 'D':'F', 'R':'R', 'L':'L' },
        'z':  { 'U':'L', 'L':'D', 'D':'R', 'R':'U', 'F':'F', 'B':'B' },
        'z\'':{ 'U':'R', 'R':'D', 'D':'L', 'L':'U', 'F':'F', 'B':'B' }
    };

    if (map[rotType] && map[rotType][base]) {
        return map[rotType][base] + mod;
    }
    return move;
}

function transformAlg(algStr, rotSeq) {
    if (!algStr) return "";
    let moves = algStr.trim().split(/\s+/);
    
    if (rotSeq && rotSeq.length > 0) {
        rotSeq.forEach(rot => {
            moves = moves.map(m => transformMove(m, rot));
        });
    }
    return moves.join(" ");
}

/* =========================================================
   Solve 函式
   ========================================================= */
function solve(isAuto = false) {
    const text = document.getElementById('solution-text');
    
    // [修正] 移除了開頭強制清除 currentWcaScramble 的邏輯
    // 現在僅由 onPointerDown (手動填色) 和 resetColors (重置) 負責清除

    const crossSelect = document.getElementById('cross-color').value;
    const facingSelect = document.getElementById('facing-color').value;
    
    let crossId = -1, facingId = -1;

    // 解析 Cross Color
    if (crossSelect === 'W') crossId = C_W;
    else if (crossSelect === 'Y') crossId = C_Y;
    else if (crossSelect === 'R') crossId = C_R;
    else if (crossSelect === 'O') crossId = C_O;
    else if (crossSelect === 'G') crossId = C_G;
    else if (crossSelect === 'B') crossId = C_B;

    // 解析 Facing Color
    if (facingSelect === 'G') facingId = C_G;
    else if (facingSelect === 'R') facingId = C_R;
    else if (facingSelect === 'B') facingId = C_B;
    else if (facingSelect === 'O') facingId = C_O;
    else if (facingSelect === 'W') facingId = C_W;
    else if (facingSelect === 'Y') facingId = C_Y;

    if (crossId === facingId) {
        text.innerText = "底色與正面不能相同";
        text.style.color = "var(--danger-color)";
        return;
    }

    text.innerText = "計算中...";
    text.style.color = "#FFD60A";

    setTimeout(() => {
        try {
            initSolver();
            const { table, moveNames, moveFaces } = SOLVER_CACHE;

            let rotSeq = [];
            let pattern = []; 

            if (crossId === C_W) {
                rotSeq.push('z2'); pattern = [C_G, C_O, C_B, C_R];
                if (facingId === C_G) {} else if (facingId === C_R) rotSeq.push("y'"); else if (facingId === C_O) rotSeq.push("y"); else if (facingId === C_B) rotSeq.push("y2");
            } else if (crossId === C_Y) {
                pattern = [C_G, C_R, C_B, C_O];
                if (facingId === C_G) {} else if (facingId === C_R) rotSeq.push("y"); else if (facingId === C_O) rotSeq.push("y'"); else if (facingId === C_B) rotSeq.push("y2");
            } else if (crossId === C_R) {
                rotSeq.push("z"); pattern = [C_G, C_W, C_B, C_Y];
                if (facingId === C_G) {} else if (facingId === C_W) rotSeq.push("y"); else if (facingId === C_B) rotSeq.push("y2"); else if (facingId === C_Y) rotSeq.push("y'");
            } else if (crossId === C_O) {
                rotSeq.push("z'"); pattern = [C_G, C_Y, C_B, C_W];
                if (facingId === C_G) {} else if (facingId === C_Y) rotSeq.push("y"); else if (facingId === C_B) rotSeq.push("y2"); else if (facingId === C_W) rotSeq.push("y'");
            } else if (crossId === C_G) {
                rotSeq.push("x'"); pattern = [C_W, C_R, C_Y, C_O];
                if (facingId === C_W) {} else if (facingId === C_R) rotSeq.push("y"); else if (facingId === C_Y) rotSeq.push("y2"); else if (facingId === C_O) rotSeq.push("y'");
            } else if (crossId === C_B) {
                rotSeq.push("x"); pattern = [C_Y, C_R, C_W, C_O];
                if (facingId === C_Y) {} else if (facingId === C_R) rotSeq.push("y"); else if (facingId === C_W) rotSeq.push("y2"); else if (facingId === C_O) rotSeq.push("y'");
            }

            const edges = readAndTransformState(crossId, rotSeq);

            if(edges.length !== 4) { 
                text.innerText = `錯誤：找到 ${edges.length} 個邊塊。請檢查填色。`; 
                text.style.color = "var(--danger-color)"; 
                return; 
            }

            const startIdx = pattern.indexOf(facingId);
            const order = [pattern[startIdx], pattern[(startIdx+1)%4], pattern[(startIdx+2)%4], pattern[(startIdx+3)%4]];
            let startState = 0;
            for(let i=0; i<4; i++) {
                const e = edges.find(x => x.targetColor === order[i]);
                if(!e) { text.innerText = "配置錯誤"; return; }
                startState |= (((e.pos << 1) | e.ori) << (5 * i));
            }
            const SOLVED_STATE = 200768;

            const visited = new Uint8Array(1048576); 
            const parentMap = new Uint32Array(1048576); 
            let currentLayer = [startState]; 
            visited[startState] = 1;
            let solutions = [];

            for (let depth = 0; depth <= 7; depth++) {
                if (currentLayer.length === 0) break;
                let nextLayer = [];
                for (let i = 0; i < currentLayer.length; i++) {
                    const state = currentLayer[i];
                    if (state === SOLVED_STATE) { solutions.push({ state, parent: -1, moveIdx: -1 }); continue; }
                    
                    for (let m = 0; m < 18; m++) {
                        const s0 = state & 31;
                        const s1 = (state >> 5) & 31;
                        const s2 = (state >> 10) & 31;
                        const s3 = (state >> 15) & 31;
                        const nextState = table[m*24+s0] | (table[m*24+s1]<<5) | (table[m*24+s2]<<10) | (table[m*24+s3]<<15);
                        
                        if (nextState === SOLVED_STATE) solutions.push({ state: nextState, parent: state, moveIdx: m });
                        else if (visited[nextState] === 0) {
                            visited[nextState] = 1;
                            parentMap[nextState] = (state << 5) | m;
                            nextLayer.push(nextState);
                        }
                    }
                }
                if (solutions.length > 0) break;
                currentLayer = nextLayer;
            }

            if (solutions.length > 0) {
                const finalPaths = solutions.map(sol => {
                    if (sol.moveIdx === -1) return []; 
                    let path = [ moveNames[sol.moveIdx] ];
                    let curr = sol.parent;
                    while (curr !== startState && curr !== 0 && visited[curr]) {
                        const val = parentMap[curr];
                        path.push(moveNames[val & 0x1F]);
                        curr = val >>> 5;
                    }
                    return path.reverse();
                });

                finalPaths.sort((a, b) => scoreSolution(a).backMoves - scoreSolution(b).backMoves);
                let bestPath = finalPaths[0];
                let resultAlg = bestPath.length === 0 ? "" : bestPath.join(" ");
                
                let rotationPrefix = rotSeq.join(" ");
                let fullSolutionString = (rotationPrefix ? rotationPrefix + " " : "") + resultAlg;
                
                // 顯示正向公式
                text.innerText = fullSolutionString.trim() || "已還原";
                text.style.color = "var(--accent-color)";

                // [修正] 底十字反向公式：[旋轉 (Setup)] + [動作反向]
                const invSolText = document.getElementById('inverse-solution-text');
                if(invSolText) {
                    let invertedMoves = invertAlgString(resultAlg);
                    let displayInverse = (rotationPrefix ? rotationPrefix + " " : "") + invertedMoves;
                    invSolText.innerText = displayInverse.trim() || "無";
                }

                const player = document.getElementById('solution-player');
                if(player) {
                    player.alg = fullSolutionString;

                    if (currentWcaScramble) {
                        // 若有 WCA 打亂，直接使用
                        player.experimentalSetupAlg = currentWcaScramble;
                    } else {
                        // [核心修正] 手動填色模式 Setup 計算
                        // 目的：讓播放器在 t=0 時顯示為「標準視角 (白上綠前)」，
                        // 但方塊顏色狀態等同於「轉了解法反向 + 旋轉反向」。
                        // 這樣當播放器開始執行 fullSolutionString (包含旋轉) 時，
                        // 視覺上就是：白上綠前 -> 翻轉 -> 解題。
                        
                        let invertedMoves = invertAlgString(resultAlg); // 解法反向 (Solver 視角)
                        
                        // 1. 取得旋轉序列的反向 (例如 rotSeq=['z2', 'y''] -> inverse=['y', 'z2'])
                        // 注意：這裡直接反轉陣列順序，因為 transformAlg 是一層層剝洋蔥
                        let rotationsToUnwrap = [...rotSeq].reverse();

                        // 2. 將「Solver 視角的打亂 moves」轉換回「標準視角的 moves」
                        // 這樣播放器在標準視角下執行這些 moves，就能得到正確的亂度
                        let transformedSetup = transformAlg(invertedMoves, rotationsToUnwrap); 
                        
                        player.experimentalSetupAlg = transformedSetup;
                    }
                    
                    player.timestamp = 0;
                    player.pause(); 
                }

            } else {
                text.innerText = "無法在 7 步內解出";
                text.style.color = "var(--danger-color)";
            }

        } catch(e) {
            console.error(e);
            text.innerText = "錯誤: " + e.message;
        }
    }, 50); 
}
window.solve = solve;

function invertAlgString(algStr) {
    if(!algStr) return "";
    return algStr.trim().split(/\s+/).reverse().map(move => {
        if(!move) return "";
        let base = move[0];
        let mod = move.length > 1 ? move[1] : "";
        if (mod === "") return base + "'";
        if (mod === "'") return base;
        if (mod === "2") return base + "2";
        return move;
    }).join(" ");
}

/* =========================================================
   [新增] 相機掃描功能模組 (整合版)
   ========================================================= */

let stream = null;
let currentFaceIndex = 0;
// 定義掃描順序 (WCA標準展開: 上 -> 右 -> 前 -> 下 -> 左 -> 後)
// 注意：這裡使用 app 內部的顏色代碼定義
// 定義掃描順序：改成 U(白) -> F(綠) -> R(紅) -> B(藍) -> L(橘) -> D(黃)
const SCAN_ORDER = ['U', 'F', 'R', 'B', 'L', 'D'];

const FACE_LABELS = {
    'U': '掃描上方 (白中心)',
    'F': '掃描正面 (綠中心)',
    'R': '掃描右側 (紅中心)',
    'B': '掃描背面 (藍中心)',
    'L': '掃描左側 (橘中心)',
    'D': '掃描下方 (黃中心)'
};

// [新增] 每個面掃描時的九宮格周邊提示 (上、右、下、左)
// 邏輯：告訴使用者「你的九宮格上方應該是哪一面」
const ADJACENT_HINTS = {
    'U': { top: 'B (藍)', right: 'R (紅)', bottom: 'F (綠)', left: 'L (橘)' },
    'F': { top: 'U (白)', right: 'R (紅)', bottom: 'D (黃)', left: 'L (橘)' },
    'R': { top: 'U (白)', right: 'B (藍)', bottom: 'D (黃)', left: 'F (綠)' },
    'B': { top: 'U (白)', right: 'L (橘)', bottom: 'D (黃)', left: 'R (紅)' },
    'L': { top: 'U (白)', right: 'F (綠)', bottom: 'D (黃)', left: 'B (藍)' },
    'D': { top: 'F (綠)', right: 'R (紅)', bottom: 'B (藍)', left: 'L (橘)' }
};

// 顏色名稱映射到 script.js 上方的 PALETTE Hex 值
const CAM_COLOR_MAP = {
    'white': 0xFFFFFF,
    'yellow': 0xFFFF00,
    'green': 0x00FF00,
    'red': 0xFF0000,
    'orange': 0xFFA500,
    'blue': 0x0000FF
};

let animationFrameId = null;

// 1. 啟動掃描流程 (由 HTML 按鈕觸發)
async function startCameraScanFlow() {
    // 重置 3D 方塊顏色為黑色(代表未填色)，方便使用者觀察進度
    resetColors(true); // 保留 true 避免清除其他狀態，但在這裡是為了清空顏色
    
    // 將所有面先設為黑色，避免混淆
    cubeGroup.children.forEach(mesh => {
         // 除了黑色內核，外觀設為深灰，表示待掃描
        mesh.material.forEach(m => {
            if(m.color.getHex() !== 0x000000) m.color.setHex(0x333333);
        });
    });

    currentFaceIndex = 0;
    document.getElementById('camera-modal').style.display = 'flex';
    await startCamera();
}
window.startCameraScanFlow = startCameraScanFlow;

// 2. 啟動相機
async function startCamera() {
    const video = document.getElementById('video');
    const faceIndicator = document.getElementById('face-indicator');
    const gridCanvas = document.getElementById('grid-canvas');
    const msg = document.getElementById('scan-message');

    try {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        // 優先嘗試後置鏡頭
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment', 
                width: { ideal: 720 }, 
                height: { ideal: 720 } 
            }
        });
        
        video.srcObject = stream;

        await new Promise(resolve => {
            video.onloadedmetadata = () => {
                // 調整 canvas 尺寸匹配 video 實際顯示尺寸
                gridCanvas.width = video.videoWidth;
                gridCanvas.height = video.videoHeight;
                resolve();
            };
        });

        // 更新 UI
        if(currentFaceIndex < SCAN_ORDER.length) {
            faceIndicator.innerText = `${currentFaceIndex + 1}/6: ${FACE_LABELS[SCAN_ORDER[currentFaceIndex]]}`;
            msg.innerText = "請保持方塊穩定...";
        }
        
        drawGrid();
        startRealTimeDetection();

    } catch (error) {
        alert('無法啟動相機，請檢查權限或設備。');
        console.error('Camera error:', error);
        stopCamera();
    }
}

// 3. 關閉相機
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    stopRealTimeDetection();
    document.getElementById('camera-modal').style.display = 'none';
    
    // 如果中途取消，可選擇是否重置方塊 (這裡選擇不重置，保留部分掃描結果)
}
window.stopCamera = stopCamera;

// 4. 繪製網格
// 4. 繪製網格 (含周邊文字提示)
function drawGrid() {
    const gridCanvas = document.getElementById('grid-canvas');
    const ctx = gridCanvas.getContext('2d');
    
    // 安全檢查：若 Canvas 尺寸異常則不繪製，但仍需回傳物件以免報錯
    if (gridCanvas.width < 50) return { startX: 0, startY: 0, cellSize: 0 };

    // 清除畫布
    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    // 計算網格大小 (佔畫面 60%) 與起始位置
    const size = Math.min(gridCanvas.width, gridCanvas.height) * 0.6;
    const startX = (gridCanvas.width - size) / 2;
    const startY = (gridCanvas.height - size) / 2;
    const cellSize = size / 3;

    // 設定線條樣式
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;

    // 開始繪製井字線
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
        // 橫線
        ctx.moveTo(startX, startY + i * cellSize);
        ctx.lineTo(startX + size, startY + i * cellSize);
        // 直線
        ctx.moveTo(startX + i * cellSize, startY);
        ctx.lineTo(startX + i * cellSize, startY + size);
    }
    ctx.stroke();

    // --- [新增] 繪製周邊方向提示文字 ---
    // 判斷當前是否在有效的掃描步驟內
    if (currentFaceIndex < SCAN_ORDER.length) {
        const faceChar = SCAN_ORDER[currentFaceIndex];
        const hints = ADJACENT_HINTS[faceChar];

        if (hints) {
            // 文字樣式設定
            ctx.font = 'bold 32px "JetBrains Mono", monospace';
            ctx.fillStyle = '#FFD60A'; // 使用亮黃色，在深色背景清楚
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.8)'; // 黑色陰影增加對比
            ctx.shadowBlur = 4;

            // 1. 上方提示 (置中)
            ctx.textAlign = 'center';
            ctx.fillText(hints.top, startX + size / 2, startY - 25);

            // 2. 下方提示 (置中)
            ctx.fillText(hints.bottom, startX + size / 2, startY + size + 25);

            // 3. 左方提示 (靠右對齊，貼近網格左側)
            ctx.textAlign = 'right';
            ctx.fillText(hints.left, startX - 15, startY + size / 2);

            // 4. 右方提示 (靠左對齊，貼近網格右側)
            ctx.textAlign = 'left';
            ctx.fillText(hints.right, startX + size + 15, startY + size / 2);
        }
    }

    // 回傳計算好的座標供 detectAndDraw 使用 (重要：不可省略)
    return { startX, startY, cellSize };
}

// 5. RGB 轉 HSV (保留原演算法)
function rgbToHsv(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h, s = max === 0 ? 0 : d / max, v = max;
    if (max === min) h = 0;
    else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, v * 100];
}

// 6. 顏色檢測 (保留原邏輯，微調參數以適配 three.js 顏色)
function detectColor(r, g, b) {
    const [h, s, v] = rgbToHsv(r, g, b);
    
    // 參數定義 (直接沿用您的參數)
    const colorRanges = {
        'orange': { h: [5, 25], s: [20, 100], v: [30, 100] },
        'red': { h: [350, 5], s: [40, 100], v: [20, 100] },
        'yellow': { h: [50, 70], s: [50, 100], v: [60, 100] }, // v 從 70 放寬到 60
        'green': { h: [100, 150], s: [40, 100], v: [30, 100] },
        'blue': { h: [210, 270], s: [50, 100], v: [30, 100] },
        'white': { h: [0, 360], s: [0, 25], v: [50, 100] } // 放寬白色的 S 和 V 容許度
    };

    for (const [color, range] of Object.entries(colorRanges)) {
        let hInRange;
        if (color === 'red') {
            hInRange = (h >= range.h[0] && h <= 360) || (h >= 0 && h <= range.h[1]);
        } else {
            hInRange = h >= range.h[0] && h <= range.h[1];
        }
        
        if (hInRange && s >= range.s[0] && s <= range.s[1] && v >= range.v[0] && v <= range.v[1]) {
            return color;
        }
    }
    return 'white'; // 默認白色
}

// 7. 即時檢測與防抖 (核心邏輯)
function startRealTimeDetection() {
    const video = document.getElementById('video');
    const gridCanvas = document.getElementById('grid-canvas');
    const ctx = gridCanvas.getContext('2d');
    const msg = document.getElementById('scan-message');
    
    // 用於內部取樣的 canvas
    const captureCanvas = document.getElementById('capture-canvas');
    const capCtx = captureCanvas.getContext('2d');

    let frameCount = 0;
    const requiredFrames = 20; // 稍微降低幀數加快反應
    let lastColors = null;

    function detectAndDraw() {
        if (!video.srcObject || gridCanvas.width < 50) return;

        // 同步內部 canvas 尺寸
        if (captureCanvas.width !== video.videoWidth) {
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
        }

        capCtx.drawImage(video, 0, 0);
        
        // 重新繪製網格與邊框
        const { startX, startY, cellSize } = drawGrid();
        
        const currentFrameColors = [];
        let isAllWhite = true;

        // 掃描 3x3 九宮格
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                // 取樣中心區域 (GridSize * 0.5)
                const sampleX = startX + x * cellSize + cellSize * 0.25;
                const sampleY = startY + y * cellSize + cellSize * 0.25;
                const sampleW = cellSize * 0.5;
                
                const pixelData = capCtx.getImageData(sampleX, sampleY, sampleW, sampleW);
                let rSum = 0, gSum = 0, bSum = 0;
                
                for (let i = 0; i < pixelData.data.length; i += 4) {
                    rSum += pixelData.data[i];
                    gSum += pixelData.data[i+1];
                    bSum += pixelData.data[i+2];
                }
                
                const count = pixelData.data.length / 4;
                const colorName = detectColor(rSum/count, gSum/count, bSum/count);
                currentFrameColors.push(colorName);

                if (colorName !== 'white') isAllWhite = false;

                // 在畫面上繪製識別到的顏色框
                ctx.lineWidth = 4;
                ctx.strokeStyle = colorName === 'white' ? '#ddd' : colorName;
                ctx.strokeRect(startX + x * cellSize, startY + y * cellSize, cellSize, cellSize);
            }
        }

        // 防抖邏輯
        if (lastColors && currentFrameColors.every((c, i) => c === lastColors[i])) {
            frameCount++;
            if (frameCount > 5) {
                msg.innerText = `鎖定中... ${(frameCount/requiredFrames*100).toFixed(0)}%`;
            }
            
            if (frameCount >= requiredFrames && !isAllWhite) {
                cancelAnimationFrame(animationFrameId);
                showConfirmationButtons(currentFrameColors);
                msg.innerText = "已鎖定！請確認顏色是否正確";
                return; // 停止循環
            }
        } else {
            frameCount = 0;
            lastColors = [...currentFrameColors];
            msg.innerText = "請保持方塊穩定...";
            // 移除舊按鈕
            const oldBtns = document.getElementById('button-container');
            if(oldBtns) oldBtns.remove();
        }

        animationFrameId = requestAnimationFrame(detectAndDraw);
    }

    animationFrameId = requestAnimationFrame(detectAndDraw);
}

function stopRealTimeDetection() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    const oldBtns = document.getElementById('button-container');
    if(oldBtns) oldBtns.remove();
}

// 8. 顯示確認按鈕 UI
function showConfirmationButtons(colors) {
    const container = document.getElementById('camera-container');
    
    // 避免重複創建
    if(document.getElementById('button-container')) return;

    const btnDiv = document.createElement('div');
    btnDiv.id = 'button-container';
    
    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'confirm-btn';
    btnConfirm.innerText = '✅ 確認';
    btnConfirm.onclick = () => processCapturedColors(colors);

    const btnRetry = document.createElement('button');
    btnRetry.className = 'retry-btn';
    btnRetry.innerText = '↺ 重試';
    btnRetry.onclick = () => {
        btnDiv.remove();
        startRealTimeDetection();
    };

    btnDiv.appendChild(btnRetry);
    btnDiv.appendChild(btnConfirm);
    container.appendChild(btnDiv);
}

// 9. 處理捕獲的顏色並應用到 3D 方塊
function processCapturedColors(colorNames) {
    const targetFace = SCAN_ORDER[currentFaceIndex];
    
    // 將顏色名稱轉換為 HEX
    const hexColors = colorNames.map(name => CAM_COLOR_MAP[name] || 0x333333);
    
    // 應用到 3D 模型
    applyColorsTo3DFace(targetFace, hexColors);
    
    // 進入下一面或結束
    currentFaceIndex++;
    
    // 移除按鈕
    document.getElementById('button-container').remove();

    if (currentFaceIndex < SCAN_ORDER.length) {
        // 繼續下一面
        const faceIndicator = document.getElementById('face-indicator');
        faceIndicator.innerText = `${currentFaceIndex + 1}/6: ${FACE_LABELS[SCAN_ORDER[currentFaceIndex]]}`;
        startRealTimeDetection(); // 重新啟動偵測
    } else {
        // 完成所有掃描
        stopCamera();
        alert('掃描完成！請檢查畫面上的方塊顏色。');
        
        // 切換為手動模式標記
        currentWcaScramble = "";
        if(document.getElementById('wca-scramble-text')) 
            document.getElementById('wca-scramble-text').innerText = "相機掃描輸入";
        
        // [修正] 掃描完成後，必須清空「打亂反向」與「底十字反向」的舊資料，避免誤導
        if(document.getElementById('inverse-scramble-text')) 
            document.getElementById('inverse-scramble-text').innerText = "-";
            
        if(document.getElementById('inverse-solution-text')) 
            document.getElementById('inverse-solution-text').innerText = "-";
            
        // 提示需要重新計算
        const solText = document.getElementById('solution-text');
        if(solText) {
            solText.innerText = "掃描完成，請按計算";
            solText.style.color = "#FFD60A";
        }
    }
}

// 10. [核心] 將 9 個顏色映射到 3D Group 的特定面上
function applyColorsTo3DFace(faceChar, hexArray) {
    // hexArray 順序：左上, 中上, 右上, 左中, 中中, 右中, 左下, 中下, 右下 (Row-Major)
    // 需要找出 cubeGroup 中對應面的 9 個 mesh，並依照空間座標排序以匹配 hexArray
    
    // 1. 篩選出該面的 Meshes
    let faceMeshes = [];
    cubeGroup.children.forEach(mesh => {
        const { x, y, z } = mesh.userData;
        
        let isFace = false;
        if (faceChar === 'U' && y === 1) isFace = true;
        if (faceChar === 'D' && y === -1) isFace = true;
        if (faceChar === 'R' && x === 1) isFace = true;
        if (faceChar === 'L' && x === -1) isFace = true;
        if (faceChar === 'F' && z === 1) isFace = true;
        if (faceChar === 'B' && z === -1) isFace = true;
        
        if (isFace) faceMeshes.push(mesh);
    });

    // 2. 排序 Meshes 以匹配相機掃描順序 (Row-Major: Top-Left to Bottom-Right)
    // 注意：3D 座標系中，Y 向上為正，X 向右為正，Z 向前為正
    
    faceMeshes.sort((a, b) => {
        const ad = a.userData;
        const bd = b.userData;
        
        // 排序邏輯視不同面而定
        if (faceChar === 'U') { 
            // 上面 (y=1): Z 由負到正 (後->前), X 由負到正 (左->右)
            // 掃描視角：後排先，還是前排先？通常掃描是 "俯視，綠色在下"
            // 標準掃描習慣：Row1(Back), Row2, Row3(Front). 
            // 座標：Z=-1 (Back), Z=0, Z=1 (Front). 
            // 所以 Z 應該從小到大? 不，相機畫面左上角對應的是 "背面的左邊"。
            // 讓我們假定標準手持：白上綠前。
            // 掃描 U 面時，通常是將方塊轉下來，讓 U 面對著鏡頭，此時 "後(B)" 在鏡頭上方，"前(F)" 在鏡頭下方。
            // 所以 Row1 是 Z=-1, Row2 是 Z=0, Row3 是 Z=1。
            // Col1 是 L (x=-1), Col2 (x=0), Col3 (x=1)。
            if (ad.z !== bd.z) return ad.z - bd.z; // Z 小的(後)在先
            return ad.x - bd.x; // X 小的(左)在先
        }
        
        if (faceChar === 'F') {
            // 正面 (z=1): Y 由大到小 (上->下), X 由負到正 (左->右)
            if (ad.y !== bd.y) return bd.y - ad.y; // Y 大的(上)在先
            return ad.x - bd.x;
        }
        
        if (faceChar === 'R') {
            // 右面 (x=1): Y 由大到小 (上->下), Z 由大到小 (前->後) ?
            // 右面掃描時，通常以 "前(F)" 為左邊，"後(B)" 為右邊。
            // Row1(Top y=1). Col1(Front z=1) -> Col3(Back z=-1).
            if (ad.y !== bd.y) return bd.y - ad.y;
            return bd.z - ad.z; // Z 大的(前)在先
        }
        
        if (faceChar === 'B') {
            // 後面 (z=-1): Y 由大到小, X 由大到小 (因為轉到背面看，原本的右是左)
            // 視角：背對正面。原本的 Right(x=1) 在背面看是左邊。
            if (ad.y !== bd.y) return bd.y - ad.y;
            return bd.x - ad.x; // X 大的在先
        }
        
        if (faceChar === 'L') {
            // 左面 (x=-1): Y 由大到小, Z 由小到大 (後->前)
            // 視角：左面看，後(B, z=-1)是左邊，前(F, z=1)是右邊。
            if (ad.y !== bd.y) return bd.y - ad.y;
            return ad.z - bd.z; // Z 小的(後)在先
        }
        
        if (faceChar === 'D') {
            // 下面 (y=-1): 
            // 視角：翻到底面，通常 "前(F)" 在鏡頭上方，"後(B)" 在鏡頭下方。
            // Row1(Front z=1), Row3(Back z=-1).
            if (ad.z !== bd.z) return bd.z - ad.z; // Z 大的(前)在先
            return ad.x - bd.x;
        }
        return 0;
    });

    // 3. 填色
    faceMeshes.forEach((mesh, index) => {
        if (index >= 9) return;
        
        // 找出該 Mesh 對應那個面的 Material Index
        // 根據 createCube 定義: 0:R, 1:L, 2:U, 3:D, 4:F, 5:B
        let matIdx = -1;
        if (faceChar === 'R') matIdx = 0;
        if (faceChar === 'L') matIdx = 1;
        if (faceChar === 'U') matIdx = 2;
        if (faceChar === 'D') matIdx = 3;
        if (faceChar === 'F') matIdx = 4;
        if (faceChar === 'B') matIdx = 5;
        
        if (matIdx !== -1) {
            mesh.material[matIdx].color.setHex(hexArray[index]);
        }
    });
}

/* =========================================================
   [新增] 手機版 TAB 切換邏輯 (修復版)
   ========================================================= */
function switchMobileTab(tabName) {
    // 1. 移除所有 TAB 按鈕的 active 狀態
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // 2. 移除所有 Pane 的 active 狀態 (隱藏)
    document.getElementById('tab-input').classList.remove('active');
    document.getElementById('tab-preview').classList.remove('active');

    // 3. 根據選擇激活對應項目，並強制觸發重繪
    if (tabName === 'input') {
        document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('tab-input').classList.add('active');
        
        // [修正] 切換回填色模式時，也必須觸發 resize，否則 Three.js 畫布會因為曾被隱藏而大小異常
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 50);
        
    } else {
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('tab-preview').classList.add('active');
        
        // 觸發 resize 確保 twisty-player 正確渲染
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 50);
    }
}
window.switchMobileTab = switchMobileTab;
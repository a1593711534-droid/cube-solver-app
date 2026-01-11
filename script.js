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
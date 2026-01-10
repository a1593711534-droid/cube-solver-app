/* =========================================================
   1. 基礎配置
   ========================================================= */

// 新增: 引入 cubing.js 的 scramble 模組
import { randomScrambleForEvent } from "https://cdn.cubing.net/v0/js/cubing/scramble";

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

/* =========================================================
   2. 初始化與 3D 建置
   ========================================================= */
init();
animate();

function init() {
    const container = document.getElementById('canvas-wrapper');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x121212); // 與 style.css 背景一致
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
    
    // 重點：確保材質順序一致 R L U D F B (0-5)
    for(let x=-1; x<=1; x++) {
        for(let y=-1; y<=1; y++) {
            for(let z=-1; z<=1; z++) {
                const mats = [
                    getMat(FACE_COLORS.R), // 0: Right
                    getMat(FACE_COLORS.L), // 1: Left
                    getMat(FACE_COLORS.U), // 2: Up
                    getMat(FACE_COLORS.D), // 3: Down
                    getMat(FACE_COLORS.F), // 4: Front
                    getMat(FACE_COLORS.B)  // 5: Back
                ];
                
                // 根據位置將不需要顯示的面設為 Core 黑色，但這裡為了支援打亂，我們全部初始化
                // 然後根據 x,y,z 將內部面設黑比較好？
                // 原代碼邏輯是：如果是邊界面才給顏色。
                
                const finalMats = mats.map((m, i) => {
                    if (i === 0 && x !== 1) return coreMat;
                    if (i === 1 && x !== -1) return coreMat;
                    if (i === 2 && y !== 1) return coreMat;
                    if (i === 3 && y !== -1) return coreMat;
                    if (i === 4 && z !== 1) return coreMat;
                    if (i === 5 && z !== -1) return coreMat;
                    return m;
                });

                const mesh = new THREE.Mesh(geometry, finalMats);
                mesh.position.set(x, y, z);
                mesh.userData = { x, y, z }; // 重要：儲存邏輯座標
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
        // 只有非黑色的面可以填色
        if (hit.object.material[matIndex].color.getHex() !== 0x000000) {
            hit.object.material[matIndex].color.setHex(currentColorHex);
        }
    }
}

// 綁定到 window 以供 HTML 調用
window.resetColors = function() {
    scene.remove(cubeGroup);
    createCube();
    targetRotX = 0.2;
    targetRotY = -0.3;
    cubeGroup.rotation.x = targetRotX;
    cubeGroup.rotation.y = targetRotY;
    
    document.getElementById('solution-text').innerText = "已重置";
    document.getElementById('solution-text').style.color = "#FFD60A";
    document.getElementById('scramble-text').innerText = "";
    
    // 重置動畫播放器
    const player = document.getElementById('solution-player');
    if(player) {
        player.alg = "";
        player.experimentalSetupAlg = "";
        player.timestamp = 0;
    }
}

window.updateFacingOptions = function() {
    const crossVal = document.getElementById('cross-color').value;
    const facingSelect = document.getElementById('facing-color');
    const currentFacing = facingSelect.value;
    
    facingSelect.innerHTML = '';
    const validOptions = FACING_MAP[crossVal] || ['G']; 
    
    validOptions.forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.text = UI_COLOR_LABELS[code];
        facingSelect.appendChild(opt);
    });
    
    if (validOptions.includes(currentFacing)) {
        facingSelect.value = currentFacing;
    } else {
        facingSelect.value = validOptions[0];
    }
    window.handleModeChange();
}

window.handleModeChange = function() {
    const text = document.getElementById('solution-text');
    text.innerText = "設定已變更，請按計算";
    text.style.color = "#FFD60A";
    document.getElementById('scramble-text').innerText = "";
}

/* =========================================================
   4. 打亂邏輯 (SCRAMBLE LOGIC) - 新增功能
   ========================================================= */

// 1. 生成打亂
window.generateAndApplyScramble = async function() {
    try {
        const text = document.getElementById('solution-text');
        text.innerText = "打亂中...";
        
        // 從 cubing.js 獲取隨機打亂
        const scrambleObj = await randomScrambleForEvent("333");
        const scrambleStr = scrambleObj.toString();
        
        // 顯示打亂公式
        document.getElementById('scramble-text').innerText = "Scramble: " + scrambleStr;
        text.innerText = "已打亂";
        
        // 2. 重置方塊至初始狀態
        scene.remove(cubeGroup);
        createCube();
        
        // 保持視角
        cubeGroup.rotation.x = targetRotX;
        cubeGroup.rotation.y = targetRotY;

        // 3. 解析並應用打亂
        applyScrambleToThreeJS(scrambleStr);
        
    } catch (e) {
        console.error("Scramble Error:", e);
        document.getElementById('solution-text').innerText = "打亂失敗";
    }
}

// 解析打亂字串並執行移動
function applyScrambleToThreeJS(scrambleStr) {
    // 將公式拆解，例如 "R U R'" -> ["R", "U", "R'"]
    const moves = scrambleStr.trim().split(/\s+/);
    
    moves.forEach(move => {
        // 解析移動基底 (R, L, U...) 和修飾符 (', 2)
        let base = move[0];
        let modifier = move.length > 1 ? move[1] : "";
        
        let turns = 1;
        if (modifier === "'") turns = 3; // 逆時針 = 順時針轉3次
        else if (modifier === "2") turns = 2;
        
        // 執行 N 次 90度轉動
        for(let i=0; i<turns; i++) {
            performLayerRotation(base);
        }
    });
}

// 核心：在 Three.js 物件上執行邏輯層轉
// 這會同時更新 mesh.position, mesh.userData, 和 mesh.material 排列
function performLayerRotation(faceChar) {
    const axisInfo = {
        'U': { axis: 'y', val: 1,  rot: 'cw' },
        'D': { axis: 'y', val: -1, rot: 'ccw' }, // D 順時針是從底部看，相當於 Y 軸逆時針
        'R': { axis: 'x', val: 1,  rot: 'cw' }, // 從右看順時針 = X 軸逆時針 (Three.js 座標系規則: X向右) Wait.
                                                // ThreeJS Right Hand Rule: Thumb=Axis. 
                                                // X axis points Right. Rotation around +X is Counter-Clockwise looking from Right?
                                                // Let's stick to standard logic map below.
        'L': { axis: 'x', val: -1, rot: 'ccw' },
        'F': { axis: 'z', val: 1,  rot: 'cw' }, // Z points out. CCW looking from front.
        'B': { axis: 'z', val: -1, rot: 'ccw' }
    };

    // 重新定義簡單的旋轉矩陣邏輯 (針對座標)
    // 假設我們從軸的正方向看去，順時針旋轉90度: (u, v) -> (v, -u)
    // Three.js 座標系: X右, Y上, Z前
    
    // 定義各個面的旋轉對座標和材質的影響
    // 索引: R:0, L:1, U:2, D:3, F:4, B:5
    
    let meshes = [];
    cubeGroup.children.forEach(m => meshes.push(m));
    
    // 篩選目標層
    let targetMeshes = [];
    
    if (faceChar === 'U') targetMeshes = meshes.filter(m => Math.round(m.userData.y) === 1);
    else if (faceChar === 'D') targetMeshes = meshes.filter(m => Math.round(m.userData.y) === -1);
    else if (faceChar === 'R') targetMeshes = meshes.filter(m => Math.round(m.userData.x) === 1);
    else if (faceChar === 'L') targetMeshes = meshes.filter(m => Math.round(m.userData.x) === -1);
    else if (faceChar === 'F') targetMeshes = meshes.filter(m => Math.round(m.userData.z) === 1);
    else if (faceChar === 'B') targetMeshes = meshes.filter(m => Math.round(m.userData.z) === -1);

    targetMeshes.forEach(mesh => {
        let x = mesh.userData.x;
        let y = mesh.userData.y;
        let z = mesh.userData.z;
        let mat = mesh.material; // Array of 6 materials
        
        let newX = x, newY = y, newZ = z;
        let newMat = [...mat]; // Copy current assignment

        // 旋轉邏輯：更新座標 (x,y,z) 和 材質排列 (Swap Faces)
        // 這裡實作標準魔方旋轉定義 (90度順時針)
        
        if (faceChar === 'U') {
            // U (Y-Axis CW): x -> -z, z -> x
            // 但這是在常用數學座標系。在 ThreeJS 若 Y 向上，繞 Y 軸旋轉：
            // x' = z, z' = -x (這是 90度 逆時針 viewing from top? No)
            // 讓我們用物理直覺：U面順時針。
            // 點 (1,1,1) [URF] 轉到 (1,1,-1) [URB] ? 不，那是 -90度。
            // (1,1,1) [URF] 轉到 (-1,1,1) [UFL] ? 對。
            // 原本 X=1 變成 Z=1 ? 不。
            // 原本 (1, 1, 1) -> (-1, 1, 1). 
            // 變換: x' = -z, z' = x (Wait: -1 != -1. z=1, -z=-1. x=1. -z is -1. x'=-1. Correct)
            // 所以 U: x' = -z, z' = x.
            
            newX = -z; newZ = x;
            
            // 材質交換: F(4)->L(1)->B(5)->R(0)->F(4)
            newMat[1] = mat[4]; // L takes F
            newMat[5] = mat[1]; // B takes L
            newMat[0] = mat[5]; // R takes B
            newMat[4] = mat[0]; // F takes R
        }
        else if (faceChar === 'D') {
            // D (Down face CW looking from bottom) -> 相當於 U 的反向
            // x' = z, z' = -x
            newX = z; newZ = -x;
            
            // 材質交換: F(4)->R(0)->B(5)->L(1)->F(4)
            newMat[0] = mat[4]; // R takes F
            newMat[5] = mat[0]; // B takes R
            newMat[1] = mat[5]; // L takes B
            newMat[4] = mat[1]; // F takes L
        }
        else if (faceChar === 'R') {
            // R (Right face CW)
            // 繞 X 軸。y -> z, z -> -y? 
            // 測試: (1,1,1) [URF] -> (1, -1, 1) [DRF]? 不，R轉會把前面轉上去。
            // (1,1,1) [URF] -> (1, 1, -1) [URB].
            // y=1 -> y=1 (不變?) 錯了。
            // R轉： URF -> BRU (1,1,-1).
            // y' = z, z' = -y. (1->1, 1->-1). Correct.
            // 變換: y' = z, z' = -y
            
            // 但這好像是逆時針？R是把前面往上抬嗎？
            // R 是 "Right face clockwise". 拿起方塊看右面，順時針。
            // 前面(F) -> 上面(U) -> 後面(B) -> 下面(D) -> 前面(F)
            // 所以 (1,1,1)[URF] 應該跑到 (1,1,-1)[URB].
            // 變換: y' = -z, z' = y (Wait: -1 != 1)
            
            // 讓我們再想一次。
            // F(z=1, y=0) -> U(z=0, y=1). 
            // 變換: y' = z, z' = -y.
            // Check (1,0,1) -> (1,1,0). Correct.
            
            newY = z; newZ = -y;
            
            // 材質交換: F(4)->U(2)->B(5)->D(3)->F(4)
            newMat[2] = mat[4]; // U takes F
            newMat[5] = mat[2]; // B takes U
            newMat[3] = mat[5]; // D takes B
            newMat[4] = mat[3]; // F takes D
        }
        else if (faceChar === 'L') {
            // L (Left face CW)
            // 對稱於 R，方向相反。
            // F -> D -> B -> U -> F
            // y' = -z, z' = y
            newY = -z; newZ = y;
            
            // 材質交換: F(4)->D(3)->B(5)->U(2)->F(4)
            newMat[3] = mat[4]; // D takes F
            newMat[5] = mat[3]; // B takes D
            newMat[2] = mat[5]; // U takes B
            newMat[4] = mat[2]; // F takes U
        }
        else if (faceChar === 'F') {
            // F (Front face CW)
            // 繞 Z 軸。
            // U -> R -> D -> L -> U
            // (1,1,1) [URF] -> (1,-1,1) [DRF].
            // x' = y, y' = -x.
            // Check (0,1,1) [UF] -> (1,0,1) [RF].
            // x'=1, y'=0. Correct.
            newX = y; newY = -x;
            
            // 材質交換: U(2)->R(0)->D(3)->L(1)->U(2)
            newMat[0] = mat[2]; // R takes U
            newMat[3] = mat[0]; // D takes R
            newMat[1] = mat[3]; // L takes D
            newMat[2] = mat[1]; // U takes L
        }
        else if (faceChar === 'B') {
            // B (Back face CW)
            // 反向 F
            // U -> L -> D -> R -> U
            // x' = -y, y' = x
            newX = -y; newY = x;
            
            // 材質交換: U(2)->L(1)->D(3)->R(0)->U(2)
            newMat[1] = mat[2]; // L takes U
            newMat[3] = mat[1]; // D takes L
            newMat[0] = mat[3]; // R takes D
            newMat[2] = mat[0]; // U takes R
        }

        // 應用更新
        mesh.userData.x = newX;
        mesh.userData.y = newY;
        mesh.userData.z = newZ;
        mesh.position.set(newX, newY, newZ);
        mesh.material = newMat;
    });
}


/* =========================================================
   5. Solver & Scramble Generator & Rotation Logic
   ========================================================= */

const C_W = 0, C_Y = 1, C_G = 2, C_R = 3, C_O = 4, C_B = 5;

// 將 Hex 轉為內部顏色 ID
function getHexId(hex) {
    if(hex === 0xFFFFFF) return C_W;
    if(hex === 0xFFFF00) return C_Y;
    if(hex === 0x00FF00) return C_G;
    if(hex === 0xFF0000) return C_R;
    if(hex === 0xFFA500) return C_O;
    if(hex === 0x0000FF) return C_B;
    return -1;
}

// colorPerm 邏輯 (索引: 0:R, 1:L, 2:U, 3:D, 4:F, 5:B)
// coord 邏輯: 根據旋轉後的位置，反推去哪裡讀取原始方塊的顏色
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
        // 映射：0:R, 1:L, 2:U, 3:D, 4:F, 5:B
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
            // D層 (y=-1)
            if(y===-1 && z===1) pos=0;      // DF
            else if(y===-1 && x===1) pos=1; // DR
            else if(y===-1 && z===-1) pos=2;// DB
            else if(y===-1 && x===-1) pos=3;// DL
            // E層 (y=0)
            else if(z===1 && x===1) pos=4;  // FR
            else if(z===-1 && x===1) pos=5; // BR
            else if(z===-1 && x===-1) pos=6;// BL
            else if(z===1 && x===-1) pos=7; // FL
            // U層 (y=1)
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

// 基礎移動邏輯 (僅用於生成查找表)
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
    
    // 定義移動優先級與順序 (Back moves 在最後)
    const prioritizedMoves = [
        {f:'R',v:''}, {f:'L',v:''}, {f:'U',v:''}, {f:'D',v:''}, {f:'F',v:''},
        {f:'R',v:"'"}, {f:'L',v:"'"}, {f:'U',v:"'"}, {f:'D',v:"'"}, {f:'F',v:"'"},
        {f:'R',v:'2'}, {f:'L',v:'2'}, {f:'U',v:'2'}, {f:'D',v:'2'}, {f:'F',v:'2'},
        {f:'B',v:''}, {f:'B',v:"'"}, {f:'B',v:'2'}
    ];
    
    // R=0, L=1, U=2, D=3, F=4, B=5
    const faceMap = {'R':0, 'L':1, 'U':2, 'D':3, 'F':4, 'B':5};
    const moveFaces = prioritizedMoves.map(m => faceMap[m.f]);
    const moveNames = prioritizedMoves.map(m => m.f + m.v);
    
    // 預計算轉表
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

function generateScramble(path, prefix) {
    if (!path || path.length === 0) return "無需打亂";
    let reversed = [...path].reverse().map(move => {
        let char = move[0];
        let modifier = move.length > 1 ? move[1] : '';
        if (modifier === '') return char + "'";   
        if (modifier === "'") return char;       
        if (modifier === '2') return char + '2'; 
        return move;
    });
    return (prefix ? prefix + " " : "") + reversed.join(" ");
}

// 輔助函數：反轉單個移動或旋轉
function invertMove(move) {
    if(!move) return "";
    let base = move[0];
    let mod = move.length > 1 ? move[1] : "";
    if (mod === "") return base + "'";
    if (mod === "'") return base;
    if (mod === "2") return base + "2";
    return move; // Fallback
}

// 輔助函數：反轉整個移動序列 (字串陣列 -> 字串)
function invertAlg(algArray) {
    if(!algArray || algArray.length === 0) return "";
    return [...algArray].reverse().map(m => invertMove(m)).join(" ");
}

// 綁定 Solve 到 window
window.solve = function() {
    const text = document.getElementById('solution-text');
    const scrambleText = document.getElementById('scramble-text');
    const player = document.getElementById('solution-player'); // 獲取動畫播放器
    
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

    // 簡單檢查: 顏色不能相同
    if (crossId === facingId) {
        text.innerText = "底色與正面不能相同";
        text.style.color = "var(--danger-color)";
        scrambleText.innerText = "";
        return;
    }

    text.innerText = "計算中...";
    // 保留 scrambleText 如果它是自動生成的，否則清空？
    // 這裡我們選擇不清空，因為用戶可能想對照
    text.style.color = "#FFD60A";

    setTimeout(() => {
        try {
            initSolver();
            const { table, moveNames, moveFaces } = SOLVER_CACHE;

            let rotSeq = [];
            let pattern = []; // [Front, Right, Back, Left]

            if (crossId === C_W) {
                rotSeq.push('z2');
                pattern = [C_G, C_O, C_B, C_R]; 
                if (facingId === C_G) { }
                else if (facingId === C_R) rotSeq.push("y'"); 
                else if (facingId === C_O) rotSeq.push("y");  
                else if (facingId === C_B) rotSeq.push("y2"); 
                else throw new Error("無效朝向");

            } else if (crossId === C_Y) {
                pattern = [C_G, C_R, C_B, C_O];
                if (facingId === C_G) { }
                else if (facingId === C_R) rotSeq.push("y");
                else if (facingId === C_O) rotSeq.push("y'");
                else if (facingId === C_B) rotSeq.push("y2");
                else throw new Error("無效朝向");

            } else if (crossId === C_R) {
                rotSeq.push("z"); 
                pattern = [C_G, C_W, C_B, C_Y];
                if (facingId === C_G) { }
                else if (facingId === C_W) rotSeq.push("y");  
                else if (facingId === C_B) rotSeq.push("y2");
                else if (facingId === C_Y) rotSeq.push("y'"); 
                else throw new Error("無效朝向");

            } else if (crossId === C_O) {
                rotSeq.push("z'");
                pattern = [C_G, C_Y, C_B, C_W];
                if (facingId === C_G) { }
                else if (facingId === C_Y) rotSeq.push("y");  
                else if (facingId === C_B) rotSeq.push("y2");
                else if (facingId === C_W) rotSeq.push("y'"); 
                else throw new Error("無效朝向");

            } else if (crossId === C_G) {
                rotSeq.push("x'");
                pattern = [C_W, C_R, C_Y, C_O];
                if (facingId === C_W) { }
                else if (facingId === C_R) rotSeq.push("y");
                else if (facingId === C_Y) rotSeq.push("y2");
                else if (facingId === C_O) rotSeq.push("y'");
                else throw new Error("無效朝向");

            } else if (crossId === C_B) {
                rotSeq.push("x");
                pattern = [C_Y, C_R, C_W, C_O];
                if (facingId === C_Y) { }
                else if (facingId === C_R) rotSeq.push("y");  
                else if (facingId === C_W) rotSeq.push("y2"); 
                else if (facingId === C_O) rotSeq.push("y'"); 
                else throw new Error("無效朝向");
            }
            
            // 讀取並轉換狀態
            const edges = readAndTransformState(crossId, rotSeq);
            
            const crossName = (crossId===C_W?"白色":(crossId===C_Y?"黃色":(crossId===C_R?"紅色":(crossId===C_O?"橘色":(crossId===C_G?"綠色":"藍色")))));
            
            if(edges.length !== 4) { 
                let foundColors = edges.map(e => {
                     const c = e.targetColor;
                     return (c===C_W?"白":(c===C_Y?"黃":(c===C_G?"綠":(c===C_B?"藍":(c===C_R?"紅":"橘")))));
                }).join(", ");
                
                text.innerText = `錯誤：找到 ${edges.length} 個${crossName}邊塊 (側面: ${foundColors || "無"})。請檢查填色是否正確。`; 
                text.style.color = "var(--danger-color)"; 
                return; 
            }

            const startIdx = pattern.indexOf(facingId);
            const order = [
                pattern[startIdx],           
                pattern[(startIdx+1)%4],     
                pattern[(startIdx+2)%4],     
                pattern[(startIdx+3)%4]      
            ];

            let startState = 0;
            for(let i=0; i<4; i++) {
                const e = edges.find(x => x.targetColor === order[i]);
                if(!e) {
                    const targetName = (order[i]===C_W?"白":(order[i]===C_Y?"黃":(order[i]===C_G?"綠":(order[i]===C_B?"藍":(order[i]===C_R?"紅":"橘")))));
                    text.innerText = `配置錯誤：在${crossName}十字下，找不到側面為${targetName}的邊塊。請檢查側面顏色順序。`; 
                    text.style.color = "var(--danger-color)"; 
                    return;
                }
                const val = (e.pos << 1) | e.ori; 
                startState |= (val << (5 * i));
            }

            const SOLVED_STATE = 200768;

            const visited = new Uint8Array(1048576); 
            const parentMap = new Uint32Array(1048576); 
            
            let currentLayer = [startState];
            visited[startState] = 1;
            
            let solutions = [];
            const MAX_DEPTH = 7;
            
            for (let depth = 0; depth <= MAX_DEPTH; depth++) {
                if (currentLayer.length === 0) break;
                let nextLayer = [];
                
                for (let i = 0; i < currentLayer.length; i++) {
                    const state = currentLayer[i];
                    if (state === SOLVED_STATE) {
                        solutions.push({ state, parent: -1, moveIdx: -1 }); 
                        continue;
                    }

                    let lastFace = -1;
                    if (depth > 0) {
                        const pVal = parentMap[state];
                        const lastMoveIdx = pVal & 0x1F;
                        lastFace = moveFaces[lastMoveIdx];
                    }

                    for (let m = 0; m < 18; m++) {
                        if (moveFaces[m] === lastFace) continue; 

                        const s0 = state & 31;
                        const s1 = (state >> 5) & 31;
                        const s2 = (state >> 10) & 31;
                        const s3 = (state >> 15) & 31;

                        const n0 = table[m * 24 + s0];
                        const n1 = table[m * 24 + s1];
                        const n2 = table[m * 24 + s2];
                        const n3 = table[m * 24 + s3];

                        const nextState = n0 | (n1 << 5) | (n2 << 10) | (n3 << 15);

                        if (nextState === SOLVED_STATE) {
                            solutions.push({ state: nextState, parent: state, moveIdx: m });
                        } else if (visited[nextState] === 0) {
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
                    while (curr !== startState) {
                        const val = parentMap[curr];
                        const mIdx = val & 0x1F;
                        const pState = val >>> 5;
                        path.push(moveNames[mIdx]);
                        curr = pState;
                    }
                    return path.reverse();
                });

                finalPaths.sort((a, b) => scoreSolution(a).backMoves - scoreSolution(b).backMoves);
                let bestPath = finalPaths[0];
                
                // [修改點] 顯示文字與播放代碼分離
                // 如果 bestPath 是空陣列，顯示 "無需移動"，但給播放器的 alg 是空字串
                let resultDisplay = bestPath.length === 0 ? "無需移動" : bestPath.join(" ");
                let resultAlg = bestPath.length === 0 ? "" : bestPath.join(" ");
                
                let prefixStr = rotSeq.join(" ");
                
                // 顯示結果
                text.innerText = (prefixStr ? `(${prefixStr}) ` : "") + resultDisplay;
                text.style.color = "var(--accent-color)";

                // 如果是手動填色的，這裡會覆蓋掉自動打亂的字串
                // 如果是自動打亂的，scrambleText 已經有值了，這裡我們顯示 "解法打亂" 可能有點混淆
                // 所以我們只在 scrambleText 為空時才填入生成的反向打亂
                if(scrambleText.innerText === "") {
                    let scramble = generateScramble(bestPath, prefixStr);
                    scrambleText.innerText = "打亂: " + scramble;
                }

                // --- 更新 Twisty Player ---
                if(player) {
                    // 1. 構建播放用的公式: [旋轉] + [解法]
                    // 注意：這裡使用 resultAlg (空字串)，而不是 resultDisplay ("無需移動")
                    // 這樣當無需移動時，fullAlgForPlayer 只會是 "z'" 之類的旋轉指令，動畫就能正確播放
                    let fullAlgForPlayer = (prefixStr ? prefixStr + " " : "") + resultAlg;
                    
                    // 2. 構建 Setup Alg (讓動畫回到標準視角開始)
                    // 邏輯: 旋轉至解題視角 -> 反向打亂 -> 旋轉回標準視角
                    // 這樣播放器開始時是標準視角(白上/綠前)，但內部貼紙已正確打亂
                    let inverseRot = invertAlg(rotSeq);
                    let inverseSol = invertAlg(bestPath);
                    
                    // 確保字串拼接不會有多餘空格
                    let setupParts = [];
                    if (prefixStr) setupParts.push(prefixStr);
                    if (inverseSol) setupParts.push(inverseSol);
                    if (inverseRot) setupParts.push(inverseRot);
                    
                    let setupAlg = setupParts.join(" ");

                    player.alg = fullAlgForPlayer;
                    player.experimentalSetupAlg = setupAlg;
                    
                    // 3. 不自動播放，重置到開頭
                    player.timestamp = 0;
                }

            } else {
                text.innerText = "無法在 7 步內解出";
                text.style.color = "var(--danger-color)";
            }

        } catch(e) {
            console.error(e);
            text.innerText = "系統錯誤: " + e.message;
        }
    }, 50);
}
/* =========================================================
   Imports & 基礎配置
   ========================================================= */
import { randomScrambleForEvent } from "https://cdn.cubing.net/v0/js/cubing/scramble";
import { Alg } from "https://cdn.cubing.net/v0/js/cubing/alg";

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

const UI_COLOR_LABELS = {
    'W': '⚪ 白色 (White)',
    'Y': '🟡 黃色 (Yellow)',
    'G': '🟢 綠色 (Green)',
    'R': '🔴 紅色 (Red)',
    'B': '🔵 藍色 (Blue)',
    'O': '🟠 橘色 (Orange)'
};

const FACING_MAP = {
    'W': ['G', 'R', 'B', 'O'],
    'Y': ['G', 'R', 'B', 'O'],
    'R': ['G', 'W', 'B', 'Y'],
    'O': ['G', 'W', 'B', 'Y'],
    'G': ['W', 'R', 'Y', 'O'],
    'B': ['W', 'O', 'Y', 'R']
};

// 全局變數
let currentColorHex = 0xFFFFFF;
let scene, camera, renderer, cubeGroup;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let isAnimating = false;
let targetRotX = 0; 
let targetRotY = 0;
let currentScrambleStr = ""; // 儲存當前打亂字串

/* =========================================================
   2. 初始化與 3D 建置
   ========================================================= */

// 等待 DOM 載入後執行初始化
document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
    
    // 綁定事件
    document.getElementById('btn-scramble').addEventListener('click', generateWCAScramble);
    document.getElementById('btn-solve').addEventListener('click', solve);
    document.getElementById('btn-reset').addEventListener('click', () => resetColors(false));
    document.getElementById('cross-color').addEventListener('change', updateFacingOptions);
    document.getElementById('facing-color').addEventListener('change', handleModeChange);
});

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
    
    createCube(); // 建立初始狀態 (Solved)
    
    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    setupPalette();
    setupRotateButtons();
    
    // 初始視角
    cubeGroup.rotation.x = 0.2;
    cubeGroup.rotation.y = -0.3;
    targetRotX = 0.2;
    targetRotY = -0.3;

    updateFacingOptions();
}

function createCube() {
    cubeGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.94, 0.94, 0.94); 
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); 
    
    // 依序建立 27 個小方塊
    for(let x=-1; x<=1; x++) {
        for(let y=-1; y<=1; y++) {
            for(let z=-1; z<=1; z++) {
                // 材質索引: 0:Right, 1:Left, 2:Up, 3:Down, 4:Front, 5:Back
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
                mesh.userData = { x, y, z }; // 儲存原始邏輯座標
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
    if (!container) return;
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
    p.innerHTML = '';
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
        
        // 移除舊監聽器 (防止重複綁定)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('pointerdown', (e) => {
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
        }
    }
}

// isHardReset: true=回到完全復原狀態, false=僅重置UI和模型
function resetColors(isHardReset = false) {
    scene.remove(cubeGroup);
    createCube(); // 重新建立會自動填回標準色
    
    // 如果不是強制復原(即手動按重置)，我們可能希望保持當前視覺角度
    if (isHardReset) {
        // 重置打亂字串
        currentScrambleStr = "";
        document.getElementById('scramble-text').innerText = "已復原";
        document.getElementById('inverse-text').innerText = "";
    } else {
        // 手動重置
        currentScrambleStr = "";
        document.getElementById('scramble-text').innerText = "已重置";
        document.getElementById('inverse-text').innerText = "";
    }

    targetRotX = 0.2;
    targetRotY = -0.3;
    cubeGroup.rotation.x = targetRotX;
    cubeGroup.rotation.y = targetRotY;
    
    document.getElementById('solution-text').innerText = "READY";
    document.getElementById('solution-text').style.color = "#FFD60A";
    
    const player = document.getElementById('solution-player');
    if(player) {
        player.alg = "";
        player.experimentalSetupAlg = "";
        player.timestamp = 0;
    }
}

function updateFacingOptions() {
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
    handleModeChange();
}

function handleModeChange() {
    const text = document.getElementById('solution-text');
    // 如果沒有打亂，顯示 ready，否則保留打亂文字
    if (!currentScrambleStr) {
        text.innerText = "設定已變更";
        document.getElementById('scramble-text').innerText = "請按計算";
    }
    text.style.color = "#FFD60A";
}

/* =========================================================
   4. WCA Scramble Logic (New Feature)
   ========================================================= */

// 生成 WCA 打亂並應用到 Three.js 模型
async function generateWCAScramble() {
    const text = document.getElementById('solution-text');
    text.innerText = "打亂生成中...";
    
    // 1. 取得隨機打亂
    const scramble = await randomScrambleForEvent("333");
    currentScrambleStr = scramble.toString();
    
    // 2. 重置 Three.js 方塊到還原狀態
    resetColors(true);
    
    // 3. 應用打亂到 3D 模型顏色 (更新 internal meshes)
    applyScrambleToThreeJS(currentScrambleStr);
    
    // 4. 更新 UI
    text.innerText = "已打亂";
    document.getElementById('scramble-text').innerText = currentScrambleStr;
    document.getElementById('inverse-text').innerText = ""; // 清空舊的反向公式
}

// 解析打亂字串並更新 cubeGroup 顏色
function applyScrambleToThreeJS(scrambleStr) {
    const moves = scrambleStr.split(/\s+/).filter(s => s.length > 0);
    
    moves.forEach(move => {
        let base = move[0]; // R, L, U...
        let modifier = move.length > 1 ? move[1] : null; // ', 2
        
        let times = 1;
        if (modifier === '2') times = 2;
        else if (modifier === "'") times = 3; // R' = R R R
        
        for (let i = 0; i < times; i++) {
            performVirtualMove(base);
        }
    });
}

// 模擬單次順時針轉動 (90度)，僅更新顏色
// 這是純邏輯層面的顏色交換，對應 Three.js 的材質索引
// Mat Indices: 0:R, 1:L, 2:U, 3:D, 4:F, 5:B
function performVirtualMove(face) {
    // 輔助：根據座標找 Mesh
    const findMesh = (x, y, z) => {
        return cubeGroup.children.find(m => 
            Math.round(m.userData.x) === x && 
            Math.round(m.userData.y) === y && 
            Math.round(m.userData.z) === z
        );
    };

    // 輔助：交換四個 Mesh 指定面的顏色
    // arr 格式: [{x,y,z, faceIdx}, ...]
    const cycleColors = (arr) => {
        // 保存最後一個顏色
        const lastHex = findMesh(arr[3].x, arr[3].y, arr[3].z).material[arr[3].faceIdx].color.getHex();
        // 3->2, 2->1, 1->0
        for (let i = 3; i > 0; i--) {
            const currMesh = findMesh(arr[i].x, arr[i].y, arr[i].z);
            const prevMesh = findMesh(arr[i-1].x, arr[i-1].y, arr[i-1].z);
            currMesh.material[arr[i].faceIdx].color.setHex(
                prevMesh.material[arr[i-1].faceIdx].color.getHex()
            );
        }
        // 0->last
        findMesh(arr[0].x, arr[0].y, arr[0].z).material[arr[0].faceIdx].color.setHex(lastHex);
    };

    // 定義各面的旋轉邏輯 (Stickering)
    // 每個轉動涉及：1. 該面的 8 個貼紙旋轉 (Edges x4, Corners x4) 2. 側面環 (Ring) 的 12 個貼紙旋轉
    
    // 簡化：我們只要定義該層的方塊位置變換即可？
    // 不行，Mesh 的 x,y,z 是固定的 (userData)，我們只改顏色。
    // 必須定義貼紙的傳遞鏈。
    
    // 為了節省篇幅且保持準確，我們針對每個面定義受影響的貼紙環
    // 順時針 R (x=1):
    // Face R (Mat 0): Corners (1,1,1)->(1,-1,1)->(1,-1,-1)->(1,1,-1) / Edges (1,0,1)->(1,-1,0)->(1,0,-1)->(1,1,0)
    // Ring: F(Mat 4, x=1) -> U(Mat 2, x=1) -> B(Mat 5, x=1) -> D(Mat 3, x=1) -> F...
    
    // 註：Three.js 座標系: x右, y上, z前(螢幕外)。
    // B面 (z=-1) 的材質是 5。但是要注意 B 面的貼紙順序。
    
    let cycles = [];

    if (face === 'R') { // x=1
        // Face R (Mat 0)
        cycles.push([ {x:1,y:1,z:1,f:0}, {x:1,y:1,z:-1,f:0}, {x:1,y:-1,z:-1,f:0}, {x:1,y:-1,z:1,f:0} ]); // Corners
        cycles.push([ {x:1,y:0,z:1,f:0}, {x:1,y:1,z:0,f:0}, {x:1,y:0,z:-1,f:0}, {x:1,y:-1,z:0,f:0} ]); // Edges
        // Ring: F -> U -> B -> D
        // F(x=1) -> U(x=1) -> B(x=1) -> D(x=1)
        // Corners Strip
        cycles.push([ {x:1,y:1,z:1,f:4}, {x:1,y:1,z:1,f:2}, {x:1,y:1,z:-1,f:5}, {x:1,y:-1,z:1,f:3} ]); // F_TR -> U_TR -> B_TL(inv) -> D_TR
        // Wait, alignment is tricky. Let's trace specific stickers.
        // R move: Front-Right col -> Up-Right col -> Back-Left col (inverted z) -> Down-Right col
        // F(1,1,1) -> U(1,1,-1)? No.
        // F(1,1,1) (TopRight of F) -> U(1,1,-1) (TopRight of U relative to F? No, BackRight of U).
        // Let's use standard indices.
        // F(1,y,z) is Mat 4. U(x,1,z) is Mat 2. B(x,y,-1) is Mat 5. D(x,-1,z) is Mat 3.
        
        // Correct Cycle for R:
        // F -> U -> B -> D
        // Top Corner: F(1,1,1) -> U(1,1,-1) -> B(1,-1,-1) -> D(1,-1,1)
        cycles.push([ {x:1,y:1,z:1,f:4}, {x:1,y:1,z:-1,f:2}, {x:1,y:-1,z:-1,f:5}, {x:1,y:-1,z:1,f:3} ]);
        // Bottom Corner: F(1,-1,1) -> U(1,1,1) -> B(1,1,-1) -> D(1,-1,-1)
        cycles.push([ {x:1,y:-1,z:1,f:4}, {x:1,y:1,z:1,f:2}, {x:1,y:1,z:-1,f:5}, {x:1,y:-1,z:-1,f:3} ]);
        // Edge: F(1,0,1) -> U(1,1,0) -> B(1,0,-1) -> D(1,-1,0)
        cycles.push([ {x:1,y:0,z:1,f:4}, {x:1,y:1,z:0,f:2}, {x:1,y:0,z:-1,f:5}, {x:1,y:-1,z:0,f:3} ]);

    } else if (face === 'L') { // x=-1
        // Face L (Mat 1)
        cycles.push([ {x:-1,y:1,z:-1,f:1}, {x:-1,y:1,z:1,f:1}, {x:-1,y:-1,z:1,f:1}, {x:-1,y:-1,z:-1,f:1} ]); // Corners
        cycles.push([ {x:-1,y:0,z:-1,f:1}, {x:-1,y:1,z:0,f:1}, {x:-1,y:0,z:1,f:1}, {x:-1,y:-1,z:0,f:1} ]); // Edges
        // Ring: F -> D -> B -> U (Inverse of R logic roughly)
        // Top Corner: F(-1,1,1) -> D(-1,-1,1) -> B(-1,-1,-1) -> U(-1,1,-1)
        cycles.push([ {x:-1,y:1,z:1,f:4}, {x:-1,y:-1,z:1,f:3}, {x:-1,y:-1,z:-1,f:5}, {x:-1,y:1,z:-1,f:2} ]);
        // Bottom Corner: F(-1,-1,1) -> D(-1,-1,-1) -> B(-1,1,-1) -> U(-1,1,1)
        cycles.push([ {x:-1,y:-1,z:1,f:4}, {x:-1,y:-1,z:-1,f:3}, {x:-1,y:1,z:-1,f:5}, {x:-1,y:1,z:1,f:2} ]);
        // Edge: F(-1,0,1) -> D(-1,-1,0) -> B(-1,0,-1) -> U(-1,1,0)
        cycles.push([ {x:-1,y:0,z:1,f:4}, {x:-1,y:-1,z:0,f:3}, {x:-1,y:0,z:-1,f:5}, {x:-1,y:1,z:0,f:2} ]);

    } else if (face === 'U') { // y=1
        // Face U (Mat 2)
        cycles.push([ {x:-1,y:1,z:-1,f:2}, {x:1,y:1,z:-1,f:2}, {x:1,y:1,z:1,f:2}, {x:-1,y:1,z:1,f:2} ]);
        cycles.push([ {x:0,y:1,z:-1,f:2}, {x:1,y:1,z:0,f:2}, {x:0,y:1,z:1,f:2}, {x:-1,y:1,z:0,f:2} ]);
        // Ring: F -> L -> B -> R
        // Corners: F(1,1,1) -> L(-1,1,1) ? No. U move pushes F to L.
        // F -> L -> B -> R
        // F(1,1,1)(TR) -> L(1?? No L is x=-1).
        // Sticker Sequence: F(row 1) -> L(row 1) -> B(row 1) -> R(row 1)
        // Right Corner: F(1,1,1) -> L(-1,1,1) (L_FrontTop? No L is side).
        // Let's list coords:
        // F(1,1,1) -> L(-1,1,1) -> B(-1,1,-1) -> R(1,1,-1)
        cycles.push([ {x:1,y:1,z:1,f:4}, {x:-1,y:1,z:1,f:1}, {x:-1,y:1,z:-1,f:5}, {x:1,y:1,z:-1,f:0} ]);
        // Left Corner: F(-1,1,1) -> L(-1,1,-1) -> B(1,1,-1) -> R(1,1,1)
        cycles.push([ {x:-1,y:1,z:1,f:4}, {x:-1,y:1,z:-1,f:1}, {x:1,y:1,z:-1,f:5}, {x:1,y:1,z:1,f:0} ]);
        // Edge: F(0,1,1) -> L(-1,1,0) -> B(0,1,-1) -> R(1,1,0)
        cycles.push([ {x:0,y:1,z:1,f:4}, {x:-1,y:1,z:0,f:1}, {x:0,y:1,z:-1,f:5}, {x:1,y:1,z:0,f:0} ]);

    } else if (face === 'D') { // y=-1
        // Face D (Mat 3)
        cycles.push([ {x:-1,y:-1,z:1,f:3}, {x:1,y:-1,z:1,f:3}, {x:1,y:-1,z:-1,f:3}, {x:-1,y:-1,z:-1,f:3} ]);
        cycles.push([ {x:0,y:-1,z:1,f:3}, {x:1,y:-1,z:0,f:3}, {x:0,y:-1,z:-1,f:3}, {x:-1,y:-1,z:0,f:3} ]);
        // Ring: F -> R -> B -> L
        // F(1,-1,1) -> R(1,-1,-1) -> B(-1,-1,-1) -> L(-1,-1,1)
        cycles.push([ {x:1,y:-1,z:1,f:4}, {x:1,y:-1,z:-1,f:0}, {x:-1,y:-1,z:-1,f:5}, {x:-1,y:-1,z:1,f:1} ]);
        // F(-1,-1,1) -> R(1,-1,1) -> B(1,-1,-1) -> L(-1,-1,-1)
        cycles.push([ {x:-1,y:-1,z:1,f:4}, {x:1,y:-1,z:1,f:0}, {x:1,y:-1,z:-1,f:5}, {x:-1,y:-1,z:-1,f:1} ]);
        // Edge: F(0,-1,1) -> R(1,-1,0) -> B(0,-1,-1) -> L(-1,-1,0)
        cycles.push([ {x:0,y:-1,z:1,f:4}, {x:1,y:-1,z:0,f:0}, {x:0,y:-1,z:-1,f:5}, {x:-1,y:-1,z:0,f:1} ]);

    } else if (face === 'F') { // z=1
        // Face F (Mat 4)
        cycles.push([ {x:1,y:1,z:1,f:4}, {x:1,y:-1,z:1,f:4}, {x:-1,y:-1,z:1,f:4}, {x:-1,y:1,z:1,f:4} ]);
        cycles.push([ {x:1,y:0,z:1,f:4}, {x:0,y:-1,z:1,f:4}, {x:-1,y:0,z:1,f:4}, {x:0,y:1,z:1,f:4} ]);
        // Ring: U -> R -> D -> L
        // U(1,1,1) -> R(1,-1,1) -> D(-1,-1,1) -> L(-1,1,1)
        cycles.push([ {x:1,y:1,z:1,f:2}, {x:1,y:-1,z:1,f:0}, {x:-1,y:-1,z:1,f:3}, {x:-1,y:1,z:1,f:1} ]); // Corners Outer
        // U(-1,1,1) -> R(1,1,1) -> D(1,-1,1) -> L(-1,-1,1)
        cycles.push([ {x:-1,y:1,z:1,f:2}, {x:1,y:1,z:1,f:0}, {x:1,y:-1,z:1,f:3}, {x:-1,y:-1,z:1,f:1} ]);
        // Edge: U(0,1,1) -> R(1,0,1) -> D(0,-1,1) -> L(-1,0,1)
        cycles.push([ {x:0,y:1,z:1,f:2}, {x:1,y:0,z:1,f:0}, {x:0,y:-1,z:1,f:3}, {x:-1,y:0,z:1,f:1} ]);

    } else if (face === 'B') { // z=-1
        // Face B (Mat 5)
        cycles.push([ {x:-1,y:1,z:-1,f:5}, {x:-1,y:-1,z:-1,f:5}, {x:1,y:-1,z:-1,f:5}, {x:1,y:1,z:-1,f:5} ]);
        cycles.push([ {x:-1,y:0,z:-1,f:5}, {x:0,y:-1,z:-1,f:5}, {x:1,y:0,z:-1,f:5}, {x:0,y:1,z:-1,f:5} ]);
        // Ring: U -> L -> D -> R
        // U(-1,1,-1) -> L(-1,-1,-1) -> D(1,-1,-1) -> R(1,1,-1)
        cycles.push([ {x:-1,y:1,z:-1,f:2}, {x:-1,y:-1,z:-1,f:1}, {x:1,y:-1,z:-1,f:3}, {x:1,y:1,z:-1,f:0} ]);
        // U(1,1,-1) -> L(-1,1,-1) -> D(-1,-1,-1) -> R(1,-1,-1)
        cycles.push([ {x:1,y:1,z:-1,f:2}, {x:-1,y:1,z:-1,f:1}, {x:-1,y:-1,z:-1,f:3}, {x:1,y:-1,z:-1,f:0} ]);
        // Edge: U(0,1,-1) -> L(-1,0,-1) -> D(0,-1,-1) -> R(1,0,-1)
        cycles.push([ {x:0,y:1,z:-1,f:2}, {x:-1,y:0,z:-1,f:1}, {x:0,y:-1,z:-1,f:3}, {x:1,y:0,z:-1,f:0} ]);
    }

    // 執行所有交換
    cycles.forEach(group => cycleColors(group));
}


/* =========================================================
   5. Solver & Rotation Logic
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

function generateScrambleText(path, prefix) {
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

function solve() {
    const text = document.getElementById('solution-text');
    const scrambleText = document.getElementById('scramble-text');
    const inverseText = document.getElementById('inverse-text');
    const player = document.getElementById('solution-player');
    
    const crossSelect = document.getElementById('cross-color').value;
    const facingSelect = document.getElementById('facing-color').value;
    
    let crossId = -1, facingId = -1;

    if (crossSelect === 'W') crossId = C_W;
    else if (crossSelect === 'Y') crossId = C_Y;
    else if (crossSelect === 'R') crossId = C_R;
    else if (crossSelect === 'O') crossId = C_O;
    else if (crossSelect === 'G') crossId = C_G;
    else if (crossSelect === 'B') crossId = C_B;

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
    inverseText.innerText = "";
    text.style.color = "#FFD60A";

    setTimeout(() => {
        try {
            initSolver();
            const { table, moveNames, moveFaces } = SOLVER_CACHE;

            let rotSeq = [];
            let pattern = []; 

            // 根據目標設定計算需要的視角旋轉 (rotSeq)
            if (crossId === C_W) {
                rotSeq.push('z2');
                pattern = [C_G, C_O, C_B, C_R]; 
                if (facingId === C_G) { }
                else if (facingId === C_R) rotSeq.push("y'"); 
                else if (facingId === C_O) rotSeq.push("y");  
                else if (facingId === C_B) rotSeq.push("y2"); 
            } else if (crossId === C_Y) {
                pattern = [C_G, C_R, C_B, C_O];
                if (facingId === C_G) { }
                else if (facingId === C_R) rotSeq.push("y");
                else if (facingId === C_O) rotSeq.push("y'");
                else if (facingId === C_B) rotSeq.push("y2");
            } else if (crossId === C_R) {
                rotSeq.push("z"); 
                pattern = [C_G, C_W, C_B, C_Y];
                if (facingId === C_G) { }
                else if (facingId === C_W) rotSeq.push("y");  
                else if (facingId === C_B) rotSeq.push("y2");
                else if (facingId === C_Y) rotSeq.push("y'"); 
            } else if (crossId === C_O) {
                rotSeq.push("z'");
                pattern = [C_G, C_Y, C_B, C_W];
                if (facingId === C_G) { }
                else if (facingId === C_Y) rotSeq.push("y");  
                else if (facingId === C_B) rotSeq.push("y2");
                else if (facingId === C_W) rotSeq.push("y'"); 
            } else if (crossId === C_G) {
                rotSeq.push("x'");
                pattern = [C_W, C_R, C_Y, C_O];
                if (facingId === C_W) { }
                else if (facingId === C_R) rotSeq.push("y");
                else if (facingId === C_Y) rotSeq.push("y2");
                else if (facingId === C_O) rotSeq.push("y'");
            } else if (crossId === C_B) {
                rotSeq.push("x");
                pattern = [C_Y, C_R, C_W, C_O];
                if (facingId === C_Y) { }
                else if (facingId === C_R) rotSeq.push("y");  
                else if (facingId === C_W) rotSeq.push("y2"); 
                else if (facingId === C_O) rotSeq.push("y'"); 
            }
            
            const edges = readAndTransformState(crossId, rotSeq);
            
            if(edges.length !== 4) { 
                text.innerText = `錯誤：找到 ${edges.length} 個邊塊。請檢查填色。`; 
                text.style.color = "var(--danger-color)"; 
                return; 
            }

            const startIdx = pattern.indexOf(facingId);
            const order = [ pattern[startIdx], pattern[(startIdx+1)%4], pattern[(startIdx+2)%4], pattern[(startIdx+3)%4] ];

            let startState = 0;
            for(let i=0; i<4; i++) {
                const e = edges.find(x => x.targetColor === order[i]);
                if(!e) {
                    text.innerText = `配置錯誤：找不到側面邊塊。`; 
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
                
                let resultDisplay = bestPath.length === 0 ? "無需移動" : bestPath.join(" ");
                let prefixStr = rotSeq.join(" ");
                
                // 顯示結果
                text.innerText = (prefixStr ? `(${prefixStr}) ` : "") + resultDisplay;
                text.style.color = "var(--accent-color)";

                // 如果是手動填色，生成一個"相對於該視角"的打亂供參考
                // 如果是 WCA 打亂模式，則保留原本的 WCA 打亂字串
                if (!currentScrambleStr) {
                    let generatedScramble = generateScrambleText(bestPath, prefixStr);
                    scrambleText.innerText = "打亂: " + generatedScramble;
                }

                // --- 計算反向公式 (Inverses) ---
                const scrambleAlg = new Alg(currentScrambleStr || "");
                const solutionAlg = new Alg(bestPath.join(" "));
                
                // 1. 打亂的反向
                const inverseScramble = currentScrambleStr ? scrambleAlg.invert().toString() : "無";
                
                // 2. 底十字的反向 (含 Rotation 的明確指示)
                // 用戶要求：反向公式的開頭該用x,y,z翻面的也要寫清楚
                // 解法過程是：[Rotation] -> [Solution]
                // 反向過程是：[Solution Inverse] -> [Rotation Inverse]
                const rotAlg = new Alg(prefixStr);
                const inverseRot = prefixStr ? rotAlg.invert().toString() : "";
                const inverseSol = solutionAlg.invert().toString();
                
                let crossInverseStr = "";
                if (resultDisplay === "無需移動") {
                    crossInverseStr = inverseRot || "無";
                } else {
                    crossInverseStr = `${inverseSol} ${inverseRot}`.trim();
                }

                inverseText.innerHTML = 
                    `打亂公式反向: <span style="color:#fff">${inverseScramble}</span>\n` +
                    `底十字反向: <span style="color:#fff">${crossInverseStr}</span>`;

                // --- 更新 Twisty Player ---
                if(player) {
                    // 策略：
                    // Setup Alg: 總是設為 [WCA打亂] (如果有的話)。這會讓方塊回到 W/G 起始的打亂態。
                    // Alg: [Rotation] + [Solution]。這樣動畫會演示：先翻面，再解題。
                    
                    // 如果沒有 WCA 打亂 (手動填色模式)，我們必須使用舊邏輯 (生成逆向打亂)
                    if (!currentScrambleStr) {
                         let inverseRot = prefixStr ? new Alg(prefixStr).invert().toString() : "";
                         let inverseSol = bestPath.length > 0 ? new Alg(bestPath.join(" ")).invert().toString() : "";
                         let setupAlg = [prefixStr, inverseSol, inverseRot].join(" ");
                         
                         player.experimentalSetupAlg = setupAlg;
                         player.alg = (prefixStr ? prefixStr + " " : "") + (bestPath.join(" "));
                    } else {
                        // WCA 打亂模式
                        player.experimentalSetupAlg = currentScrambleStr;
                        player.alg = (prefixStr ? prefixStr + " " : "") + (bestPath.join(" "));
                    }
                    
                    player.timestamp = 0;
                    player.play();
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
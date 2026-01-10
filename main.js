import { FACE_COLORS, PALETTE, UI_COLOR_LABELS, FACING_MAP, getHexId, COLOR_CODES } from './constants.js';
import { calculateSolution, generateScramble, invertAlg } from './solver.js';
import { CameraScanner } from './camera.js';

let scene, camera, renderer, cubeGroup;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let isAnimating = false;
let targetRotX = 0; 
let targetRotY = 0;
let currentColorHex = 0xFFFFFF;

// 掃描狀態管理
let scanStep = 0;
let isScanFrozen = false; // 是否已鎖定預覽
let frozenColors = []; // 暫存鎖定時的顏色

// 定義掃描順序與方向指引
// rot: 3D模型旋轉角度; instruction: 顯示在螢幕上的文字提示
const SCAN_SEQUENCE = [
    { face: 'U', name: '頂面 (白色中心)', rot: { x: Math.PI/2, y: 0 }, instruction: '⬇️ 綠色中心塊在 前 (下面)' },
    { face: 'F', name: '前面 (綠色中心)', rot: { x: 0, y: 0 }, instruction: '⬆️ 白色中心塊在 上' },
    { face: 'R', name: '右面 (紅色中心)', rot: { x: 0, y: -Math.PI/2 }, instruction: '⬆️ 白色中心塊在 上' },
    { face: 'B', name: '後面 (藍色中心)', rot: { x: 0, y: Math.PI }, instruction: '⬆️ 白色中心塊在 上' },
    { face: 'L', name: '左面 (橘色中心)', rot: { x: 0, y: Math.PI/2 }, instruction: '⬆️ 白色中心塊在 上' },
    { face: 'D', name: '底面 (黃色中心)', rot: { x: -Math.PI/2, y: 0 }, instruction: '⬆️ 綠色中心塊在 前 (上面)' }
];

const cameraScanner = new CameraScanner();
let scanFrameId = null; // 用於 requestAnimationFrame

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
    
    // UI Setup
    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    setupPalette();
    setupRotateButtons();
    updateFacingOptions();
    
    // Bind Buttons
    document.getElementById('btn-solve').onclick = runSolver;
    document.getElementById('btn-reset').onclick = resetColors;
    document.getElementById('btn-scan').onclick = startScanningSession;
    
    document.getElementById('cross-color').onchange = updateFacingOptions;
    document.getElementById('facing-color').onchange = handleModeChange;

    // 初始位置
    cubeGroup.rotation.x = 0.2;
    cubeGroup.rotation.y = -0.3;
    targetRotX = 0.2;
    targetRotY = -0.3;

    // 全局暴露相機控制函數
    window.closeCamera = () => {
        stopScanLoop();
        cameraScanner.stop();
        rotateViewTo(0.2, -0.3); // 恢復預設視角
    };
    window.freezeScan = freezeScanPreview;
    window.retryScan = unfreezeScanPreview;
    window.confirmScan = confirmAndNextStep;
}

function createCube() {
    cubeGroup = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.94, 0.94, 0.94); 
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); 
    const getMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.05 });

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
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation(); 
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
    targetRotX += dx;
    targetRotY += dy;
    rotateViewTo(targetRotX, targetRotY);
}

// 絕對角度旋轉
function rotateViewTo(x, y) {
    isAnimating = true;
    new TWEEN.Tween(cubeGroup.rotation).to({ x: x, y: y }, 500)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onComplete(() => isAnimating = false)
        .start();
    targetRotX = x;
    targetRotY = y;
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
    if (validOptions.includes(currentFacing)) facingSelect.value = currentFacing;
    else facingSelect.value = validOptions[0];
    handleModeChange();
}

function handleModeChange() {
    const text = document.getElementById('solution-text');
    text.innerText = "設定已變更，請按計算";
    text.style.color = "#FFD60A";
    document.getElementById('scramble-text').innerText = "";
}

function resetColors() {
    scene.remove(cubeGroup);
    createCube();
    targetRotX = 0.2;
    targetRotY = -0.3;
    cubeGroup.rotation.x = targetRotX;
    cubeGroup.rotation.y = targetRotY;
    document.getElementById('solution-text').innerText = "已重置";
    document.getElementById('solution-text').style.color = "#FFD60A";
    document.getElementById('scramble-text').innerText = "";
    const player = document.getElementById('solution-player');
    if(player) { player.alg = ""; player.experimentalSetupAlg = ""; player.timestamp = 0; }
}

function runSolver() {
    const text = document.getElementById('solution-text');
    const scrambleText = document.getElementById('scramble-text');
    const player = document.getElementById('solution-player');
    
    const crossSelect = document.getElementById('cross-color').value;
    const facingSelect = document.getElementById('facing-color').value;

    const parseColor = (val) => {
        const map = {'W': COLOR_CODES.C_W, 'Y': COLOR_CODES.C_Y, 'R': COLOR_CODES.C_R, 'O': COLOR_CODES.C_O, 'G': COLOR_CODES.C_G, 'B': COLOR_CODES.C_B};
        return map[val];
    };
    
    const crossId = parseColor(crossSelect);
    const facingId = parseColor(facingSelect);

    if (crossId === facingId) {
        text.innerText = "底色與正面不能相同";
        text.style.color = "var(--danger-color)";
        return;
    }

    text.innerText = "計算中...";
    scrambleText.innerText = "";
    text.style.color = "#FFD60A";

    setTimeout(() => {
        try {
            const { path, rotSeq } = calculateSolution(cubeGroup, crossId, facingId);
            
            let resultDisplay = path.length === 0 ? "無需移動" : path.join(" ");
            let resultAlg = path.length === 0 ? "" : path.join(" ");
            let prefixStr = rotSeq.join(" ");
            
            text.innerText = (prefixStr ? `(${prefixStr}) ` : "") + resultDisplay;
            text.style.color = "var(--accent-color)";
            
            let scramble = generateScramble(path, prefixStr);
            scrambleText.innerText = "打亂: " + scramble;

            if(player) {
                let fullAlgForPlayer = (prefixStr ? prefixStr + " " : "") + resultAlg;
                let inverseRot = invertAlg(rotSeq);
                let inverseSol = invertAlg(path);
                let setupParts = [];
                if (prefixStr) setupParts.push(prefixStr);
                if (inverseSol) setupParts.push(inverseSol);
                if (inverseRot) setupParts.push(inverseRot);
                player.alg = fullAlgForPlayer;
                player.experimentalSetupAlg = setupParts.join(" ");
                player.timestamp = 0;
            }
        } catch(e) {
            text.innerText = e.message;
            text.style.color = "var(--danger-color)";
        }
    }, 50);
}

// ==========================================
// 相機掃描邏輯 (Real-time & Preview)
// ==========================================

function startScanningSession() {
    scanStep = 0;
    isScanFrozen = false;
    updateScanUI();
    cameraScanner.start().then(() => {
        startScanLoop();
    });
    // 立即旋轉到第一面
    const current = SCAN_SEQUENCE[scanStep];
    rotateViewTo(current.rot.x, current.rot.y);
}

// 啟動即時預覽循環
function startScanLoop() {
    if (scanFrameId) cancelAnimationFrame(scanFrameId);
    
    const loop = () => {
        if (!isScanFrozen) {
            // 只有未鎖定時才更新
            const colors = cameraScanner.getScanColors();
            if (colors) {
                updateGridPreview(colors);
                frozenColors = colors; // 隨時緩存當前顏色，以便鎖定
            } else {
                // 若相機跑掉或無數據，清空預覽
                updateGridPreview(null);
            }
        }
        scanFrameId = requestAnimationFrame(loop);
    };
    scanFrameId = requestAnimationFrame(loop);
}

function stopScanLoop() {
    if (scanFrameId) cancelAnimationFrame(scanFrameId);
    scanFrameId = null;
}

// 更新 HTML 九宮格的背景顏色
function updateGridPreview(colors) {
    const cells = document.querySelectorAll('#preview-grid div');
    
    if (!colors) {
        cells.forEach(cell => cell.style.backgroundColor = 'transparent');
        return;
    }

    cells.forEach((cell, idx) => {
        // 將 int color 轉為 css hex string
        const hex = '#' + colors[idx].toString(16).padStart(6, '0');
        // 加一點透明度讓它看起來像 AR 覆蓋
        cell.style.backgroundColor = hex + 'CC'; // CC = 80% opacity
    });
}

// UI 動作：鎖定預覽
function freezeScanPreview() {
    // 檢查是否有有效顏色
    if (!frozenColors || frozenColors.length !== 9) {
        alert("未檢測到顏色，請將魔術方塊對準中心");
        return;
    }
    isScanFrozen = true;
    
    // 切換按鈕顯示
    document.getElementById('cam-ctrl-scan').style.display = 'none';
    document.getElementById('cam-ctrl-confirm').style.display = 'flex';
}

// UI 動作：重掃 (解除鎖定)
function unfreezeScanPreview() {
    isScanFrozen = false;
    frozenColors = [];
    document.getElementById('cam-ctrl-scan').style.display = 'flex';
    document.getElementById('cam-ctrl-confirm').style.display = 'none';
}

// UI 動作：確認並下一步
function confirmAndNextStep() {
    if (!frozenColors) return;

    // 1. 將鎖定的顏色應用到 3D 模型
    applyColorsToFace(frozenColors);

    // 2. 重置狀態進入下一步
    isScanFrozen = false;
    scanStep++;
    
    // 恢復按鈕狀態
    document.getElementById('cam-ctrl-scan').style.display = 'flex';
    document.getElementById('cam-ctrl-confirm').style.display = 'none';

    if (scanStep < 6) {
        const next = SCAN_SEQUENCE[scanStep];
        rotateViewTo(next.rot.x, next.rot.y);
        updateScanUI();
    } else {
        // 結束
        stopScanLoop();
        window.closeCamera();
        handleModeChange();
        setTimeout(() => alert("掃描完成！請檢查顏色是否正確，然後按「開始計算」"), 300);
    }
}

function updateScanUI() {
    const title = document.getElementById('scan-step-title');
    const desc = document.getElementById('scan-step-desc');
    const instruction = document.getElementById('scan-instruction');
    const dots = document.querySelectorAll('#scan-dots span');
    
    if (scanStep < 6) {
        const info = SCAN_SEQUENCE[scanStep];
        title.innerText = `掃描: ${info.name}`;
        desc.innerText = "對準後按「鎖定顏色」";
        instruction.innerText = info.instruction; // 更新方向提示
        
        dots.forEach((dot, idx) => {
            if (idx === scanStep) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }
}

function applyColorsToFace(colors) {
    const range = 0.5; 
    const points = [
        {x: -range, y: range}, {x: 0, y: range}, {x: range, y: range},
        {x: -range, y: 0},     {x: 0, y: 0},     {x: range, y: 0},
        {x: -range, y: -range},{x: 0, y: -range},{x: range, y: -range}
    ];

    points.forEach((pt, index) => {
        raycaster.setFromCamera(pt, camera);
        const intersects = raycaster.intersectObjects(cubeGroup.children);
        
        if (intersects.length > 0) {
            const hit = intersects.find(h => {
                const mIdx = h.face.materialIndex;
                return h.object.material[mIdx].color.getHex() !== 0x000000;
            });

            if (hit) {
                const matIndex = hit.face.materialIndex;
                hit.object.material[matIndex].color.setHex(colors[index]);
            }
        }
    });
}
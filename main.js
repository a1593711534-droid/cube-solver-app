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
// 定義掃描順序: 上(U) -> 前(F) -> 右(R) -> 後(B) -> 左(L) -> 下(D)
// 對應的 3D 旋轉角度 (使該面正對相機)
const SCAN_SEQUENCE = [
    { face: 'U', name: '頂面 (白色中心)', rot: { x: Math.PI/2, y: 0 } },
    { face: 'F', name: '前面 (綠色中心)', rot: { x: 0, y: 0 } },
    { face: 'R', name: '右面 (紅色中心)', rot: { x: 0, y: -Math.PI/2 } },
    { face: 'B', name: '後面 (藍色中心)', rot: { x: 0, y: Math.PI } },
    { face: 'L', name: '左面 (橘色中心)', rot: { x: 0, y: Math.PI/2 } },
    { face: 'D', name: '底面 (黃色中心)', rot: { x: -Math.PI/2, y: 0 } }
];

const cameraScanner = new CameraScanner();

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

    // 將相機功能暴露給全局
    window.closeCamera = () => {
        cameraScanner.stop();
        // 恢復預設視角
        rotateViewTo(0.2, -0.3);
    };
    window.captureFace = processScanStep;
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

// 絕對角度旋轉 (用於相機模式)
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
// 相機掃描邏輯 (Wizard Mode)
// ==========================================

function startScanningSession() {
    scanStep = 0;
    updateScanUI();
    cameraScanner.start();
    // 立即旋轉到第一面 (U)
    const current = SCAN_SEQUENCE[scanStep];
    rotateViewTo(current.rot.x, current.rot.y);
}

function updateScanUI() {
    const title = document.getElementById('scan-step-title');
    const desc = document.getElementById('scan-step-desc');
    const btn = document.getElementById('btn-capture');
    const dots = document.querySelectorAll('#scan-dots span');
    
    if (scanStep < 6) {
        const info = SCAN_SEQUENCE[scanStep];
        title.innerText = `掃描: ${info.name}`;
        desc.innerText = "請將中心塊對準九宮格中央";
        btn.innerText = "📸 掃描並下一步";
        
        // 更新進度點
        dots.forEach((dot, idx) => {
            if (idx === scanStep) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    } else {
        // 完成
        window.closeCamera();
        handleModeChange();
        setTimeout(() => alert("掃描完成！請檢查顏色是否正確，然後按「開始計算」"), 300);
    }
}

function processScanStep() {
    // 1. 獲取相機顏色
    const colors = cameraScanner.capture();
    if (!colors) return;

    // 2. 將顏色應用到當前正對相機的那一面
    // 由於我們在 startScanningSession 和 nextStep 時已經旋轉了 cubeGroup
    // 所以直接用 Raycaster 打向螢幕中心即可命中正確的 Facelets
    applyColorsToFace(colors);

    // 3. 進入下一步
    scanStep++;
    if (scanStep < 6) {
        // 旋轉到下一面
        const next = SCAN_SEQUENCE[scanStep];
        rotateViewTo(next.rot.x, next.rot.y);
        updateScanUI();
    } else {
        // 結束
        updateScanUI();
        // 轉回預設視角方便檢查
        rotateViewTo(0.2, -0.3);
    }
}

function applyColorsToFace(colors) {
    // 定義九宮格的螢幕空間座標 (NDC)
    // 這些座標對應螢幕上的九個點
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
            // 找到第一個非黑色的面 (即貼紙面)
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
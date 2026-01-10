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
    document.getElementById('btn-scan').onclick = openCamera;
    
    document.getElementById('cross-color').onchange = updateFacingOptions;
    document.getElementById('facing-color').onchange = handleModeChange;

    // 初始位置
    cubeGroup.rotation.x = 0.2;
    cubeGroup.rotation.y = -0.3;
    targetRotX = 0.2;
    targetRotY = -0.3;

    // 將相機功能暴露給全局 (供 inline onclick 使用)
    window.closeCamera = () => cameraScanner.stop();
    window.captureFace = applyScannedColors;
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

// --- 相機整合 ---
function openCamera() {
    cameraScanner.start();
}

function applyScannedColors() {
    const colors = cameraScanner.capture();
    if (!colors) return;
    cameraScanner.stop();

    // 邏輯：掃描到的 9 個顏色，需要填入目前 3D 視圖中「正對鏡頭」的那一面
    // 透過 Raycaster 發射 9 條射線來尋找對應的 Facelets
    
    // 定義九宮格的螢幕空間座標 (Normalized Device Coordinates)
    // 順序：左上, 中上, 右上, 左中, 中中, 右中, 左下, 中下, 右下
    // 假設模型占據螢幕大部分，稍微縮小範圍以確保射線打在貼紙上
    const range = 0.5; 
    const points = [
        {x: -range, y: range}, {x: 0, y: range}, {x: range, y: range},
        {x: -range, y: 0},     {x: 0, y: 0},     {x: range, y: 0},
        {x: -range, y: -range},{x: 0, y: -range},{x: range, y: -range}
    ];

    points.forEach((pt, index) => {
        raycaster.setFromCamera(pt, camera);
        const intersects = raycaster.intersectObjects(cubeGroup.children);
        
        // 找到最近的一個面
        if (intersects.length > 0) {
            // 過濾掉黑色內核，只抓有顏色的貼紙
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

    handleModeChange(); // 提示需重新計算
}
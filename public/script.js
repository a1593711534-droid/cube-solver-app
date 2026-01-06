// 當前選擇的顏色 (邏輯顏色)
let currentColor = 'white';

// 顏色映射表，白朝上，綠朝我，黃色為底面
const colorMap = {
  'white': 'U',   // 上
  'red': 'R',     // 右
  'green': 'F',   // 前
  'yellow': 'D',  // 下
  'orange': 'L',  // 左
  'blue': 'B'     // 後
};

// 視覺顏色映射 (美化用) - 對應 CSS 變數或 Hex
const displayColors = {
  'white': '#F5F5F5',
  'red': '#FF5252',
  'green': '#26C281',
  'yellow': '#FFD32A',
  'orange': '#FF9F43',
  'blue': '#3498DB'
};

// 初始化魔方面
let cube = {
  U: Array(9).fill('white'),
  R: Array(9).fill('red'),
  F: Array(9).fill('green'),
  D: Array(9).fill('yellow'),
  L: Array(9).fill('orange'),
  B: Array(9).fill('blue'),
};

// 相機掃描相關變數
let stream = null;
let currentFaceIndex = 0;
const faceOrder = ['U', 'R', 'F', 'D', 'L', 'B'];
const faceIndicators = {
  U: 'U (上)', R: 'R (右)', F: 'F (前)',
  D: 'D (下)', L: 'L (左)', B: 'B (後)'
};

// 儲存解法結果與打亂狀態
let solutions = {
  restore: '',
  reverse: '',
  whiteCross: '',
  scramble: ''
};

// 畫出魔方六面
function renderCube() {
  for (let face in cube) {
    const faceElement = document.getElementById(face);
    if (!faceElement) {
      console.error(`Face element ${face} not found!`);
      return;
    }
    const faceColors = cube[face];
    faceElement.innerHTML = '';
    faceColors.forEach(color => {
      const colorDiv = document.createElement('div');
      colorDiv.classList.add('color-square');
      // 使用視覺顏色進行渲染，但保留邏輯顏色
      colorDiv.style.backgroundColor = displayColors[color] || color;
      faceElement.appendChild(colorDiv);
    });
  }
  document.getElementById('cubeStringContent').innerText = getCubeString();
}

// 設定選擇的顏色並更新界面
function setColor(color) {
  currentColor = color;
  // 更新按鈕選取狀態
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === color);
  });
}

// 更新魔方顏色
function updateColor(face, index) {
  cube[face][index] = currentColor;
  renderCube();
}

// 將魔方顏色轉換為 kociemba 所需的單字符字串
function getCubeString() {
  const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
  let cubeString = '';
  faces.forEach(face => {
    cube[face].forEach(color => {
      cubeString += colorMap[color] || 'X';
    });
  });
  // console.log('Generated cubeString:', cubeString);
  return cubeString;
}

// 當用戶點擊魔方面上的格子時，更新顏色
document.querySelectorAll('.face').forEach(face => {
  face.addEventListener('click', (event) => {
    const faceId = event.currentTarget.id;
    const clickedSquare = event.target;
    if (clickedSquare.classList.contains('color-square')) {
      const index = Array.from(face.children).indexOf(clickedSquare);
      updateColor(faceId, index);
    }
  });
});

// --- 紀錄管理邏輯 ---

function loadRecords() {
  const records = JSON.parse(localStorage.getItem('crossRecords')) || [];
  const recordBoxes = document.getElementById('record-boxes');
  recordBoxes.innerHTML = '';
  
  if (records.length === 0) {
    recordBoxes.innerHTML = '<div class="empty-state">尚無紀錄</div>';
    toggleClearButtonVisibility(0);
    return;
  }

  records.forEach((record, index) => {
    const box = document.createElement('div');
    box.className = 'record-box';
    box.innerText = `紀錄 #${index + 1}`;
    box.addEventListener('click', () => loadRecord(record));
    recordBoxes.appendChild(box);
  });
  toggleClearButtonVisibility(records.length);
}

function toggleClearButtonVisibility(recordCount) {
  const clearButton = document.querySelector('.clear-records-btn');
  if (clearButton) {
    clearButton.style.display = recordCount > 0 ? 'inline-block' : 'none';
  }
}

function addRecord() {
  const records = JSON.parse(localStorage.getItem('crossRecords')) || [];
  const record = {
    cube: JSON.parse(JSON.stringify(cube)),
    cubeString: getCubeString(),
    solutions: JSON.parse(JSON.stringify(solutions))
  };
  records.push(record);
  localStorage.setItem('crossRecords', JSON.stringify(records));
  loadRecords();
}

function loadRecord(record) {
  cube = record.cube;
  renderCube();
  solutions = record.solutions;
  updateFormulaDisplay();
  updateAnimation();
  
  // 自動捲動到結果區
  document.getElementById('result-container').classList.remove('hidden');
}

function clearRecords() {
  if (confirm('確定要清除所有紀錄嗎？')) {
    localStorage.removeItem('crossRecords');
    loadRecords();
  }
}

// --- Cross-Solver-V2 邏輯 (保留原樣) ---

const crossPieces = { w: 'UF', x: 'UL', y: 'UB', z: 'UR' };
const crossColor = { w: 'green', x: 'orange', y: 'blue', z: 'red' };
const MOVE_TABLES = {
  "U": {"UF":"UL","UL":"UB","UB":"UR","UR":"UF","FU":"LU","LU":"BU","BU":"RU","RU":"FU"},
  "U'":{"UF":"UR","UR":"UB","UB":"UL","UL":"UF","FU":"RU","RU":"BU","BU":"LU","LU":"FU"},
  "U2":{"UF":"UB","UB":"UF","UL":"UR","UR":"UL","FU":"BU","BU":"FU","LU":"RU","RU":"LU"},
  "D": {"DF":"DR","DR":"DB","DB":"DL","DL":"DF","FD":"RD","RD":"BD","BD":"LD","LD":"FD"},
  "D'":{"DF":"DL","DL":"DB","DB":"DR","DR":"DF","FD":"LD","LD":"BD","BD":"RD","RD":"FD"},
  "D2":{"DF":"DB","DB":"DF","DR":"DL","DL":"DR","FD":"BD","BD":"FD","RD":"LD","LD":"RD"},
  "F": {"FU":"FR","FR":"FD","FD":"FL","FL":"FU","UF":"RF","RF":"DF","DF":"LF","LF":"UF"},
  "F'":{"FU":"FL","FL":"FD","FD":"FR","FR":"FU","UF":"LF","LF":"DF","DF":"RF","RF":"UF"},
  "F2":{"FU":"FD","FD":"FU","FR":"FL","FL":"FR","UF":"DF","DF":"UF","RF":"LF","LF":"RF"},
  "B": {"BU":"BL","BL":"BD","BD":"BR","BR":"BU","UB":"LB","LB":"DB","DB":"RB","RB":"UB"},
  "B'":{"BU":"BR","BR":"BD","BD":"BL","BL":"BU","UB":"RB","RB":"DB","DB":"LB","LB":"UB"},
  "B2":{"BU":"BD","BD":"BU","BR":"BL","BL":"BR","UB":"DB","DB":"UB","RB":"LB","LB":"RB"},
  "R": {"RU":"RB","RB":"RD","RD":"RF","RF":"RU","UR":"BR","BR":"DR","DR":"FR","FR":"UR"},
  "R'":{"RU":"RF","RF":"RD","RD":"RB","RB":"RU","UR":"FR","FR":"DR","DR":"BR","BR":"UR"},
  "R2":{"RU":"RD","RD":"RU","RF":"RB","RB":"RF","UR":"DR","DR":"UR","FR":"BR","BR":"FR"},
  "L": {"LU":"LF","LF":"LD","LD":"LB","LB":"LU","UL":"FL","FL":"DL","DL":"BL","BL":"UL"},
  "L'":{"LU":"LB","LB":"LD","LD":"LF","LF":"LU","UL":"BL","BL":"DL","DL":"FL","FL":"UL"},
  "L2":{"LU":"LD","LD":"LU","LF":"LB","LB":"LF","UL":"DL","DL":"UL","FL":"BL","BL":"FL"}
};

let solutionTable = {};
fetch('/complete_cross_solutions.json')
  .then(r => r.json())
  .then(bigData => {
    const arr = bigData.results || bigData;
    arr.forEach(row => {
      let key = `${row.w}_${row.x}_${row.y}_${row.z}`;
      solutionTable[key] = row.Solution;
    });
    console.log('Solutions loaded:', Object.keys(solutionTable).length);
  })
  .catch(err => console.error('JSON load error:', err));

function applyMove(state, move) {
  const perm = MOVE_TABLES[move];
  let newState = {};
  for (let key in state) {
    newState[key] = perm[state[key]] || state[key];
  }
  return newState;
}

function applyScramble(state, scramble) {
  const moves = scramble.replace(/\s+/g, '').match(/([URFDLB]2?'?)/g) || [];
  for (const move of moves) {
    if (!(move in MOVE_TABLES)) throw new Error('Invalid move: ' + move);
    state = applyMove(state, move);
  }
  return state;
}

function normalizeScramble(raw) {
  const sequence = raw.replace(/\s+/g, '').match(/([URFDLB])('?|2)?/g);
  if (!sequence) return '';
  const optimized = [];
  let i = 0;
  while (i < sequence.length) {
    const face = sequence[i][0];
    let count = 0;
    while (i < sequence.length && sequence[i][0] === face) {
      const mod = sequence[i].slice(1);
      if (mod === "'") count += 3;
      else if (mod === "2") count += 2;
      else count += 1;
      i++;
    }
    count %= 4;
    if (count === 1) optimized.push(face);
    else if (count === 2) optimized.push(face + '2');
    else if (count === 3) optimized.push(face + "'");
  }
  return optimized.join(' ');
}

function solveWhiteCross(scramble) {
  try {
    const normalized = normalizeScramble(scramble);
    if (!normalized.match(/^([URFDLB]2?'?)(\s([URFDLB]2?'?))*$/)) throw new Error('Invalid scramble');
    const finalState = applyScramble({ ...crossPieces }, normalized);
    const key = `${finalState.w}_${finalState.x}_${finalState.y}_${finalState.z}`;
    const solution = solutionTable[key];
    if (!solution) throw new Error(`Solution not found for state: ${key}`);
    return solution;
  } catch (e) {
    console.error('白十字計算失敗：', e);
    return `白十字計算失敗：${e.message}`;
  }
}

function updateFormulaDisplay() {
  const select = document.getElementById('animation-select');
  const resultDiv = document.getElementById('result');
  const resultContainer = document.getElementById('result-container');
  const selectedValue = select.value;

  let title = '';
  let formula = '';

  switch (selectedValue) {
    case 'restore':
      title = '還原步驟';
      formula = solutions.restore;
      break;
    case 'reverse':
      title = '打亂步驟';
      formula = solutions.reverse;
      break;
    case 'white-cross':
      title = '白底十字步驟';
      formula = solutions.whiteCross;
      break;
  }

  if (formula) {
    resultDiv.innerHTML = `<span class="title">${title}</span><br><span class="formula">${formula}</span>`;
    resultContainer.classList.remove('hidden');
  } else {
    resultDiv.innerHTML = '';
    resultContainer.classList.add('hidden');
  }
}

async function getCubeSolution() {
  const cubeString = getCubeString();
  const resultDiv = document.getElementById('result');
  const resultContainer = document.getElementById('result-container');
  const twistyPlayer = document.getElementById('twisty-player');

  if (cubeString.length !== 54) {
    alert('請輸入正確的魔方顏色字串（54個字）');
    return;
  }

  resultContainer.classList.remove('hidden');
  resultDiv.innerText = '計算中...';

  try {
    const response = await fetch('/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cubeString }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`解法計算失敗：${errorText}`);
    }

    const data = await response.json();
    
    const cleanReverse = data.reversedSolution
      .replace(/[^UDLRFB'2\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    solutions.restore = data.solution.trim();
    solutions.reverse = cleanReverse || 'U';
    solutions.whiteCross = solveWhiteCross(solutions.reverse);
    solutions.scramble = solutions.reverse;

    if (solutions.whiteCross.includes('失敗')) {
      throw new Error('白十字解法計算失敗');
    }

    updateFormulaDisplay();
    updateAnimation();
    addRecord();
  } catch (error) {
    resultDiv.innerText = `錯誤：${error.message}`;
    twistyPlayer.setAttribute('alg', '');
  }
}

function updateAnimation() {
  const select = document.getElementById('animation-select');
  const twistyPlayer = document.getElementById('twisty-player');
  const selectedValue = select.value;

  twistyPlayer.removeAttribute('alg');
  twistyPlayer.removeAttribute('experimental-setup-alg');
  twistyPlayer.removeAttribute('camera-position');

  switch (selectedValue) {
    case 'restore':
      twistyPlayer.setAttribute('experimental-setup-alg', solutions.reverse);
      twistyPlayer.setAttribute('alg', solutions.restore);
      break;
    case 'reverse':
      twistyPlayer.setAttribute('experimental-setup-alg', '');
      twistyPlayer.setAttribute('alg', solutions.reverse);
      break;
    case 'white-cross':
      twistyPlayer.setAttribute('experimental-setup-alg', solutions.reverse);
      twistyPlayer.setAttribute('alg', solutions.whiteCross);
      twistyPlayer.setAttribute('camera-position', 'bottom-front-right');
      break;
  }
  
  twistyPlayer.timestamp = 0;
  twistyPlayer.pause();
  updateFormulaDisplay();
}

// --- 相機邏輯 (已還原至最嚴謹的原始版本) ---

async function startCamera() {
  currentFaceIndex = 0;
  const video = document.getElementById('video');
  const cameraContainer = document.getElementById('camera-container');
  const faceIndicator = document.getElementById('face-indicator');
  const gridCanvas = document.getElementById('grid-canvas');

  try {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    // 使用 environment facing mode
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;

    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        // 設定 Canvas 尺寸與 Video 渲染尺寸一致
        const w = video.videoWidth;
        const h = video.videoHeight;
        gridCanvas.width = w;
        gridCanvas.height = h;
        resolve();
      };
    });

    cameraContainer.style.display = 'block';
    faceIndicator.innerText = faceIndicators[faceOrder[currentFaceIndex]];
    drawGrid();
    startRealTimeDetection();
  } catch (error) {
    alert('無法啟動相機，請檢查權限或設備。');
    console.error('Camera error:', error);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  document.getElementById('camera-container').style.display = 'none';
  currentFaceIndex = 0;
  stopRealTimeDetection();
}

function drawGrid() {
  const gridCanvas = document.getElementById('grid-canvas');
  const ctx = gridCanvas.getContext('2d');
  
  if (gridCanvas.width < 50 || gridCanvas.height < 50) return;
  
  ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;

  // 使用響應式計算確保在各裝置置中，但保留與後續計算一致的邏輯
  const size = Math.min(gridCanvas.width, gridCanvas.height) * 0.6;
  const gridSize = size / 3;
  const offsetX = (gridCanvas.width - size) / 2;
  const offsetY = (gridCanvas.height - size) / 2;

  // 畫井字
  for (let i = 1; i < 3; i++) {
    // 垂直線
    ctx.beginPath();
    ctx.moveTo(offsetX + i * gridSize, offsetY);
    ctx.lineTo(offsetX + i * gridSize, offsetY + size);
    ctx.stroke();
    // 水平線
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + i * gridSize);
    ctx.lineTo(offsetX + size, offsetY + i * gridSize);
    ctx.stroke();
  }
}

function captureFace() {
  const video = document.getElementById('video');
  const gridCanvas = document.getElementById('grid-canvas');
  
  const canvas = document.createElement('canvas');
  canvas.width = gridCanvas.width;
  canvas.height = gridCanvas.height;
  const ctx = canvas.getContext('2d');
  const faceIndicator = document.getElementById('face-indicator');

  if (!video.srcObject) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // 重新計算 Grid 參數
  const size = Math.min(canvas.width, canvas.height) * 0.6;
  const gridSize = size / 3;
  const offsetX = (canvas.width - size) / 2;
  const offsetY = (canvas.height - size) / 2;

  const colors = [];

  // [還原] 原始中心點檢測邏輯 (嚴格檢查亮度和飽和度)
  const centerPixelData = ctx.getImageData(offsetX + gridSize + gridSize * 0.25, offsetY + gridSize + gridSize * 0.25, gridSize * 0.5, gridSize * 0.5);
  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < centerPixelData.data.length; i += 4) {
    rSum += centerPixelData.data[i];
    gSum += centerPixelData.data[i + 1];
    bSum += centerPixelData.data[i + 2];
  }
  const count = centerPixelData.data.length / 4;
  const centerR = rSum / count;
  const centerG = gSum / count;
  const centerB = bSum / count;
  const [centerH, centerS, centerV] = rgbToHsv(centerR/255, centerG/255, centerB/255);
  
  if (centerV > 80 && centerS < 20) {
    alert('請先對準魔方再拍照！');
    return;
  }

  // [還原] 原始遍歷取樣邏輯 (取方格中央 50% 區域平均，非僅 10x10)
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const pixelData = ctx.getImageData(offsetX + x * gridSize + gridSize * 0.25, offsetY + y * gridSize + gridSize * 0.25, gridSize * 0.5, gridSize * 0.5);
      let rSum = 0, gSum = 0, bSum = 0;
      for (let i = 0; i < pixelData.data.length; i += 4) {
        rSum += pixelData.data[i];
        gSum += pixelData.data[i + 1];
        bSum += pixelData.data[i + 2];
      }
      const count = pixelData.data.length / 4;
      const r = rSum / count;
      const g = gSum / count;
      const b = bSum / count;
      // 注意: rgbToHsv 這裡原始碼預期 0-255 輸入，但我的 rgbToHsv 函數裡面有 /255。
      // 檢查原始碼: 原始 `rgbToHsv` 第一行是 `r /= 255`。所以這裡傳入 0-255 數值是對的。
      const color = detectColor(r, g, b);
      colors.push(color);
    }
  }

  const currentFace = faceOrder[currentFaceIndex];
  cube[currentFace] = colors;
  renderCube();

  currentFaceIndex++;
  if (currentFaceIndex < faceOrder.length) {
    faceIndicator.innerText = faceIndicators[faceOrder[currentFaceIndex]];
    const overlay = document.querySelector('.camera-overlay');
    overlay.style.backgroundColor = 'rgba(255,255,255,0.5)';
    setTimeout(() => overlay.style.backgroundColor = 'transparent', 100);
  } else {
    stopCamera();
    document.getElementById('cubeStringContent').innerText = getCubeString();
    alert('已完成所有面的掃描！請檢查顏色是否正確。');
  }
}

// 顏色檢測邏輯 (嚴格保留原始 HSV 範圍)
function detectColor(r, g, b) {
  const [h, s, v] = rgbToHsv(r, g, b);
  const colorRanges = {
    'orange': { h: [5, 25], s: [20, 100], v: [30, 100] },
    'red': { h: [350, 5], s: [40, 100], v: [20, 100] },
    'yellow': { h: [50, 70], s: [50, 100], v: [70, 100] },
    'green': { h: [100, 150], s: [50, 100], v: [30, 100] },
    'blue': { h: [210, 270], s: [50, 100], v: [30, 100] },
    'white': { h: [0, 360], s: [0, 10], v: [90, 100] }
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
  return 'white';
}

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

// 自動檢測邏輯 (還原精確取樣)
let animationFrameId = null;
function startRealTimeDetection() {
  const video = document.getElementById('video');
  const gridCanvas = document.getElementById('grid-canvas');
  const ctx = gridCanvas.getContext('2d');
  
  const tempCanvas = document.createElement('canvas');
  
  let frameCount = 0;
  const requiredFrames = 30; // 穩定幀數
  let lastColors = null;

  function detectAndDraw() {
    if (!video.srcObject || !document.getElementById('camera-container').offsetParent) return;

    if (tempCanvas.width !== gridCanvas.width) {
      tempCanvas.width = gridCanvas.width;
      tempCanvas.height = gridCanvas.height;
    }
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    
    drawGrid();

    const size = Math.min(gridCanvas.width, gridCanvas.height) * 0.6;
    const gridSize = size / 3;
    const offsetX = (gridCanvas.width - size) / 2;
    const offsetY = (gridCanvas.height - size) / 2;

    const colors = [];
    let isAllWhite = true;

    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        // [還原] 使用大面積取樣 (gridSize * 0.5) 提高即時偵測準確度
        const pixelData = tempCtx.getImageData(offsetX + x * gridSize + gridSize * 0.25, offsetY + y * gridSize + gridSize * 0.25, gridSize * 0.5, gridSize * 0.5);
        
        let rSum=0, gSum=0, bSum=0;
        for (let i=0; i<pixelData.data.length; i+=4) {
          rSum+=pixelData.data[i]; gSum+=pixelData.data[i+1]; bSum+=pixelData.data[i+2];
        }
        const count = pixelData.data.length / 4;
        const r = rSum/count, g = gSum/count, b = bSum/count;
        const [h, s, v] = rgbToHsv(r, g, b); // 這裡 r,g,b 是 0-255，傳入 rgbToHsv 正常
        const color = detectColor(r, g, b);
        colors.push(color);

        if (color !== 'white' || s > 20) isAllWhite = false;

        ctx.strokeStyle = displayColors[color] || color;
        ctx.lineWidth = 4;
        ctx.strokeRect(offsetX + x * gridSize + 4, offsetY + y * gridSize + 4, gridSize - 8, gridSize - 8);
      }
    }

    if (lastColors && colors.every((c, i) => c === lastColors[i])) {
      frameCount++;
      if (frameCount >= requiredFrames && !isAllWhite) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        showConfirmationButtons(colors);
        return;
      }
    } else {
      frameCount = 0;
      const btnContainer = document.getElementById('button-container');
      if (btnContainer) btnContainer.remove();
    }

    lastColors = [...colors];
    animationFrameId = requestAnimationFrame(detectAndDraw);
  }

  animationFrameId = requestAnimationFrame(detectAndDraw);
}

function stopRealTimeDetection() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  document.getElementById('button-container')?.remove();
}

function showConfirmationButtons(colors) {
  const dynamicArea = document.getElementById('dynamic-confirm-area');
  let buttonContainer = document.getElementById('button-container');
  if (buttonContainer) buttonContainer.remove();

  buttonContainer = document.createElement('div');
  buttonContainer.id = 'button-container';
  
  const confirmButton = document.createElement('button');
  confirmButton.innerText = '✅';
  confirmButton.className = 'capture-btn';
  confirmButton.onclick = () => {
    cube[faceOrder[currentFaceIndex]] = colors;
    renderCube();
    buttonContainer.remove();
    currentFaceIndex++;
    if (currentFaceIndex < faceOrder.length) {
      document.getElementById('face-indicator').innerText = faceIndicators[faceOrder[currentFaceIndex]];
      drawGrid();
      startRealTimeDetection();
    } else {
      stopCamera();
      document.getElementById('cubeStringContent').innerText = getCubeString();
      alert('已完成所有面的掃描！');
    }
  };

  const retryButton = document.createElement('button');
  retryButton.innerText = '↻';
  retryButton.className = 'rescan-btn';
  retryButton.onclick = () => {
    buttonContainer.remove();
    drawGrid();
    startRealTimeDetection();
  };

  buttonContainer.appendChild(confirmButton);
  buttonContainer.appendChild(retryButton);
  dynamicArea.appendChild(buttonContainer);
}

// 初始化
renderCube();
loadRecords();
setColor('white');
import { PALETTE } from './constants.js';

export class CameraScanner {
    constructor() {
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('camera-canvas');
        this.modal = document.getElementById('camera-modal');
        this.gridOverlay = document.getElementById('preview-grid');
        this.stream = null;
    }

    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment', // 優先使用後置鏡頭
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            this.video.srcObject = this.stream;
            this.modal.classList.remove('hidden');
        } catch (err) {
            console.error("相機啟動失敗:", err);
            alert("無法啟動相機，請檢查權限設定。");
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.modal.classList.add('hidden');
    }

    // 核心修改：處理 object-fit: cover 的裁切偏移
    getScanColors() {
        if (!this.stream || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) return null;

        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // 1. 取得原始影片解析度 (例如 1280x720)
        const vWidth = this.video.videoWidth;
        const vHeight = this.video.videoHeight;
        
        // 確保 Canvas 尺寸與原始影片一致
        if (this.canvas.width !== vWidth) this.canvas.width = vWidth;
        if (this.canvas.height !== vHeight) this.canvas.height = vHeight;
        
        ctx.drawImage(this.video, 0, 0, vWidth, vHeight);

        // 2. 計算顯示比例與裁切偏移
        const videoRect = this.video.getBoundingClientRect(); // 螢幕上看到的影片區域
        const gridRect = this.gridOverlay.getBoundingClientRect(); // 螢幕上看到的九宮格
        
        // 計算渲染比例：object-fit: cover 會取寬高中較大的比例來填滿
        const scaleX = videoRect.width / vWidth;
        const scaleY = videoRect.height / vHeight;
        const scale = Math.max(scaleX, scaleY);

        // 計算目前螢幕上「真正顯示出來」的原始影片區域寬高 (原始像素單位)
        const visibleSourceW = videoRect.width / scale;
        const visibleSourceH = videoRect.height / scale;

        // 計算被裁掉的區域 (假設是置中裁切)
        // 這是解決「上下兩排掃不到」的關鍵：必須補償起始點的偏移
        const sourceOffsetX = (vWidth - visibleSourceW) / 2;
        const sourceOffsetY = (vHeight - visibleSourceH) / 2;

        // 3. 將 UI 九宮格的座標映射回原始影片座標
        // 計算九宮格相對於影片元件左上角的距離
        const gridRelX = gridRect.left - videoRect.left;
        const gridRelY = gridRect.top - videoRect.top;

        // 轉換為原始影片座標
        const startX = sourceOffsetX + (gridRelX / scale);
        const startY = sourceOffsetY + (gridRelY / scale);
        
        // 計算格子大小 (原始像素)
        const cellSize = (gridRect.width / scale) / 3;

        const capturedColors = [];

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                // 取每個格子的中心點
                const cx = Math.floor(startX + col * cellSize + cellSize / 2);
                const cy = Math.floor(startY + row * cellSize + cellSize / 2);
                
                // 邊界檢查
                if (cx < 0 || cx >= vWidth || cy < 0 || cy >= vHeight) {
                    capturedColors.push(0xFFFFFF); 
                    continue;
                }

                // 取樣範圍縮小至中心 3x3 像素，避免讀到方塊黑邊或雜訊
                const pixelData = ctx.getImageData(Math.max(0, cx - 1), Math.max(0, cy - 1), 3, 3).data;
                const rgb = this.getAverageRGB(pixelData);
                const colorVal = this.classifyColor(rgb);
                capturedColors.push(colorVal);
            }
        }
        return capturedColors;
    }

    getAverageRGB(data) {
        let r = 0, g = 0, b = 0;
        const count = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i+1];
            b += data[i+2];
        }
        return { r: r/count, g: g/count, b: b/count };
    }

    // 依據「相機顏色參數.txt」移植並微調的邏輯
    classifyColor({r, g, b}) {
        const [h, s, v] = this.rgbToHsv(r, g, b);

        [cite_start]// 參數表 [cite: 34]
        // 修改：將 Blue 的 Saturation 下限從 50 降至 25，解決藍色誤判為白色的問題
        const colorRanges = {
            'orange': { h: [5, 25], s: [20, 100], v: [30, 100] },
            'red': { h: [350, 5], s: [40, 100], v: [20, 100] },
            'yellow': { h: [50, 70], s: [50, 100], v: [70, 100] },
            'green': { h: [100, 150], s: [50, 100], v: [30, 100] },
            'blue': { h: [210, 270], s: [25, 100], v: [30, 100] }, // S min 改為 25
            'white': { h: [0, 360], s: [0, 20], v: [50, 100] }     // 稍微放寬白色的判定
        };

        const colorHexMap = {
            'orange': 0xFFA500,
            'red': 0xFF0000,
            'yellow': 0xFFFF00,
            'green': 0x00FF00,
            'blue': 0x0000FF,
            'white': 0xFFFFFF
        };

        [cite_start]// 優先檢測彩色 [cite: 35-39]
        for (const [color, range] of Object.entries(colorRanges)) {
            // 跳過白色，最後再當作預設值或特定檢測
            if (color === 'white') continue;

            let hInRange;
            if (color === 'red') {
                hInRange = (h >= range.h[0] && h <= 360) || (h >= 0 && h <= range.h[1]);
            } else {
                hInRange = h >= range.h[0] && h <= range.h[1];
            }

            if (
                hInRange &&
                s >= range.s[0] && s <= range.s[1] &&
                v >= range.v[0] && v <= range.v[1]
            ) {
                return colorHexMap[color];
            }
        }

        // 如果都沒對應到，檢查是否符合白色的嚴格定義
        // 這樣可以避免極暗的雜訊被當作白色，但在此案例中，落選者通常視為白色
        return 0xFFFFFF; 
    }

    [cite_start]// RGB 轉 HSV [cite: 40-45]
    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
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
}
import { PALETTE } from './constants.js';

export class CameraScanner {
    constructor() {
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('camera-canvas');
        this.modal = document.getElementById('camera-modal');
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

    // 只回傳顏色，不處理 UI 或狀態
    getScanColors() {
        if (!this.stream || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) return null;

        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        const vWidth = this.video.videoWidth;
        const vHeight = this.video.videoHeight;
        
        // 只需在尺寸改變時調整
        if (this.canvas.width !== vWidth) this.canvas.width = vWidth;
        if (this.canvas.height !== vHeight) this.canvas.height = vHeight;
        
        ctx.drawImage(this.video, 0, 0, vWidth, vHeight);

        // 計算九宮格採樣點 (假設九宮格位於畫面正中央，佔據約短邊的 60%)
        const size = Math.min(vWidth, vHeight) * 0.6; 
        const startX = (vWidth - size) / 2;
        const startY = (vHeight - size) / 2;
        const cellSize = size / 3;

        const capturedColors = [];

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                // 取每個格子的中心點
                const x = startX + col * cellSize + cellSize / 2;
                const y = startY + row * cellSize + cellSize / 2;
                
                // 取樣 5x5 區域平均色
                const pixelData = ctx.getImageData(x - 2, y - 2, 5, 5).data;
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

    // 依據提供的參數表進行 HSV 顏色分類
    classifyColor({r, g, b}) {
        const [h, s, v] = this.rgbToHsv(r, g, b);

        // 參數來源: 相機顏色參數.txt 
        const colorRanges = {
            'orange': { h: [5, 25], s: [20, 100], v: [30, 100] },
            'red': { h: [350, 5], s: [40, 100], v: [20, 100] },
            'yellow': { h: [50, 70], s: [50, 100], v: [70, 100] },
            'green': { h: [100, 150], s: [50, 100], v: [30, 100] },
            'blue': { h: [210, 270], s: [50, 100], v: [30, 100] },
            'white': { h: [0, 360], s: [0, 10], v: [90, 100] }
        };

        // 映射字串到 HEX 數值
        const colorHexMap = {
            'orange': 0xFFA500,
            'red': 0xFF0000,
            'yellow': 0xFFFF00,
            'green': 0x00FF00,
            'blue': 0x0000FF,
            'white': 0xFFFFFF
        };

        // 迭代判斷顏色 
        for (const [color, range] of Object.entries(colorRanges)) {
            let hInRange;
            if (color === 'red') {
                // 紅色跨越 360-0 度
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

        return 0xFFFFFF; // 預設白色
    }

    // RGB 轉 HSV 算法 
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
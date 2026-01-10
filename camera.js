import { PALETTE } from './constants.js';

export class CameraScanner {
    constructor() {
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('camera-canvas');
        this.modal = document.getElementById('camera-modal');
        this.gridOverlay = document.getElementById('preview-grid'); // 取得介面上的九宮格元素
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

    // 核心修改：精準映射視覺網格到原始影片座標
    getScanColors() {
        if (!this.stream || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) return null;

        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // 1. 取得原始影片解析度
        const vWidth = this.video.videoWidth;
        const vHeight = this.video.videoHeight;
        
        // 確保 Canvas 與原始影片尺寸一致
        if (this.canvas.width !== vWidth) this.canvas.width = vWidth;
        if (this.canvas.height !== vHeight) this.canvas.height = vHeight;
        
        ctx.drawImage(this.video, 0, 0, vWidth, vHeight);

        // 2. 取得 DOM 元素的實際顯示尺寸與位置
        // 這是解決「對不準」與「需要貼近」的關鍵：計算 CSS object-fit: cover 的縮放比例
        const videoRect = this.video.getBoundingClientRect();
        const gridRect = this.gridOverlay.getBoundingClientRect();

        // 計算 CSS 像素與原始影片像素的縮放比例
        // object-fit: cover 會以較大的比例填滿容器
        const scaleX = videoRect.width / vWidth;
        const scaleY = videoRect.height / vHeight;
        const renderScale = Math.max(scaleX, scaleY); // 這是 "1個原始像素 = 多少螢幕像素"

        // 3. 將介面上的九宮格(CSS座標) 轉換為 影片原始座標(Source座標)
        // 計算九宮格在影片內的實際寬度 (原始像素)
        const sourceGridSize = gridRect.width / renderScale;
        
        // 計算偏移量：九宮格中心點相對於影片中心點的偏移
        // (介面上的中心點差異 / 縮放比例)
        const videoCenterX = videoRect.left + videoRect.width / 2;
        const videoCenterY = videoRect.top + videoRect.height / 2;
        const gridCenterX = gridRect.left + gridRect.width / 2;
        const gridCenterY = gridRect.top + gridRect.height / 2;

        const offsetX = (gridCenterX - videoCenterX) / renderScale;
        const offsetY = (gridCenterY - videoCenterY) / renderScale;

        // 計算原始影片上的起始採樣座標 (左上角)
        // 原始中心 (vWidth/2) + 偏移 - 半個網格寬
        const startX = (vWidth / 2) + offsetX - (sourceGridSize / 2);
        const startY = (vHeight / 2) + offsetY - (sourceGridSize / 2);
        const cellSize = sourceGridSize / 3;

        const capturedColors = [];

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                // 取每個格子的中心點
                const cx = Math.floor(startX + col * cellSize + cellSize / 2);
                const cy = Math.floor(startY + row * cellSize + cellSize / 2);
                
                // 邊界檢查：防止讀取超出範圍導致錯誤
                if (cx < 0 || cx >= vWidth || cy < 0 || cy >= vHeight) {
                    capturedColors.push(0xFFFFFF); // 超出範圍預設白色
                    continue;
                }

                // 取樣 5x5 區域平均色
                const pixelData = ctx.getImageData(Math.max(0, cx - 2), Math.max(0, cy - 2), 5, 5).data;
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

    // 依據「相機顏色參數.txt」移植的 HSV 判斷邏輯
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

        // 迭代判斷顏色，包含紅色的跨度處理 
        for (const [color, range] of Object.entries(colorRanges)) {
            let hInRange;
            if (color === 'red') {
                // 紅色跨越 360-0 度 (350~360 或 0~5)
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
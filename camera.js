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

    capture() {
        if (!this.stream) return null;

        const ctx = this.canvas.getContext('2d');
        const vWidth = this.video.videoWidth;
        const vHeight = this.video.videoHeight;
        
        this.canvas.width = vWidth;
        this.canvas.height = vHeight;
        ctx.drawImage(this.video, 0, 0, vWidth, vHeight);

        // 計算九宮格採樣點 (假設九宮格位於畫面正中央，佔據約短邊的 60-80%)
        const size = Math.min(vWidth, vHeight) * 0.6; // 與 CSS scan-grid 對應
        const startX = (vWidth - size) / 2;
        const startY = (vHeight - size) / 2;
        const cellSize = size / 3;

        const capturedColors = [];

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                // 取每個格子的中心點
                const x = startX + col * cellSize + cellSize / 2;
                const y = startY + row * cellSize + cellSize / 2;
                
                // 取樣 5x5 區域平均色，避免噪點
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

    // 將 RGB 轉換為 HSL 並分類
    classifyColor({r, g, b}) {
        // RGB 歸一化
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; 
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        h = h * 360; // 0-360
        s = s * 100; // 0-100
        l = l * 100; // 0-100

        // 簡單的色彩分類邏輯 (需依賴良好光線)
        // 1. 白色: 低飽和度 或 極高亮度
        if (s < 15 || l > 85) return 0xFFFFFF; // White

        // 2. 橙色 vs 紅色 vs 黃色 (暖色系)
        if (h >= 340 || h <= 45) {
            // 黃色: 色相偏 40-60，亮度高
            if (h > 40 && l > 45) return 0xFFFF00; // Yellow
            // 橘色: 色相 15-40
            if (h > 15 && h <= 40) return 0xFFA500; // Orange
            // 紅色
            return 0xFF0000;
        }

        // 3. 綠色
        if (h > 60 && h < 160) return 0x00FF00;

        // 4. 藍色
        if (h >= 160 && h < 260) return 0x0000FF;

        // Fallback (歸類為最接近的)
        return 0xFFFFFF; 
    }
}
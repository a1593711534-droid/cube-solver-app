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

        // 提高白色的判定閾值
        if (s < 20 || l > 80) return 0xFFFFFF; // White

        // 暖色系
        if (h >= 340 || h <= 45) {
            if (h > 40 && l > 45) return 0xFFFF00; // Yellow
            if (h > 10 && h <= 40) return 0xFFA500; // Orange
            return 0xFF0000; // Red
        }

        // 綠色
        if (h > 60 && h < 160) return 0x00FF00;

        // 藍色
        if (h >= 160 && h < 260) return 0x0000FF;

        return 0xFFFFFF; // Fallback
    }
}
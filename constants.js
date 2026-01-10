export const FACE_COLORS = {
    U: 0xFFFFFF, F: 0x00FF00, R: 0xFF0000, 
    D: 0xFFFF00, L: 0xFFA500, B: 0x0000FF 
};

export const PALETTE = [
    { id: 'W', hex: '#FFFFFF', val: 0xFFFFFF },
    { id: 'Y', hex: '#FFFF00', val: 0xFFFF00 },
    { id: 'G', hex: '#00FF00', val: 0x00FF00 },
    { id: 'R', hex: '#FF0000', val: 0xFF0000 },
    { id: 'O', hex: '#FFA500', val: 0xFFA500 },
    { id: 'B', hex: '#0000FF', val: 0x0000FF }
];

export const UI_COLOR_LABELS = {
    'W': '⚪ 白色 (White)',
    'Y': '🟡 黃色 (Yellow)',
    'G': '🟢 綠色 (Green)',
    'R': '🔴 紅色 (Red)',
    'B': '🔵 藍色 (Blue)',
    'O': '🟠 橘色 (Orange)'
};

export const FACING_MAP = {
    'W': ['G', 'R', 'B', 'O'],
    'Y': ['G', 'R', 'B', 'O'],
    'R': ['G', 'W', 'B', 'Y'],
    'O': ['G', 'W', 'B', 'Y'],
    'G': ['W', 'R', 'Y', 'O'],
    'B': ['W', 'O', 'Y', 'R']
};

export const COLOR_CODES = {
    C_W: 0, C_Y: 1, C_G: 2, C_R: 3, C_O: 4, C_B: 5
};

export function getHexId(hex) {
    if(hex === 0xFFFFFF) return COLOR_CODES.C_W;
    if(hex === 0xFFFF00) return COLOR_CODES.C_Y;
    if(hex === 0x00FF00) return COLOR_CODES.C_G;
    if(hex === 0xFF0000) return COLOR_CODES.C_R;
    if(hex === 0xFFA500) return COLOR_CODES.C_O;
    if(hex === 0x0000FF) return COLOR_CODES.C_B;
    return -1;
}

export function getNameFromId(id) {
    const map = ['白色', '黃色', '綠色', '紅色', '橘色', '藍色'];
    return map[id] || '未知';
}
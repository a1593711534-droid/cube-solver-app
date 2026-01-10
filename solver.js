import { COLOR_CODES, getHexId, getNameFromId } from './constants.js';

const { C_W, C_Y, C_G, C_R, C_O, C_B } = COLOR_CODES;

// 索引: 0:R, 1:L, 2:U, 3:D, 4:F, 5:B
const ROTATION_LOGIC = {
    'y': { coord: (x,y,z) => ({x: -z, y: y, z: x}), colorPerm: [5, 4, 2, 3, 0, 1] },
    "y'": { coord: (x,y,z) => ({x: z, y: y, z: -x}), colorPerm: [4, 5, 2, 3, 1, 0] },
    'y2': { coord: (x,y,z) => ({x: -x, y: y, z: -z}), colorPerm: [1, 0, 2, 3, 5, 4] },
    'z2': { coord: (x,y,z) => ({x: -x, y: -y, z: z}), colorPerm: [1, 0, 3, 2, 4, 5] },
    'x': { coord: (x,y,z) => ({x: x, y: z, z: -y}), colorPerm: [0, 1, 4, 5, 3, 2] }, 
    "x'": { coord: (x,y,z) => ({x: x, y: -z, z: y}), colorPerm: [0, 1, 5, 4, 2, 3] },
    'x2': { coord: (x,y,z) => ({x: x, y: -y, z: -z}), colorPerm: [0, 1, 3, 2, 5, 4] },
    'z': { coord: (x,y,z) => ({x: y, y: -x, z: z}), colorPerm: [2, 3, 1, 0, 4, 5] },
    "z'": { coord: (x,y,z) => ({x: -y, y: x, z: z}), colorPerm: [3, 2, 0, 1, 4, 5] }
};

const BASE_MOVES_LOGIC = {
    'F': [ {s:8,e:4,f:1}, {s:4,e:0,f:1}, {s:0,e:7,f:1}, {s:7,e:8,f:1} ],
    'B': [ {s:10,e:6,f:1}, {s:6,e:2,f:1}, {s:2,e:5,f:1}, {s:5,e:10,f:1} ],
    'R': [ {s:9,e:5,f:0}, {s:5,e:1,f:0}, {s:1,e:4,f:0}, {s:4,e:9,f:0} ],
    'L': [ {s:11,e:7,f:0}, {s:7,e:3,f:0}, {s:3,e:6,f:0}, {s:6,e:11,f:0} ],
    'U': [ {s:8,e:11,f:0}, {s:11,e:10,f:0}, {s:10,e:9,f:0}, {s:9,e:8,f:0} ],
    'D': [ {s:0,e:1,f:0}, {s:1,e:2,f:0}, {s:2,e:3,f:0}, {s:3,e:0,f:0} ]
};

let SOLVER_CACHE = null;

function initSolver() {
    if (SOLVER_CACHE) return;
    const prioritizedMoves = [
        {f:'R',v:''}, {f:'L',v:''}, {f:'U',v:''}, {f:'D',v:''}, {f:'F',v:''},
        {f:'R',v:"'"}, {f:'L',v:"'"}, {f:'U',v:"'"}, {f:'D',v:"'"}, {f:'F',v:"'"},
        {f:'R',v:'2'}, {f:'L',v:'2'}, {f:'U',v:'2'}, {f:'D',v:'2'}, {f:'F',v:'2'},
        {f:'B',v:''}, {f:'B',v:"'"}, {f:'B',v:'2'}
    ];
    const faceMap = {'R':0, 'L':1, 'U':2, 'D':3, 'F':4, 'B':5};
    const moveFaces = prioritizedMoves.map(m => faceMap[m.f]);
    const moveNames = prioritizedMoves.map(m => m.f + m.v);
    
    const table = new Int8Array(18 * 24);
    prioritizedMoves.forEach((pm, moveIdx) => {
        const baseTrans = BASE_MOVES_LOGIC[pm.f];
        const times = (pm.v === "'") ? 3 : (pm.v === '2' ? 2 : 1);
        for (let state = 0; state < 24; state++) {
            let pos = state >> 1;
            let ori = state & 1;
            for (let t = 0; t < times; t++) {
                const logic = baseTrans.find(x => x.s === pos);
                if (logic) {
                    pos = logic.e;
                    ori = (ori + logic.f) % 2;
                }
            }
            table[moveIdx * 24 + state] = (pos << 1) | ori;
        }
    });
    SOLVER_CACHE = { table, moveNames, moveFaces };
}

function transformEdges(edges, rotSeq) {
    return edges.map(edge => {
        let currPos = { x: edge.rawX, y: edge.rawY, z: edge.rawZ };
        let currColors = [...edge.rawColors]; 
        if (rotSeq && rotSeq.length > 0) {
            rotSeq.forEach(rot => {
                const logic = ROTATION_LOGIC[rot];
                if(logic) {
                    currPos = logic.coord(currPos.x, currPos.y, currPos.z);
                    const newColors = new Array(6);
                    for(let i=0; i<6; i++) {
                        newColors[i] = currColors[logic.colorPerm[i]];
                    }
                    currColors = newColors;
                }
            });
        }
        let nC = { x: -1, y: -1, z: -1 };
        // 0:R, 1:L, 2:U, 3:D, 4:F, 5:B
        if(currPos.x===1) nC.x = currColors[0]; if(currPos.x===-1) nC.x = currColors[1];
        if(currPos.y===1) nC.y = currColors[2]; if(currPos.y===-1) nC.y = currColors[3];
        if(currPos.z===1) nC.z = currColors[4]; if(currPos.z===-1) nC.z = currColors[5];
        return { nC, x: currPos.x, y: currPos.y, z: currPos.z };
    });
}

function readAndTransformState(cubeGroup, targetColorId, rotSeq) {
    let rawEdges = [];
    cubeGroup.children.forEach(mesh => {
        const {x, y, z} = mesh.userData;
        if(Math.abs(x)+Math.abs(y)+Math.abs(z) !== 2) return; 

        let c = [
             (x===1)?mesh.material[0].color.getHex():-1, 
             (x===-1)?mesh.material[1].color.getHex():-1,
             (y===1)?mesh.material[2].color.getHex():-1, 
             (y===-1)?mesh.material[3].color.getHex():-1,
             (z===1)?mesh.material[4].color.getHex():-1, 
             (z===-1)?mesh.material[5].color.getHex():-1
        ].map(getHexId);
        rawEdges.push({ rawX: x, rawY: y, rawZ: z, rawColors: c });
    });

    let transformed = transformEdges(rawEdges, rotSeq);
    let solverEdges = [];
    transformed.forEach(t => {
        let { nC, x, y, z } = t;
        let hasTarget = (nC.x===targetColorId || nC.y===targetColorId || nC.z===targetColorId);
        if(hasTarget) {
            let otherColor = (nC.x!==-1 && nC.x!==targetColorId) ? nC.x : ((nC.y!==-1 && nC.y!==targetColorId) ? nC.y : nC.z);
            let pos = -1;
            if(y===-1 && z===1) pos=0; else if(y===-1 && x===1) pos=1; else if(y===-1 && z===-1) pos=2; else if(y===-1 && x===-1) pos=3;
            else if(z===1 && x===1) pos=4; else if(z===-1 && x===1) pos=5; else if(z===-1 && x===-1) pos=6; else if(z===1 && x===-1) pos=7;
            else if(y===1 && z===1) pos=8; else if(y===1 && x===1) pos=9; else if(y===1 && z===-1) pos=10; else if(y===1 && x===-1) pos=11;
            
            let isGood = false;
            if(pos>=0 && pos<=3) isGood = (nC.y === targetColorId);
            else if(pos>=8 && pos<=11) isGood = (nC.y === targetColorId); 
            else if(pos>=4 && pos<=7) isGood = (nC.z === targetColorId); 

            solverEdges.push({ targetColor: otherColor, pos: pos, ori: isGood?0:1 });
        }
    });
    return solverEdges;
}

function scoreSolution(path) {
    let backMoves = 0;
    for (let m of path) { if (m.startsWith('B')) backMoves++; }
    return { backMoves };
}

export function generateScramble(path, prefix) {
    if (!path || path.length === 0) return "無需打亂";
    let reversed = [...path].reverse().map(move => {
        let char = move[0];
        let modifier = move.length > 1 ? move[1] : '';
        if (modifier === '') return char + "'";   
        if (modifier === "'") return char;       
        if (modifier === '2') return char + '2'; 
        return move;
    });
    return (prefix ? prefix + " " : "") + reversed.join(" ");
}

export function invertAlg(algArray) {
    if(!algArray || algArray.length === 0) return "";
    let invertMove = (move) => {
        if(!move) return "";
        let base = move[0];
        let mod = move.length > 1 ? move[1] : "";
        if (mod === "") return base + "'";
        if (mod === "'") return base;
        if (mod === "2") return base + "2";
        return move;
    };
    return [...algArray].reverse().map(m => invertMove(m)).join(" ");
}

export function calculateSolution(cubeGroup, crossId, facingId) {
    initSolver();
    const { table, moveNames, moveFaces } = SOLVER_CACHE;
    let rotSeq = [];
    let pattern = [];

    // 設定求解視角
    if (crossId === C_W) {
        rotSeq.push('z2'); pattern = [C_G, C_O, C_B, C_R];
        if (facingId === C_G) {} else if (facingId === C_R) rotSeq.push("y'"); else if (facingId === C_O) rotSeq.push("y"); else if (facingId === C_B) rotSeq.push("y2"); else throw new Error("無效朝向");
    } else if (crossId === C_Y) {
        pattern = [C_G, C_R, C_B, C_O];
        if (facingId === C_G) {} else if (facingId === C_R) rotSeq.push("y"); else if (facingId === C_O) rotSeq.push("y'"); else if (facingId === C_B) rotSeq.push("y2"); else throw new Error("無效朝向");
    } else if (crossId === C_R) {
        rotSeq.push("z"); pattern = [C_G, C_W, C_B, C_Y];
        if (facingId === C_G) {} else if (facingId === C_W) rotSeq.push("y"); else if (facingId === C_B) rotSeq.push("y2"); else if (facingId === C_Y) rotSeq.push("y'"); else throw new Error("無效朝向");
    } else if (crossId === C_O) {
        rotSeq.push("z'"); pattern = [C_G, C_Y, C_B, C_W];
        if (facingId === C_G) {} else if (facingId === C_Y) rotSeq.push("y"); else if (facingId === C_B) rotSeq.push("y2"); else if (facingId === C_W) rotSeq.push("y'"); else throw new Error("無效朝向");
    } else if (crossId === C_G) {
        rotSeq.push("x'"); pattern = [C_W, C_R, C_Y, C_O];
        if (facingId === C_W) {} else if (facingId === C_R) rotSeq.push("y"); else if (facingId === C_Y) rotSeq.push("y2"); else if (facingId === C_O) rotSeq.push("y'"); else throw new Error("無效朝向");
    } else if (crossId === C_B) {
        rotSeq.push("x"); pattern = [C_Y, C_R, C_W, C_O];
        if (facingId === C_Y) {} else if (facingId === C_R) rotSeq.push("y"); else if (facingId === C_W) rotSeq.push("y2"); else if (facingId === C_O) rotSeq.push("y'"); else throw new Error("無效朝向");
    }

    const edges = readAndTransformState(cubeGroup, crossId, rotSeq);
    
    if(edges.length !== 4) throw new Error(`找到 ${edges.length} 個邊塊，需 4 個。`);

    const startIdx = pattern.indexOf(facingId);
    const order = [pattern[startIdx], pattern[(startIdx+1)%4], pattern[(startIdx+2)%4], pattern[(startIdx+3)%4]];
    
    let startState = 0;
    for(let i=0; i<4; i++) {
        const e = edges.find(x => x.targetColor === order[i]);
        if(!e) throw new Error(`找不到側面為 ${getNameFromId(order[i])} 的邊塊`);
        startState |= ((e.pos << 1) | e.ori) << (5 * i);
    }

    const SOLVED_STATE = 200768;
    const visited = new Uint8Array(1048576); 
    const parentMap = new Uint32Array(1048576); 
    let currentLayer = [startState];
    visited[startState] = 1;
    let solutions = [];
    const MAX_DEPTH = 7;

    for (let depth = 0; depth <= MAX_DEPTH; depth++) {
        if (currentLayer.length === 0) break;
        let nextLayer = [];
        for (let i = 0; i < currentLayer.length; i++) {
            const state = currentLayer[i];
            if (state === SOLVED_STATE) {
                solutions.push({ state, parent: -1, moveIdx: -1 }); 
                continue;
            }
            let lastFace = -1;
            if (depth > 0) {
                lastFace = moveFaces[parentMap[state] & 0x1F];
            }
            for (let m = 0; m < 18; m++) {
                if (moveFaces[m] === lastFace) continue; 
                const s0 = state & 31, s1 = (state >> 5) & 31, s2 = (state >> 10) & 31, s3 = (state >> 15) & 31;
                const nextState = table[m * 24 + s0] | (table[m * 24 + s1] << 5) | (table[m * 24 + s2] << 10) | (table[m * 24 + s3] << 15);
                if (nextState === SOLVED_STATE) solutions.push({ state: nextState, parent: state, moveIdx: m });
                else if (visited[nextState] === 0) {
                    visited[nextState] = 1;
                    parentMap[nextState] = (state << 5) | m;
                    nextLayer.push(nextState);
                }
            }
        }
        if (solutions.length > 0) break;
        currentLayer = nextLayer;
    }

    if (solutions.length === 0) throw new Error("7步內無解");

    const finalPaths = solutions.map(sol => {
        if (sol.moveIdx === -1) return []; 
        let path = [ moveNames[sol.moveIdx] ];
        let curr = sol.parent;
        while (curr !== startState) {
            const val = parentMap[curr];
            path.push(moveNames[val & 0x1F]);
            curr = val >>> 5;
        }
        return path.reverse();
    });
    finalPaths.sort((a, b) => scoreSolution(a).backMoves - scoreSolution(b).backMoves);
    return { path: finalPaths[0], rotSeq };
}
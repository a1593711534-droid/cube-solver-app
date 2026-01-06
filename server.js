const express = require('express');
const Kociemba = require('kociemba');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/solve', (req, res) => {
  const { cubeString } = req.body;

  if (!cubeString || cubeString.length !== 54) {
    return res.status(400).send('請提供正確格式的魔方顏色字串（長度為 54）');
  }

  try {
    const solution = Kociemba.solve(cubeString);
    const reversedSolution = reverseSolution(solution);
    res.json({ solution, reversedSolution });
  } catch (error) {
    res.status(500).send('解法計算出錯，請檢查輸入的魔方狀態。');
  }
});

function reverseSolution(solution) {
  if (!solution || solution.trim() === '') return '';
  const moves = solution.trim().split(' ').filter(move => move !== '');
  const reversedMoves = moves.reverse().map(move => {
    if (move.endsWith("'")) return move.slice(0, -1);
    else if (move.endsWith("2")) return move;
    else return move + "'";
  });
  return reversedMoves.join(' ').trim();
}

app.listen(port, () => {
  console.log(`伺服器已啟動，請訪問 http://localhost:${port}`);
});
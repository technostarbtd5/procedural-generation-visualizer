function getChunk(x: number, y: number): number[][] {
  const chunk = [];
  for (let i = 0; i < 16; i++) {
    const row = [];
    for (let j = 0; j < 16; j++) {
      row.push(getValueAtPoint(i, j));
    }
    chunk.push(row);
  }
  return chunk;
}

function getValueAtPoint(x: number, y: number): number {
  const posToRad = 2 * Math.PI / 16;
  return Math.floor(Math.sin(x * posToRad) * 4 + Math.cos(y * posToRad) * 4 + Math.random() * 2 + 8);
  // return x + y;
}

export default getChunk;

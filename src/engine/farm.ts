import { FARM_COLS, TOTAL_ROWS } from '../data/config.js';
import type { Cell, GameState, Tile } from './types.js';

export function cellName(cell: Cell): string {
  return `${String.fromCharCode(65 + cell.row)}${cell.col + 1}`;
}

export function allCells(): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < FARM_COLS; col++) cells.push({ row, col });
  }
  return cells;
}

export function tileAt(s: GameState, cell: Cell): Tile {
  return s.farm[cell.row][cell.col];
}

export function allTiles(s: GameState): Tile[] {
  return s.farm.flat();
}

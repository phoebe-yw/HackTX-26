// Turn-based Tavern games: Tic-Tac-Toe and Connect Four. Pure functions shared by
// the local backend, the Firestore backend and the bot.
// Cells are row-major; 0 = empty, 1 = players[0], 2 = players[1].
import type { GameKind, GameState } from './types';

export type BoardKind = Exclude<GameKind, 'spellbound'>;

export const DIMS: Record<BoardKind, { rows: number; cols: number; toWin: number }> = {
  tictactoe: { rows: 3, cols: 3, toWin: 3 },
  connect4: { rows: 6, cols: 7, toWin: 4 },
};

export const GAME_INFO: Record<GameKind, { name: string; icon: string; blurb: string }> = {
  spellbound: { name: 'Spellbound', icon: '🔮', blurb: 'Word race: same secret 5-letter word, six guesses each.' },
  tictactoe: { name: 'Tic-Tac-Toe', icon: '❌', blurb: 'Three in a row on a 3×3 board. Quick and ruthless.' },
  connect4: { name: 'Connect Four', icon: '🔴', blurb: 'Drop discs, line up four. Takes a few minutes.' },
};

export function emptyBoard(kind: BoardKind): number[] {
  const { rows, cols } = DIMS[kind];
  return Array(rows * cols).fill(0);
}

/**
 * Where a move lands. Tic-Tac-Toe: `input` is the cell. Connect Four: `input` is the
 * column, and the disc falls to the lowest empty row. Returns null if illegal.
 */
export function landingCell(kind: BoardKind, cells: number[], input: number): number | null {
  const { rows, cols } = DIMS[kind];
  if (kind === 'tictactoe') return input >= 0 && input < cells.length && cells[input] === 0 ? input : null;
  if (input < 0 || input >= cols) return null;
  for (let r = rows - 1; r >= 0; r--) {
    if (cells[r * cols + input] === 0) return r * cols + input;
  }
  return null;
}

export function legalInputs(kind: BoardKind, cells: number[]): number[] {
  const n = kind === 'tictactoe' ? cells.length : DIMS[kind].cols;
  return Array.from({ length: n }, (_, i) => i).filter((i) => landingCell(kind, cells, i) !== null);
}

/** The winning line (cell indexes) if someone has won. */
export function findWin(kind: BoardKind, cells: number[]): { mark: number; line: number[] } | null {
  const { rows, cols, toWin } = DIMS[kind];
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mark = cells[r * cols + c];
      if (!mark) continue;
      for (const [dr, dc] of dirs) {
        const line = [r * cols + c];
        for (let k = 1; k < toWin; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || cells[rr * cols + cc] !== mark) break;
          line.push(rr * cols + cc);
        }
        if (line.length === toWin) return { mark, line };
      }
    }
  }
  return null;
}

export function isFull(cells: number[]): boolean {
  return cells.every((x) => x !== 0);
}

/** Apply a move and work out the result. Returns null if the move is illegal. */
export function playMove(kind: BoardKind, cells: number[], input: number, mark: number) {
  const at = landingCell(kind, cells, input);
  if (at === null) return null;
  const next = [...cells];
  next[at] = mark;
  const win = findWin(kind, next);
  return { cells: next, win, draw: !win && isFull(next) };
}

export function isBoardKind(kind: GameKind | undefined): kind is BoardKind {
  return kind === 'tictactoe' || kind === 'connect4';
}

/** Validate a move by `playerUid` and return the fields to update on the game. */
export function boardMovePatch(
  g: Omit<GameState, 'id'>,
  playerUid: string,
  input: number,
): { patch: Partial<GameState> } | { error: string } {
  if (!isBoardKind(g.kind)) return { error: 'Not a board game.' };
  if (g.status !== 'playing') return { error: 'The game is over.' };
  const turn = g.turn ?? 0;
  const seat = g.players.findIndex((p) => p.uid === playerUid);
  if (seat < 0) return { error: 'You are not in this game.' };
  if (seat !== turn) return { error: "It's not your turn." };
  const r = playMove(g.kind, g.cells ?? emptyBoard(g.kind), input, seat + 1);
  if (!r) return { error: g.kind === 'connect4' ? 'That column is full.' : 'That square is taken.' };
  const patch: Partial<GameState> = { cells: r.cells, turn: 1 - turn };
  if (r.win) Object.assign(patch, { status: 'finished', winnerUid: playerUid, winLine: r.win.line });
  else if (r.draw) Object.assign(patch, { status: 'finished', winnerUid: null });
  return { patch };
}

/** Fields a brand-new game starts with (no undefined values: Firestore rejects them). */
export function initialGameFields(kind: GameKind, word: () => string): Pick<GameState, 'kind' | 'word'> & Partial<GameState> {
  return isBoardKind(kind) ? { kind, word: '', cells: emptyBoard(kind), turn: 0 } : { kind, word: word() };
}

/** Bot: take a win, block a loss, otherwise play sensibly. Slips sometimes so it's beatable. */
export function botMove(kind: BoardKind, cells: number[], botMark: number): number {
  const options = legalInputs(kind, cells);
  const human = botMark === 1 ? 2 : 1;
  const winsWith = (mark: number) => options.find((i) => playMove(kind, cells, i, mark)?.win);
  const win = winsWith(botMark);
  if (win !== undefined) return win;
  const block = winsWith(human);
  if (block !== undefined && Math.random() < 0.85) return block;
  if (Math.random() < 0.2) return options[Math.floor(Math.random() * options.length)];

  if (kind === 'tictactoe') {
    const prefs = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    return prefs.find((i) => options.includes(i)) ?? options[0];
  }
  // Connect Four: prefer the centre, and don't hand the human a win on the next turn
  const { cols } = DIMS.connect4;
  const safe = options.filter((i) => {
    const after = playMove(kind, cells, i, botMark);
    return after && !legalInputs(kind, after.cells).some((j) => playMove(kind, after.cells, j, human)?.win);
  });
  const pool = safe.length ? safe : options;
  const centre = (cols - 1) / 2;
  return [...pool].sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre) + (Math.random() - 0.5) * 1.5)[0];
}

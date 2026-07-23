/**
 * network.js
 * -----------------------------------------------------------------------
 * All Firebase Realtime Database interaction lives here. Every other
 * module talks to Firebase only through this class.
 *
 * Database shape:
 *
 * lobby/
 *   waitingRoom: string | null   <- room code of the one open "quick match"
 *                                   room currently looking for an opponent,
 *                                   used by findOrCreateMatch() below.
 *
 * rooms/
 *   {roomCode}/
 *     createdAt: number
 *     mode: 'human' | 'bot'             <- 'bot' once the computer has taken the O seat
 *     status: 'waiting' | 'playing' | 'won' | 'draw'
 *     turn: 'X' | 'O'
 *     winner: 'X' | 'O' | null
 *     winningLine: string | null        <- "0,1,2" style, comma-joined indices
 *     cells/
 *       0..8: '' | 'X' | 'O'
 *     scores/
 *       X: number
 *       O: number
 *     players/
 *       {playerId}/
 *         nickname: string
 *         symbol: 'X' | 'O' | 'spectator'
 *         joinedAt: number
 * -----------------------------------------------------------------------
 */

import { checkWinner, isBoardFull } from './utils.js';

const EMPTY_CELLS = { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' };

export class NetworkManager {
  constructor() {
    this.db = firebase.database();
    this.roomCode = null;
    this.playerId = null;
    this.mySymbol = null; // 'X' | 'O' | 'spectator'

    this.roomRef = null;
    this.playersRef = null;
    this.selfRef = null;
    this.lobbyRef = this.db.ref('lobby/waitingRoom');

    // Callbacks the game layer subscribes to.
    this.onRoomUpdate = () => {};
    this.onPlayerAdded = () => {};
    this.onPlayerRemoved = () => {};
    this.onConnectionStateChanged = () => {};
  }

  watchConnectionState() {
    this.db.ref('.info/connected').on('value', (snap) => {
      this.onConnectionStateChanged(!!snap.val());
    });
  }

  async measurePing() {
    const start = Date.now();
    try {
      await this.db.ref('.info/serverTimeOffset').once('value');
      return Date.now() - start;
    } catch {
      return -1;
    }
  }

  /** Create a brand-new room with a fresh code, then join it. */
  async createRoom(nickname, roomCodeGenerator) {
    let code;
    let attempts = 0;
    do {
      code = roomCodeGenerator();
      const snap = await this.db.ref(`rooms/${code}`).once('value');
      if (!snap.exists()) break;
      attempts++;
    } while (attempts < 10);

    await this._createRoomWithCode(code);
    return this.joinRoom(code, nickname);
  }

  async _createRoomWithCode(code) {
    await this.db.ref(`rooms/${code}`).set({
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      mode: 'human',
      status: 'waiting',
      turn: 'X',
      startingSymbol: 'X', // who goes first this round; alternates on each playAgain()
      winner: null,
      winningLine: null,
      cells: EMPTY_CELLS,
      scores: { X: 0, O: 0 },
    });
  }

  /**
   * Quick-match entry point: enter the "lobby" and either join someone
   * else's open room (if one is already waiting) or become the one
   * waiting yourself. Implemented with a single Firebase transaction on
   * a shared `lobby/waitingRoom` pointer:
   *
   *  - If the pointer already holds a room code, we "claim" it (the
   *    transaction clears the pointer back to null) and join that room
   *    as O.
   *  - If the pointer is empty, the transaction reserves it with a room
   *    code we generate up-front. Because transactions retry against the
   *    latest server value, if two players call this at nearly the same
   *    instant, exactly one of them ends up creating the room and the
   *    other ends up joining it — never two separate rooms and never a
   *    lost player.
   */
  async findOrCreateMatch(nickname, roomCodeGenerator) {
    const myCandidateCode = roomCodeGenerator();
    let existingCode = null;

    await this.lobbyRef.transaction((current) => {
      if (current) {
        existingCode = current;
        return null; // claim it — clear the pointer for the next pair of players
      }
      existingCode = null;
      return myCandidateCode; // reserve the pointer with our new room
    });

    if (existingCode) {
      try {
        return await this.joinRoom(existingCode, nickname);
      } catch (err) {
        // The waiting room we found is gone (its creator vanished before
        // we got here) — fall back to starting a fresh wait of our own.
        await this._createRoomWithCode(myCandidateCode);
        await this.lobbyRef.set(myCandidateCode);
        return this.joinRoom(myCandidateCode, nickname);
      }
    }

    await this._createRoomWithCode(myCandidateCode);
    return this.joinRoom(myCandidateCode, nickname);
  }

  /** Clear the lobby pointer if it still points at `code` (idempotent, safe to call from either side). */
  async _clearLobbyIfMatches(code) {
    await this.lobbyRef.transaction((current) => (current === code ? null : current));
  }

  /**
   * Called client-side after ~30s of nobody joining a waiting room: seats
   * a virtual "Computer" player as O and switches the room into bot mode.
   * Uses a transaction so it only ever fires once, even if triggered from
   * more than one place.
   */
  async activateBot() {
    const txResult = await this.roomRef.transaction((room) => {
      if (!room) return room;
      if (room.status !== 'waiting') return; // someone already joined for real — abort
      room.mode = 'bot';
      room.status = 'playing';
      room.players = room.players || {};
      room.players['bot'] = { nickname: 'Computer', symbol: 'O', joinedAt: Date.now() };
      return room;
    });
    if (txResult.committed) {
      await this._clearLobbyIfMatches(this.roomCode);
    }
    return txResult.committed;
  }

  /** Join an existing room: claim X, O, or spectator, wire presence + listeners. */
  async joinRoom(roomCode, nickname) {
    this.roomCode = roomCode.toUpperCase();
    this.playerId = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

    this.roomRef = this.db.ref(`rooms/${this.roomCode}`);
    this.playersRef = this.roomRef.child('players');
    this.selfRef = this.playersRef.child(this.playerId);

    const roomSnap = await this.roomRef.once('value');
    if (!roomSnap.exists()) throw new Error('ROOM_NOT_FOUND');

    // Atomically claim a symbol: first X, then O, then spectator. A
    // transaction guarantees two players joining at the same instant can
    // never both be assigned 'X'.
    const symbol = await this._claimSymbol(nickname);
    this.mySymbol = symbol;

    // Presence + disconnect cleanup: remove our node the instant the
    // connection drops (tab close, network loss, crash, etc).
    this.selfRef.onDisconnect().remove();

    this._attachListeners();

    // Once both X and O are present, flip the room into "playing".
    if (symbol === 'O') {
      await this.roomRef.transaction((room) => {
        if (room && room.status === 'waiting') room.status = 'playing';
        return room;
      });
      // A real opponent showed up — make sure the lobby pointer no longer
      // dangles on this (now full) room.
      await this._clearLobbyIfMatches(this.roomCode);
    }

    return { roomCode: this.roomCode, playerId: this.playerId, symbol };
  }

  async _claimSymbol(nickname) {
    const result = await this.playersRef.transaction((players) => {
      players = players || {};
      const taken = Object.values(players).map((p) => p.symbol);
      let symbol = 'spectator';
      if (!taken.includes('X')) symbol = 'X';
      else if (!taken.includes('O')) symbol = 'O';
      players[this.playerId] = {
        nickname,
        symbol,
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
      };
      return players;
    });
    return result.snapshot.child(this.playerId).child('symbol').val();
  }

  _attachListeners() {
    // The whole room (board/turn/status/scores) is small, so a single
    // 'value' listener is simpler and cheap enough to keep everything
    // trivially consistent.
    this.roomRef.on('value', (snap) => {
      const room = snap.val();
      if (room) this.onRoomUpdate(room);
    });

    this.playersRef.on('child_added', (snap) => {
      if (snap.key === this.playerId) return;
      this.onPlayerAdded(snap.key, snap.val());
    });

    this.playersRef.on('child_removed', (snap) => {
      this.onPlayerRemoved(snap.key, snap.val());
    });
  }

  /**
   * Attempt to place the local player's mark at `index`. Runs as a single
   * transaction on the whole room so the legality check (my turn? cell
   * empty? game still in progress?) and the win/draw detection all happen
   * atomically — this is what prevents double-moves or two players
   * "winning" simultaneously from a race.
   */
  async attemptMove(index) {
    if (this.mySymbol !== 'X' && this.mySymbol !== 'O') return false;

    const txResult = await this.roomRef.transaction((room) => {
      if (!room) return room;
      if (room.status !== 'playing') return; // abort — game not in progress
      if (room.turn !== this.mySymbol) return; // abort — not our turn
      const cells = room.cells || {};
      if (cells[index]) return; // abort — cell occupied

      cells[index] = this.mySymbol;
      room.cells = cells;

      const { winner, line } = checkWinner(cells);
      if (winner) {
        room.status = 'won';
        room.winner = winner;
        room.winningLine = line.join(',');
        room.scores = room.scores || { X: 0, O: 0 };
        room.scores[winner] = (room.scores[winner] || 0) + 1;
      } else if (isBoardFull(cells)) {
        room.status = 'draw';
      } else {
        room.turn = room.turn === 'X' ? 'O' : 'X';
      }
      return room;
    });

    return txResult.committed;
  }

  /**
   * Places the computer's mark. Unlike attemptMove(), this isn't gated on
   * `mySymbol` (the human is always X in bot mode; nobody "owns" O) — it's
   * gated on the room actually being in bot mode and it actually being
   * O's turn, which is enough to keep it safe.
   */
  async attemptBotMove(index) {
    const txResult = await this.roomRef.transaction((room) => {
      if (!room) return room;
      if (room.mode !== 'bot') return; // abort — not a bot match
      if (room.status !== 'playing') return; // abort — game over
      if (room.turn !== 'O') return; // abort — not the bot's turn
      const cells = room.cells || {};
      if (cells[index]) return; // abort — cell occupied

      cells[index] = 'O';
      room.cells = cells;

      const { winner, line } = checkWinner(cells);
      if (winner) {
        room.status = 'won';
        room.winner = winner;
        room.winningLine = line.join(',');
        room.scores = room.scores || { X: 0, O: 0 };
        room.scores[winner] = (room.scores[winner] || 0) + 1;
      } else if (isBoardFull(cells)) {
        room.status = 'draw';
      } else {
        room.turn = 'X';
      }
      return room;
    });
    return txResult.committed;
  }

  /**
   * Reset the board for another round, keeping the running score. The
   * player who goes first alternates each round (X, then O, then X, ...)
   * so joining the room first only determines who starts round 1 — after
   * that it's "once me, once the opponent."
   */
  async playAgain() {
    await this.roomRef.transaction((room) => {
      if (!room) return room;
      const nextStarter = room.startingSymbol === 'O' ? 'X' : 'O';
      room.cells = EMPTY_CELLS;
      room.turn = nextStarter;
      room.startingSymbol = nextStarter;
      room.status = 'playing';
      room.winner = null;
      room.winningLine = null;
      return room;
    });
  }

  /**
   * Called when a player holding X or O disconnects mid-match: reset the
   * board and drop the room back to "waiting" so a new player can cleanly
   * take over that slot rather than leaving the game stuck.
   */
  async resetRoomForDisconnect() {
    await this.roomRef.transaction((room) => {
      if (!room) return room;
      room.cells = EMPTY_CELLS;
      room.turn = 'X';
      room.startingSymbol = 'X';
      room.status = 'waiting';
      room.winner = null;
      room.winningLine = null;
      room.mode = 'human';
      if (room.players && room.players.bot) delete room.players.bot;
      return room;
    });
  }

  async leaveRoom() {
    if (this.selfRef) {
      this.selfRef.onDisconnect().cancel();
      await this.selfRef.remove();
    }
    if (this.roomRef) this.roomRef.off();
    if (this.playersRef) this.playersRef.off();
    this.roomCode = null;
    this.playerId = null;
    this.mySymbol = null;
  }
}

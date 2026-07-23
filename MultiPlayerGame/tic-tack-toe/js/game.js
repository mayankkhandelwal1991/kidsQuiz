/**
 * game.js
 * -----------------------------------------------------------------------
 * Orchestrates the tic-tac-toe match: wires UI callbacks to the network
 * layer, keeps a local copy of the players map (for name/spectator
 * rendering), and reacts to room/player changes coming from Firebase.
 * -----------------------------------------------------------------------
 */

import { NetworkManager } from './network.js';
import { UIManager } from './ui.js';
import { generateRoomCode, sanitizeNickname, SoundManager } from './utils.js';
import { computeBotMove } from './bot.js';

const MATCH_WAIT_SECONDS = 30; // how long to wait for a human before starting a bot match
const BOT_MOVE_DELAY_MS = 550; // small "thinking" pause so the bot doesn't feel instant/robotic

export class Game {
  constructor() {
    this.ui = new UIManager();
    this.network = new NetworkManager();
    this.sounds = new SoundManager();

    this.playersMap = {}; // id -> { nickname, symbol, joinedAt }
    this.lastStatus = null; // used to detect status transitions for sound/toast triggers

    this._matchmakingCountdownInterval = null;
    this._matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
    this._botMoveTimeout = null;
    this._botMovePendingForTurn = null; // guards against scheduling more than one bot move per turn
  }

  init() {
    this._bindUI();
    this._checkUrlRoomParam();
  }

  _bindUI() {
    this.ui.bindLandingActions({
      onPlay: (nickname) => this._handlePlay(nickname),
      onJoinCode: (nickname, code) => this._handleJoinRoom(nickname, code),
    });

    this.ui.bindChromeActions({
      onShare: () => {
        this.sounds.playClick();
        this.ui.shareRoom(this.network.roomCode);
      },
      onSoundToggle: () => {
        const next = !this.sounds.enabled;
        this.sounds.setEnabled(next);
        this.ui.setSoundIcon(next);
      },
      onLeave: () => this._handleLeaveRoom(),
      onCellClick: (index) => this._handleCellClick(index),
      onPlayAgain: () => {
        this.sounds.playClick();
        this.network.playAgain();
      },
    });
  }

  _checkUrlRoomParam() {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) this.ui.roomCodeInput.value = room.toUpperCase();
  }

  async _handlePlay(rawNickname) {
    const nickname = sanitizeNickname(rawNickname);
    this.ui.setButtonsBusy(true);
    try {
      const { roomCode } = await this.network.findOrCreateMatch(nickname, generateRoomCode);
      this._enterGame(roomCode);
    } catch (err) {
      console.error(err);
      this.ui.showLandingError('Could not find or create a match. Check your Firebase configuration.');
    } finally {
      this.ui.setButtonsBusy(false);
    }
  }

  async _handleJoinRoom(rawNickname, rawCode) {
    const nickname = sanitizeNickname(rawNickname);
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) {
      this.ui.showLandingError('Enter a room code to join.');
      return;
    }
    this.ui.setButtonsBusy(true);
    try {
      const { roomCode } = await this.network.joinRoom(code, nickname);
      this._enterGame(roomCode);
    } catch (err) {
      console.error(err);
      if (err.message === 'ROOM_NOT_FOUND') {
        this.ui.showLandingError(`Room "${code}" doesn't exist.`);
      } else {
        this.ui.showLandingError('Could not join room. Check your Firebase configuration.');
      }
    } finally {
      this.ui.setButtonsBusy(false);
    }
  }

  _enterGame(roomCode) {
    this.playersMap = {};
    this._wireNetworkCallbacks();
    this.ui.showGameScreen(roomCode);
    this.ui.setSoundIcon(this.sounds.enabled);
    this.sounds.playJoin();

    const symbol = this.network.mySymbol;
    if (symbol === 'spectator') {
      this.ui.toast("Both seats are taken — you're spectating.", 'info');
    } else {
      this.ui.toast(`You're playing as ${symbol}`, 'info');
    }
  }

  _wireNetworkCallbacks() {
    this.network.onRoomUpdate = (room) => {
      if (room.players) {
        // Source of truth for seats: a rematch can swap X/O between the
        // two seated players, which only shows up here (child_added/
        // child_removed below don't fire for a symbol-only change).
        this.playersMap = room.players;
        this.ui.renderPlayers(this.playersMap, this.network.mySymbol, this.network.playerId);
      }
      this._handleStatusTransition(room);
      this.ui.renderRoom(room, this.network.mySymbol);
      this._handleMatchmakingCountdown(room);
      this._maybeTriggerBotMove(room);
    };

    this.network.onSymbolChanged = (newSymbol) => {
      this.ui.toast(`New round — you're now playing as ${newSymbol}`, 'info');
    };

    this.network.onPlayerAdded = (id, data) => {
      this.playersMap[id] = data;
      this.ui.renderPlayers(this.playersMap, this.network.mySymbol, this.network.playerId);
      this.ui.toast(`${data.nickname} joined`, 'info');
      this.sounds.playJoin();
    };

    this.network.onPlayerRemoved = (id, data) => {
      delete this.playersMap[id];
      this.ui.renderPlayers(this.playersMap, this.network.mySymbol, this.network.playerId);
      if (data) {
        this.ui.toast(`${data.nickname} left`, 'info');
        this.sounds.playLeave();
        // If a seated player (X or O) disconnects mid-match, clear the
        // board so a new player can take that seat without the game
        // being stuck showing a stale in-progress state.
        if (data.symbol === 'X' || data.symbol === 'O') {
          this.network.resetRoomForDisconnect();
        }
      }
    };

    this.network.watchConnectionState();
    this.network.onConnectionStateChanged = (connected) => {
      if (!connected) this.ui.toast('Connection lost — reconnecting…', 'warn');
    };

    // Seed the initial player list (child_added won't fire retroactively for
    // our own listener setup timing edge cases, so do one explicit read).
    this.network.playersRef.once('value').then((snap) => {
      this.playersMap = snap.val() || {};
      this.ui.renderPlayers(this.playersMap, this.network.mySymbol, this.network.playerId);
    });
  }

  /**
   * Only the waiting player (X, seated alone) runs this countdown — it's
   * purely a client-side UI timer plus a single call to activateBot()
   * when it expires. If a real opponent joins first, room.status flips to
   * 'playing' and this tears the timer down on the next update.
   */
  _handleMatchmakingCountdown(room) {
    const iAmWaitingAlone = this.network.mySymbol === 'X' && room.status === 'waiting';

    if (!iAmWaitingAlone) {
      this._stopMatchmakingCountdown();
      return;
    }

    if (this._matchmakingCountdownInterval) return; // already running

    this._matchmakingSecondsLeft = MATCH_WAIT_SECONDS;
    this.ui.showWaitingCountdown(this._matchmakingSecondsLeft);

    this._matchmakingCountdownInterval = setInterval(() => {
      this._matchmakingSecondsLeft -= 1;
      if (this._matchmakingSecondsLeft <= 0) {
        this._stopMatchmakingCountdown();
        this.network.activateBot();
        return;
      }
      this.ui.showWaitingCountdown(this._matchmakingSecondsLeft);
    }, 1000);
  }

  _stopMatchmakingCountdown() {
    if (this._matchmakingCountdownInterval) {
      clearInterval(this._matchmakingCountdownInterval);
      this._matchmakingCountdownInterval = null;
    }
    this.ui.hideWaitingCountdown();
  }

  /**
   * If we're the human (X) in a bot-mode match and it's currently O's
   * (the computer's) turn, compute and submit its move after a short
   * delay. Guarded by _botMovePendingForTurn so a burst of room updates
   * for the same turn never schedules more than one move.
   */
  _maybeTriggerBotMove(room) {
    const isBotTurn = room.mode === 'bot' && room.status === 'playing' && room.turn === 'O';
    if (!isBotTurn || this.network.mySymbol !== 'X') return;

    const turnKey = Object.values(room.cells || {}).join(''); // changes every move, safe-ish dedupe key
    if (this._botMovePendingForTurn === turnKey) return;
    this._botMovePendingForTurn = turnKey;

    clearTimeout(this._botMoveTimeout);
    this._botMoveTimeout = setTimeout(() => {
      const index = computeBotMove(room.cells || {});
      if (index >= 0) this.network.attemptBotMove(index);
    }, BOT_MOVE_DELAY_MS);
  }

  _handleStatusTransition(room) {
    if (this.lastStatus === room.status) return;
    const prev = this.lastStatus;
    this.lastStatus = room.status;
    if (prev === null) return; // don't fire sounds on initial load

    if (room.status === 'won') {
      this.sounds.playWin();
    } else if (room.status === 'draw') {
      this.sounds.playDraw();
    }
  }

  _handleCellClick(index) {
    if (this.network.mySymbol !== 'X' && this.network.mySymbol !== 'O') return;
    this.network.attemptMove(index).then((committed) => {
      if (committed) {
        this.sounds[this.network.mySymbol === 'X' ? 'playPlaceX' : 'playPlaceO']();
      }
    });
  }

  async _handleLeaveRoom() {
    this._stopMatchmakingCountdown();
    clearTimeout(this._botMoveTimeout);
    this._botMovePendingForTurn = null;
    await this.network.leaveRoom();
    this.playersMap = {};
    this.lastStatus = null;
    this.ui.showLandingScreen();
  }
}

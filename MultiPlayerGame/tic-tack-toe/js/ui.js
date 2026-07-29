/**
 * ui.js
 * -----------------------------------------------------------------------
 * Handles all DOM UI: landing screen, the 3x3 board, status bar, score
 * chips, player cards, and toasts. game.js owns game state; this module
 * only renders it and reports user interactions back via callbacks.
 * -----------------------------------------------------------------------
 */

export class UIManager {
  constructor() {
    // Landing screen
    this.landing = document.getElementById('landing-screen');
    this.nicknameInput = document.getElementById('nickname-input');
    this.playBtn = document.getElementById('play-btn');
    this.landingError = document.getElementById('landing-error');

    // Advanced / optional: join a specific friend's room by code
    this.advancedToggle = document.getElementById('advanced-toggle');
    this.advancedPanel = document.getElementById('advanced-panel');
    this.roomCodeInput = document.getElementById('roomcode-input');
    this.joinRoomBtn = document.getElementById('join-room-btn');

    // In-game chrome
    this.gameScreen = document.getElementById('game-screen');
    this.shareRoomBtn = document.getElementById('share-room-btn');
    this.soundToggleBtn = document.getElementById('sound-toggle-btn');
    this.leaveRoomBtn = document.getElementById('leave-room-btn');
    this.hudRoomCode = document.getElementById('hud-room-code');

    // Status + scores
    this.statusBar = document.getElementById('status-bar');
    this.waitingBar = document.getElementById('waiting-bar');
    this.scoreX = document.getElementById('score-x');
    this.scoreO = document.getElementById('score-o');
    this.cardX = document.getElementById('card-x');
    this.cardO = document.getElementById('card-o');
    this.nameX = document.getElementById('name-x');
    this.nameO = document.getElementById('name-o');
    this.spectatorCount = document.getElementById('spectator-count');

    // Board
    this.cellEls = Array.from(document.querySelectorAll('.cell'));
    this.playAgainBtn = document.getElementById('play-again-btn');

    // Toasts
    this.toastContainer = document.getElementById('toast-container');
    this._addMultiplayerHubNavigation();
  }

  _addMultiplayerHubNavigation() {
    const goToHub = () => { window.location.href = '../index.html'; };

    const landingCard = this.landing.querySelector('.landing-card');
    if (landingCard) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'multiplayer-hub-btn';
      button.textContent = '← All Multiplayer Games';
      button.addEventListener('click', goToHub);
      landingCard.appendChild(button);
    }

    const chromeButtons = document.querySelector('.chrome-buttons');
    if (chromeButtons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon-btn multiplayer-hub-icon';
      button.title = 'All Multiplayer Games';
      button.setAttribute('aria-label', 'All Multiplayer Games');
      button.textContent = '←';
      button.addEventListener('click', goToHub);
      chromeButtons.prepend(button);
    }
  }

  bindLandingActions({ onPlay, onJoinCode }) {
    this.playBtn.addEventListener('click', () => onPlay(this.nicknameInput.value));
    this.nicknameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.playBtn.click();
    });

    // Advanced: join a specific friend's room by code, hidden by default
    // so the primary flow is just "enter name, tap Play".
    this.advancedToggle.addEventListener('click', () => {
      this.advancedPanel.classList.toggle('hidden');
    });
    this.joinRoomBtn.addEventListener('click', () =>
      onJoinCode(this.nicknameInput.value, this.roomCodeInput.value)
    );
    this.roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinRoomBtn.click();
    });
  }

  bindChromeActions({ onShare, onSoundToggle, onLeave, onCellClick, onPlayAgain }) {
    this.shareRoomBtn.addEventListener('click', onShare);
    this.soundToggleBtn.addEventListener('click', onSoundToggle);
    this.leaveRoomBtn.addEventListener('click', onLeave);
    this.playAgainBtn.addEventListener('click', onPlayAgain);
    this.cellEls.forEach((cell) => {
      cell.addEventListener('click', () => onCellClick(Number(cell.dataset.index)));
    });
  }

  showLandingError(message) {
    this.landingError.textContent = message;
    this.landingError.classList.add('visible');
    setTimeout(() => this.landingError.classList.remove('visible'), 3500);
  }

  setButtonsBusy(busy) {
    this.playBtn.disabled = busy;
    this.joinRoomBtn.disabled = busy;
    this.playBtn.classList.toggle('busy', busy);
    this.joinRoomBtn.classList.toggle('busy', busy);
  }

  showGameScreen(roomCode) {
    this.landing.classList.add('fade-out');
    setTimeout(() => this.landing.classList.add('hidden'), 500);
    this.gameScreen.classList.remove('hidden');
    requestAnimationFrame(() => this.gameScreen.classList.add('visible'));
    this.hudRoomCode.textContent = roomCode;
  }

  showLandingScreen() {
    this.gameScreen.classList.add('hidden');
    this.gameScreen.classList.remove('visible');
    this.landing.classList.remove('hidden', 'fade-out');
  }

  setSoundIcon(enabled) {
    this.soundToggleBtn.textContent = enabled ? '🔊' : '🔇';
    this.soundToggleBtn.classList.toggle('muted', !enabled);
  }

  async shareRoom(roomCode) {
    const url = `${location.origin}${location.pathname}?room=${roomCode}`;
    const shareData = { title: 'Tic-Tac-Toe Arena', text: `Join my room "${roomCode}"!`, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        this.toast('Room link copied to clipboard!', 'success');
      }
    } catch (err) {
      console.warn('Share failed', err);
    }
  }

  /** Show the "waiting for opponent, starting vs Computer in Ns" countdown line. */
  showWaitingCountdown(secondsLeft) {
    this.waitingBar.textContent = `No opponent yet — starting a match vs Computer in ${secondsLeft}s…`;
    this.waitingBar.classList.remove('hidden');
  }

  hideWaitingCountdown() {
    this.waitingBar.classList.add('hidden');
  }

  toast(message, kind = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = message;
    this.toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 3000);
  }

  /**
   * Render the full board + status from a room snapshot.
   * @param {object} room - the raw Firebase room object.
   * @param {string} mySymbol - 'X' | 'O' | 'spectator'
   */
  renderRoom(room, mySymbol) {
    const cells = room.cells || {};
    const winLine = room.winningLine ? room.winningLine.split(',').map(Number) : [];

    this.cellEls.forEach((cellEl, i) => {
      const value = cells[i] || '';
      const changed = cellEl.dataset.value !== value && value !== '';
      cellEl.dataset.value = value;
      cellEl.textContent = value;
      cellEl.className = 'cell' + (value ? ` filled ${value.toLowerCase()}` : '');
      if (winLine.includes(i)) cellEl.classList.add('win');
      if (changed) {
        cellEl.classList.add('pop');
        setTimeout(() => cellEl.classList.remove('pop'), 220);
      }
      const clickable = room.status === 'playing' && mySymbol === room.turn && !value;
      cellEl.classList.toggle('clickable', clickable);
    });

    this.scoreX.textContent = (room.scores && room.scores.X) || 0;
    this.scoreO.textContent = (room.scores && room.scores.O) || 0;

    this.cardX.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'X');
    this.cardO.classList.toggle('active-turn', room.status === 'playing' && room.turn === 'O');

    // Status bar text
    let text = '';
    if (room.status === 'waiting') {
      text = 'Waiting for an opponent to join…';
    } else if (room.status === 'playing') {
      if (mySymbol === 'spectator') {
        text = `${room.turn}'s turn`;
      } else {
        text = mySymbol === room.turn ? 'Your turn' : "Opponent's turn";
      }
    } else if (room.status === 'won') {
      if (mySymbol === room.winner) text = 'You win! 🎉';
      else if (mySymbol === 'spectator') text = `${room.winner} wins!`;
      else text = `${room.winner} wins — better luck next round`;
    } else if (room.status === 'draw') {
      text = "It's a draw!";
    }
    this.statusBar.textContent = text;
    this.statusBar.className = 'status-bar status-' + room.status;

    this.playAgainBtn.classList.toggle('hidden', !(room.status === 'won' || room.status === 'draw'));
  }

  renderPlayers(playersMap, mySymbol, myId) {
    let xName = '--';
    let oName = '--';
    let spectators = 0;

    for (const [id, p] of Object.entries(playersMap)) {
      const label = id === myId ? `${p.nickname} (you)` : p.nickname;
      if (p.symbol === 'X') xName = label;
      else if (p.symbol === 'O') oName = label;
      else spectators++;
    }

    this.nameX.textContent = xName;
    this.nameO.textContent = oName;
    this.spectatorCount.textContent = spectators > 0 ? `👀 ${spectators} watching` : '';
  }
}

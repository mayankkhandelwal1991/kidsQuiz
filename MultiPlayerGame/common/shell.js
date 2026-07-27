/**
 * common/shell.js
 * -----------------------------------------------------------------------
 * Every game's index.html includes the same landing screen and in-game
 * "chrome" markup (topbar, share/sound/leave buttons, toast container,
 * waiting-for-opponent bar) with the same element ids. This class wires
 * all of that up once so each game's own app.js only has to deal with
 * its actual gameplay UI.
 * -----------------------------------------------------------------------
 */

import { loadSavedNickname, saveNickname } from './utils.js';

export class GameShell {
  constructor({ gameTitle }) {
    this.gameTitle = gameTitle;

    this.landing = document.getElementById('landing-screen');
    this.nicknameInput = document.getElementById('nickname-input');
    this.playBtn = document.getElementById('play-btn');
    this.landingError = document.getElementById('landing-error');

    this.advancedToggle = document.getElementById('advanced-toggle');
    this.advancedPanel = document.getElementById('advanced-panel');
    this.roomCodeInput = document.getElementById('roomcode-input');
    this.joinRoomBtn = document.getElementById('join-room-btn');

    this.gameScreen = document.getElementById('game-screen');
    this.shareRoomBtn = document.getElementById('share-room-btn');
    this.soundToggleBtn = document.getElementById('sound-toggle-btn');
    this.leaveRoomBtn = document.getElementById('leave-room-btn');
    this.hudRoomCode = document.getElementById('hud-room-code');

    this.waitingBar = document.getElementById('waiting-bar');
    this.toastContainer = document.getElementById('toast-container');

    // Prefill the remembered nickname, if any.
    if (this.nicknameInput) {
      this.nicknameInput.value = loadSavedNickname();
    }

    this._checkUrlRoomParam();
  }

  _checkUrlRoomParam() {
    if (!this.roomCodeInput) return;
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) this.roomCodeInput.value = room.toUpperCase();
  }

  bindLandingActions({ onPlay, onJoinCode }) {
    this.playBtn.addEventListener('click', () => {
      saveNickname(this.nicknameInput.value.trim());
      onPlay(this.nicknameInput.value);
    });
    this.nicknameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.playBtn.click();
    });

    if (this.advancedToggle) {
      this.advancedToggle.addEventListener('click', () => {
        this.advancedPanel.classList.toggle('hidden');
      });
      this.joinRoomBtn.addEventListener('click', () => {
        saveNickname(this.nicknameInput.value.trim());
        onJoinCode(this.nicknameInput.value, this.roomCodeInput.value);
      });
      this.roomCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.joinRoomBtn.click();
      });
    }
  }

  bindChromeActions({ onShare, onSoundToggle, onLeave }) {
    this.shareRoomBtn.addEventListener('click', onShare);
    this.soundToggleBtn.addEventListener('click', onSoundToggle);
    this.leaveRoomBtn.addEventListener('click', onLeave);
  }

  showError(message) {
    this.landingError.textContent = message;
    this.landingError.classList.add('visible');
    setTimeout(() => this.landingError.classList.remove('visible'), 3500);
  }

  setBusy(busy) {
    this.playBtn.disabled = busy;
    this.playBtn.classList.toggle('busy', busy);
    if (this.joinRoomBtn) {
      this.joinRoomBtn.disabled = busy;
      this.joinRoomBtn.classList.toggle('busy', busy);
    }
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
    const shareData = { title: this.gameTitle, text: `Join my room "${roomCode}"!`, url };
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

  showWaitingCountdown(secondsLeft, opponentLabel = 'Computer') {
    this.waitingBar.textContent = `No opponent yet — starting a match vs ${opponentLabel} in ${secondsLeft}s…`;
    this.waitingBar.classList.remove('hidden');
  }

  hideWaitingCountdown() {
    this.waitingBar.classList.add('hidden');
  }
}

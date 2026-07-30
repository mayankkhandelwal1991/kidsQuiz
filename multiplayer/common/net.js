/**
 * common/net.js
 * -----------------------------------------------------------------------
 * Shared Firebase Realtime Database plumbing used by every game:
 *   - QuickMatch: pairs two players into the same room without either of
 *     them needing to exchange a code first ("Play" button matchmaking).
 *   - claimSeat: atomically assigns a player to the first open seat
 *     (e.g. 'X'/'O', 'P1'/'P2', 'R'/'Y') or 'spectator' if both are taken.
 *   - setupPresence / watchConnectionState / measurePing: connection
 *     bookkeeping identical across all games.
 *
 * Each game keeps its own data under `games/{gameId}/...` in the same
 * database, so every game is fully isolated from every other one.
 * -----------------------------------------------------------------------
 */

/**
 * QuickMatch pairs players via a single shared "lobby" pointer per game:
 * games/{gameId}/lobby/waitingRoom = <room code currently waiting, or null>
 *
 * Calling findOrCreateMatch() runs one Firebase transaction on that
 * pointer. Because transactions retry against the latest server value,
 * two players calling this at nearly the same instant can never both end
 * up "waiting" or both create separate rooms — exactly one room gets
 * created and the other player is paired into it.
 */
export class QuickMatch {
  constructor(db, gameId) {
    this.db = db;
    this.gameId = gameId;
    this.lobbyRef = db.ref(`games/${gameId}/lobby/waitingRoom`);
  }

  roomRef(code) {
    return this.db.ref(`games/${this.gameId}/rooms/${code}`);
  }

  /**
   * @param {function(code:string):object} buildInitialRoom - returns the
   *   full initial room object to write when this client ends up creating
   *   a new room (only called if we're the one waiting, not the joiner).
   * @param {function():string} roomCodeGenerator
   * @returns {{roomCode: string, isCreator: boolean}}
   */
  async findOrCreateMatch(buildInitialRoom, roomCodeGenerator) {
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
      const snap = await this.roomRef(existingCode).once('value');
      if (snap.exists()) {
        return { roomCode: existingCode, isCreator: false };
      }
      // The room we found is gone (its creator vanished) — start our own wait instead.
      await this.roomRef(myCandidateCode).set(buildInitialRoom(myCandidateCode));
      await this.lobbyRef.set(myCandidateCode);
      return { roomCode: myCandidateCode, isCreator: true };
    }

    await this.roomRef(myCandidateCode).set(buildInitialRoom(myCandidateCode));
    return { roomCode: myCandidateCode, isCreator: true };
  }

  /** Clear the lobby pointer if it still points at `code` — safe to call from either side. */
  async clearIfMatches(code) {
    await this.lobbyRef.transaction((current) => (current === code ? null : current));
  }

  /** Join a specific room by code (used by the "Have a friend's code?" advanced flow). */
  async roomExists(code) {
    const snap = await this.roomRef(code).once('value');
    return snap.exists();
  }
}

/**
 * Atomically assign `playerId` to the first open seat in `seatNames`
 * (e.g. ['X','O'], ['P1','P2'], ['R','Y']), or 'spectator' if all are
 * taken. Runs as a transaction on the room's `players` node so two
 * players joining at the same instant can never claim the same seat.
 */
export async function claimSeat(playersRef, seatNames, playerId, nickname) {
  const result = await playersRef.transaction((players) => {
    players = players || {};
    const taken = Object.values(players).map((p) => p.seat);
    let seat = 'spectator';
    for (const s of seatNames) {
      if (!taken.includes(s)) {
        seat = s;
        break;
      }
    }
    players[playerId] = { nickname, seat, joinedAt: Date.now() };
    return players;
  });
  return result.snapshot.child(playerId).child('seat').val();
}

/** Presence + disconnect cleanup: remove our player node the instant the connection drops. */
export function setupPresence(selfRef) {
  selfRef.onDisconnect().remove();
}

/** Watch Firebase's built-in connection state (used for "reconnecting…" toasts). */
export function watchConnectionState(db, onChange) {
  db.ref('.info/connected').on('value', (snap) => onChange(!!snap.val()));
}

/** Round-trip latency estimate for the HUD ping display. */
export async function measurePing(db) {
  const start = Date.now();
  try {
    await db.ref('.info/serverTimeOffset').once('value');
    return Date.now() - start;
  } catch {
    return -1;
  }
}

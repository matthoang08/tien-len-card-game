/**
 * Tien Len Card Game - Main Game Interface
 * 
 * This is the primary game interface for the Tien Len card game.
 * It provides a retro pixel-art styled UI with full game functionality
 * including card selection, move validation, AI opponents, and multiplayer support.
 * 
 * Features:
 * - 4-player game table layout
 * - Interactive card selection
 * - Turn-based gameplay with move validation
 * - AI opponents (players 1-3)
 * - WebSocket multiplayer support
 * - Retro pixel art styling with CRT effects
 * - Background music
 * - Game diagnostics and testing tools
 * 
 * @module GamePage
 */

'use client';

import React, { useMemo, useState } from 'react';
import {
  buildDeck,
  shuffle,
  dealPlayers,
  detectCombo,
  compareCombos,
  cardToString,
  initSinglePlayer,
  isLegalMove,
  applyMove,
  applyPass,
  aiChooseMove,
  type Card,
  type Combo,
  type GameState,
  type Suit,
  type Rank,
} from '@/game/tienlen';

function prettyCombo(c: Combo | null) {
  if (!c) return 'null';
  return `${c.type} [${c.cards.map(cardToString).join(', ')}] (primary=${c?.primaryRank})`;
}

/* Pixel-art playing card component */
function PixelCard({
  card,
  selected = false,
  onClick,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
}) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  // Minimal pixel-like suit glyphs using unicode; could be swapped for sprites later
  const suitGlyph = card.suit;

  return (
    <button
      onClick={onClick}
      className="pixel-card"
      data-suit={card.suit}
      data-selected={selected ? 'true' : 'false'}
      title={`${cardToString(card)}`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <span className="rank" style={{ color: isRed ? '#ff7a7a' : 'inherit' }}>
        {card.rank}
      </span>
      <span className="suit">{suitGlyph}</span>
    </button>
  );
}

export default function TestPage() {
  const [seed, setSeed] = useState<number>(Date.now());
  // Simple deterministic RNG based on seed
  const rng = useMemo(() => {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }, [seed]);

  // Remove separate demo deck/hands to avoid confusion with the actual game state.
  // Use only the game state's hands everywhere so Player 0 consistently matches the UI.
  const [state, setState] = useState<GameState>(() => initSinglePlayer(rng));
  const [startMsg, setStartMsg] = useState<string>('');
  const [winnerMsg, setWinnerMsg] = useState<string>('');

  const [inputA, setInputA] = useState<string>('3♣');
  const [inputB, setInputB] = useState<string>('4♣');
  const [comboA, setComboA] = useState<Combo | null>(null);
  const [comboB, setComboB] = useState<Combo | null>(null);
  const [compareResult, setCompareResult] = useState<number | null>(null);

  function parseCardsList(s: string): Card[] {
    // parse "3♣, 3♦, 3♥"
    return s
      .split(',')
      .map((x) => x.trim())
      .map((t) => {
        const suit = t.slice(-1) as Suit;
        const rank = t.slice(0, t.length - 1) as Rank;
        if (!['♠', '♥', '♦', '♣'].includes(suit)) return null;
        // the engine already validates ranks; we just structure object here
        return { rank, suit } as Card;
      })
      .filter(Boolean) as Card[];
  }

  const doDetect = () => {
    const a = detectCombo(parseCardsList(inputA));
    const b = detectCombo(parseCardsList(inputB));
    setComboA(a);
    setComboB(b);
    setCompareResult(a && b ? compareCombos(a, b) : null);
  };

  // Removed demo reshuffle that dealt independent hands; game should be reinitialized instead.
  const reshuffle = () => {
    // For clarity, reinit the single-player game to reshuffle and redeal using the engine.
    const ns = initSinglePlayer(rng);
    setState(ns);
    // Compose start message explaining who starts and why.
    try {
      const starter = ns.currentPlayer;
      const has3s = ns.hands[starter]?.some((c) => c.rank === '3' && c.suit === '♠');
      setStartMsg(
        has3s
          ? `Player ${starter} starts because they hold the 3♠ (3 of spades).`
          : `Player ${starter} starts (previous winner).`
      );
    } catch {
      setStartMsg('');
    }
  };

  const reinitGame = () => {
    // Keep the same seeded RNG to ensure UI/state consistency when resetting.
    const ns = initSinglePlayer(rng);
    setState(ns);
    try {
      const starter = ns.currentPlayer;
      const has3s = ns.hands[starter]?.some((c) => c.rank === '3' && c.suit === '♠');
      setStartMsg(
        has3s
          ? `Player ${starter} starts because they hold the 3♠ (3 of spades).`
          : `Player ${starter} starts (previous winner).`
      );
    } catch {
      setStartMsg('');
    }
  };

  const [selection, setSelection] = useState<Card[]>([]);
  const currentHand = state.hands[state.currentPlayer] ?? [];

  const isSelected = (c: Card) =>
    selection.findIndex((x) => x.rank === c.rank && x.suit === c.suit) >= 0;

  const toggleSelect = (c: Card) => {
    setSelection((prev) => {
      const i = prev.findIndex((x) => x.rank === c.rank && x.suit === c.suit);
      if (i >= 0) {
        const copy = prev.slice();
        copy.splice(i, 1);
        return copy;
      }
      return [...prev, c];
    });
  };

  const playSelected = () => {
    // Only allow the local human to act when it is their turn (assume human is player 0 in single-player)
    if (state.currentPlayer !== 0) {
      alert('Wait for your turn.');
      return;
    }
    const legal = isLegalMove(state, state.currentPlayer, selection);
    if (!legal.ok || !legal.combo) {
      alert(`Illegal: ${legal.reason || 'invalid'}`);
      return;
    }
    const ns = applyMove(state, state.currentPlayer, legal.combo);
    setState(ns);
    setSelection([]);
    // winner check handled by effect
  };

  const passTurn = () => {
    // Only allow the local human to act when it is their turn (assume human is player 0 in single-player)
    if (state.currentPlayer !== 0) {
      alert('Wait for your turn.');
      return;
    }
    const ns = applyPass(state, state.currentPlayer);
    setState(ns);
    setSelection([]);
    // winner check handled by effect
  };

  // Auto-advance simple AI for non-human players (1..N-1).
  // Whenever currentPlayer is not 0, run a minimal AI step to keep the game moving.
  // On initial mount and any time a full new state is set (reshuffle/reinit),
  // show a message indicating who starts and why (3♣ holder or previous winner).
  React.useEffect(() => {
    if (!state.started) return;
    try {
      const starter = state.currentPlayer;
      const has3s = state.hands[starter]?.some((c) => c.rank === '3' && c.suit === '♠');
      setStartMsg(
        has3s
          ? `Player ${starter} starts because they hold the 3♠ (3 of spades).`
          : `Player ${starter} starts (previous winner).`
      );
    } catch {
      // ignore
    }
  }, [state.started, state.hands, state.currentPlayer]);

  // Winner detection and message
  React.useEffect(() => {
    if (!state.started) return;
    if (!state.finished) {
      setWinnerMsg('');
      return;
    }
    // Determine winner by the player who just played out (current player advanced already)
    // The player who won is the previous one in turn order.
    const prev = (state.currentPlayer - 1 + state.players) % state.players;
    setWinnerMsg(`Player ${prev} wins the game!`);
  }, [state.finished, state.currentPlayer, state.players, state.started]);

  React.useEffect(() => {
    if (state.finished) return;
    if (!state.started) return;
    if (state.currentPlayer === 0) return; // human's turn

    // Add a short delay to make AI actions readable
    const t = setTimeout(() => {
      const player = state.currentPlayer;
      // Try to choose a move
      const { play } = aiChooseMove(state, player);
      if (play && play.length > 0) {
        const legal = isLegalMove(state, player, play);
        if (legal.ok && legal.combo) {
          setState(applyMove(state, player, legal.combo));
          return;
        }
      }
      // If no playable move (or illegal), pass
      setState(applyPass(state, player));
    }, 450);

    return () => clearTimeout(t);
  }, [state]);

  // Simple background music controller
  const [musicReady, setMusicReady] = useState(false);
  const [musicOn, setMusicOn] = useState(true);

  React.useEffect(() => {
    if (!musicOn) return;
    // Create and manage audio element for background loop
    const audio = new Audio('https://cdn.pixabay.com/audio/2023/09/08/audio_8b6c7d1fa1.mp3');
    // Royalty-free chill/lofi placeholder. Replace URL with preferred track when available.
    audio.loop = true;
    audio.volume = 0.35; // moderately quiet background
    let started = false;

    const tryPlay = () => {
      if (started) return;
      started = true;
      audio
        .play()
        .then(() => setMusicReady(true))
        .catch(() => {
          // Autoplay might be blocked; wait for a user gesture
          const resumeOnInteract = () => {
            audio
              .play()
              .then(() => {
                setMusicReady(true);
                window.removeEventListener('pointerdown', resumeOnInteract);
                window.removeEventListener('keydown', resumeOnInteract);
              })
              .catch(() => {
                // still blocked; keep listeners
              });
          };
          window.addEventListener('pointerdown', resumeOnInteract);
          window.addEventListener('keydown', resumeOnInteract);
        });
    };

    // Try to start immediately; if blocked, our handlers will resume after gesture.
    tryPlay();

    return () => {
      setMusicReady(false);
      audio.pause();
      audio.src = '';
    };
  }, [musicOn]);

  return (
    <div className="p-4 sm:p-6 text-sm h-[100svh] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold pixel-chip inline-block">Tien-Len</h1>
        <div className="flex gap-2 items-center">
          <button className="px-3 py-1 border rounded" onClick={reinitGame} title="New game (same seed)">
            Reinit
          </button>
          <button className="px-3 py-1 border rounded" onClick={reshuffle} title="Shuffle & Deal">
            Shuffle + Deal
          </button>
          <div className={`pixel-chip ${state.currentPlayer === 0 ? 'bg-green-600 text-white shadow-[0_0_0_2px_#34d399_inset]' : ''}`}>
            {state.currentPlayer === 0 ? 'Your Turn' : `Turn: Player ${state.currentPlayer}`}
          </div>
          <div className="pixel-chip">You are Player 0</div>
          <div className="pixel-chip">Passes: {state.passesInRow}</div>
          <button
            className={`pixel-btn ${musicOn ? 'bg-emerald-600 text-white' : ''}`}
            title={musicOn ? 'Turn off music' : 'Turn on music'}
            onClick={() => setMusicOn((v) => !v)}
          >
            {musicOn ? 'Music: On' : 'Music: Off'}
          </button>
        </div>
      </div>

      {startMsg && (
        <div className="mb-2 flex flex-wrap gap-2 items-center">
          <div className="pixel-chip bg-amber-500 text-black">{startMsg}</div>
          {!musicReady && musicOn && (
            <div className="pixel-chip bg-indigo-600 text-white" title="Click anywhere to enable audio">
              Click or press a key to enable music
            </div>
          )}
        </div>
      )}

      {/* GAME OVER OVERLAY */}
      {winnerMsg && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="retro-panel p-4 text-center space-y-3">
            <div className="text-lg font-semibold pixel-chip bg-amber-400 text-black">{winnerMsg}</div>
            <div className="flex gap-2 justify-center">
              <button
                className="pixel-btn"
                onClick={() => {
                  const ns = initSinglePlayer(rng);
                  setState(ns);
                  setWinnerMsg('');
                  // Also recompute start message
                  try {
                    const starter = ns.currentPlayer;
                    const has3s = ns.hands[starter]?.some((c) => c.rank === '3' && c.suit === '♠');
                    setStartMsg(
                      has3s
                        ? `Player ${starter} starts because they hold the 3♠ (3 of spades).`
                        : `Player ${starter} starts (previous winner).`
                    );
                  } catch {
                    setStartMsg('');
                  }
                }}
              >
                Start New Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE LAYOUT */}
      <div className="relative flex-1 min-h-0 rounded-lg border bg-[radial-gradient(circle_at_center,_#0f172a_0%,_#0b1220_60%,_#081018_100%)] overflow-hidden">
        {/* Left opponent: Player 1 (vertical stack with ~50% overlap, cards tilted 90deg) */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <div className="retro-panel p-2">
            <div className="font-semibold mb-1 pixel-chip inline-block">Player 1</div>
            <div
              className="flex flex-col items-center"
              style={{
                // Simulate 50% overlap: negative margin equals ~half of card height (48px -> 24px)
                gap: 0,
              }}
            >
              {state.hands[1]?.map((_, idx) => (
                <div
                  key={idx}
                  className="pixel-card"
                  title="Facedown"
                  aria-label="Facedown card"
                  style={{
                    background:
                      'repeating-linear-gradient(45deg, #1f2937 0, #1f2937 6px, #111827 6px, #111827 12px)',
                    color: 'transparent',
                    position: 'relative',
                    height: '48px',
                    width: '34px',
                    transform: 'rotate(90deg)',
                    marginTop: idx === 0 ? 0 : -24, // 50% overlap
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'block',
                      border: '2px solid #374151',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right opponent: Player 3 (vertical stack with ~50% overlap, cards tilted 90deg) */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="retro-panel p-2">
            <div className="font-semibold mb-1 pixel-chip inline-block">Player 3</div>
            <div
              className="flex flex-col items-center"
              style={{
                gap: 0,
              }}
            >
              {state.hands[3]?.map((_, idx) => (
                <div
                  key={idx}
                  className="pixel-card"
                  title="Facedown"
                  aria-label="Facedown card"
                  style={{
                    background:
                      'repeating-linear-gradient(45deg, #1f2937 0, #1f2937 6px, #111827 6px, #111827 12px)',
                    color: 'transparent',
                    position: 'relative',
                    height: '48px',
                    width: '34px',
                    transform: 'rotate(90deg)',
                    marginTop: idx === 0 ? 0 : -24, // 50% overlap
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'block',
                      border: '2px solid #374151',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top opponent: Player 2 (smaller placeholders consistent with AI players) */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
          <div className="retro-panel p-2">
            <div className="font-semibold mb-1 pixel-chip inline-block">Player 2</div>
            <div className="flex items-center justify-center" style={{ gap: 0 }}>
              {state.hands[2]?.map((_, idx) => (
                <div
                  key={idx}
                  className="pixel-card"
                  title="Facedown"
                  aria-label="Facedown card"
                  style={{
                    background:
                      'repeating-linear-gradient(45deg, #1f2937 0, #1f2937 6px, #111827 6px, #111827 12px)',
                    color: 'transparent',
                    position: 'relative',
                    height: '48px',
                    width: '34px',
                    marginLeft: idx === 0 ? 0 : -17, // slight horizontal overlap (~50% of width)
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'block',
                      border: '2px solid #374151',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center pile / current play + turn badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="retro-panel p-3 min-w-[260px] text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="font-semibold pixel-chip">Current Play</div>
              <div
                className={`pixel-chip ${
                  state.currentPlayer === 0
                    ? 'bg-green-600 text-white shadow-[0_0_0_2px_#34d399_inset]'
                    : 'bg-slate-700 text-slate-100'
                }`}
                title="Whose turn"
              >
                {state.currentPlayer === 0 ? 'Your Turn' : `Player ${state.currentPlayer}`}
              </div>
            </div>
            <div className="card-row justify-center">
              {state.lastCombo ? (
                state.lastCombo.cards.map((c, i) => <PixelCard key={i} card={c} />)
              ) : (
                <div className="pixel-chip">No cards on table</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Player 0 (You) */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[min(100%,_1100px)]">
          <div className="retro-panel p-3">
            <div className="font-semibold mb-2 pixel-chip inline-block">
              Your Hand {state.currentPlayer === 0 ? '(Your turn)' : ''}
            </div>
            <div className="card-row">
              {state.hands[0]?.map((c, i) => (
                <PixelCard
                  key={i}
                  card={c}
                  selected={isSelected(c)}
                  onClick={state.currentPlayer === 0 ? () => toggleSelect(c) : undefined}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <button
                className={`pixel-btn disabled:opacity-50 ${
                  state.currentPlayer === 0 ? 'ring-2 ring-green-400 ring-offset-2' : ''
                }`}
                onClick={playSelected}
                disabled={state.currentPlayer !== 0}
                title={state.currentPlayer !== 0 ? 'Wait for your turn' : 'Play a valid combo'}
              >
                {state.currentPlayer === 0 ? 'Play Selected (Your turn)' : 'Play Selected'}
              </button>
              <button
                className={`pixel-btn disabled:opacity-50 ${
                  state.currentPlayer === 0 ? 'ring-2 ring-green-400 ring-offset-2' : ''
                }`}
                onClick={passTurn}
                disabled={state.currentPlayer !== 0}
                title={state.currentPlayer !== 0 ? 'Wait for your turn' : 'Pass your turn'}
              >
                {state.currentPlayer === 0 ? 'Pass (Your turn)' : 'Pass'}
              </button>
              <div className="pixel-chip">Selected: [{selection.map(cardToString).join(', ')}]</div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics collapsible block */}
      <details className="mt-4 open:mb-0">
        <summary className="cursor-pointer pixel-chip">Diagnostics</summary>
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-2">
              A:
              <input
                className="border px-2 py-1 rounded"
                value={inputA}
                onChange={(e) => setInputA(e.target.value)}
                placeholder="e.g. 3♣, 3♦"
              />
            </label>
            <label className="flex items-center gap-2">
              B:
              <input
                className="border px-2 py-1 rounded"
                value={inputB}
                onChange={(e) => setInputB(e.target.value)}
                placeholder="e.g. 4♣, 4♦"
              />
            </label>
            <button className="px-3 py-1 border rounded" onClick={doDetect}>
              Detect + Compare
            </button>
          </div>
          <div className="space-y-1">
            <div>A: {prettyCombo(comboA)}</div>
            <div>B: {prettyCombo(comboB)}</div>
            <div>{compareResult === null ? 'n/a' : String(compareResult)}</div>
          </div>
        </div>
      </details>
    </div>
  );
}

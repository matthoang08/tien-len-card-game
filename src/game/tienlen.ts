/**
 * Tien Len (Vietnamese card game) core types and rules engine
 * 
 * Tien Len is a Vietnamese card game where players try to get rid of all their cards
 * by playing valid combinations that beat the previous play.
 * 
 * Game Rules:
 * - Card ranking (low to high): 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2
 * - Valid combinations: singles, pairs, triples, straights, bombs (4-of-a-kind)
 * - Players must beat the previous play or pass
 * - First player to empty their hand wins
 * 
 * @module tienlen
 */

// Suits (no inherent hierarchy in most rules, used for tie-breaks only if needed)
export type Suit = '♠' | '♥' | '♦' | '♣';

// In Tien Len, ranking from lowest to highest is typically: 3,4,5,6,7,8,9,10,J,Q,K,A,2
export const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'] as const;
export type Rank = typeof RANKS[number];

export type Card = { rank: Rank; suit: Suit }; // 52-card deck

export function cardToString(c: Card): string {
  return `${c.rank}${c.suit}`;
}

export function parseCard(s: string): Card | null {
  // Accept forms like "3♠", "10♥", "J♦", "A♣"
  const suit = s.slice(-1) as Suit;
  const rank = s.slice(0, s.length - 1) as Rank;
  if (!['♠','♥','♦','♣'].includes(suit)) return null;
  if (!RANKS.includes(rank)) return null;
  return { rank, suit };
}

export function rankIndex(r: Rank): number {
  return RANKS.indexOf(r);
}

// Build a standard 52-card deck
export function buildDeck(): Card[] {
  const suits: Suit[] = ['♠','♥','♦','♣'];
  const deck: Card[] = [];
  for (const s of suits) {
    for (const r of RANKS) {
      deck.push({ rank: r, suit: s });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Basic combos we will support initially:
// - single: 1 card
// - pair: two cards same rank
// - triple: three cards same rank
// - straight: N >= 3 sequence of consecutive ranks (2 cannot be used inside straight; A-2 wrap not allowed)
// - four-of-a-kind (bomb): four cards same rank (beats anything of lower level)
// Later: consecutive pairs, three-pairs, 2-bombs, etc.
export type ComboType = 'single' | 'pair' | 'triple' | 'straight' | 'bomb4';

export type Combo = {
  type: ComboType;
  // normalized sorted cards by rank then suit for tie-break convenience
  cards: Card[];
  // strength metadata used for compare
  // primaryRank is the main comparable rank (e.g., highest rank in straight or the rank of pair/triple/four-kind)
  primaryRank: Rank;
  // for equal primaryRank ties, we may compare by suit of the highest card (very optional in Tien Len variants)
  // Here we encode a simple tie-break using the max suit sort order if needed:
  // suitOrder: ♠ < ♣ < ♦ < ♥ (or any consistent order). We'll use ♣ < ♦ < ♥ < ♠ for example.
};

const SUIT_ORDER: Suit[] = ['♣','♦','♥','♠'];
function suitIndex(s: Suit): number {
  return SUIT_ORDER.indexOf(s);
}

function sortCardsByRankSuit(cards: Card[]): Card[] {
  return cards.slice().sort((a, b) => {
    const ra = rankIndex(a.rank);
    const rb = rankIndex(b.rank);
    if (ra !== rb) return ra - rb;
    return suitIndex(a.suit) - suitIndex(b.suit);
  });
}

export function detectCombo(raw: Card[]): Combo | null {
  const cards = sortCardsByRankSuit(raw);
  if (cards.length === 0) return null;
  if (cards.length === 1) {
    return { type: 'single', cards, primaryRank: cards[0].rank };
  }
  if (cards.length === 2) {
    if (cards[0].rank === cards[1].rank) {
      return { type: 'pair', cards, primaryRank: cards[0].rank };
    }
    return null;
  }
  if (cards.length === 3) {
    if (cards.every(c => c.rank === cards[0].rank)) {
      return { type: 'triple', cards, primaryRank: cards[0].rank };
    }
    // could also be a 3-straight, but in Tien Len triples are distinct; allow straight length>=3 as well
    if (isStraight(cards)) {
      return { type: 'straight', cards, primaryRank: highestRank(cards) };
    }
    return null;
  }
  // length >= 4
  if (cards.length === 4 && cards.every(c => c.rank === cards[0].rank)) {
    return { type: 'bomb4', cards, primaryRank: cards[0].rank };
  }
  if (isStraight(cards)) {
    return { type: 'straight', cards, primaryRank: highestRank(cards) };
  }
  return null;
}

function isStraight(cards: Card[]): boolean {
  // straight of length >= 3, ranks strictly consecutive; cannot include '2'
  if (cards.length < 3) return false;
  const ranks = cards.map(c => c.rank);
  if (ranks.some(r => r === '2')) return false;
  // Ensure no duplicates by rank
  if (new Set(ranks).size !== ranks.length) return false;
  // Check consecutive
  for (let i = 1; i < ranks.length; i++) {
    if (rankIndex(ranks[i]) !== rankIndex(ranks[i-1]) + 1) return false;
  }
  return true;
}

function highestRank(cards: Card[]): Rank {
  return sortCardsByRankSuit(cards)[cards.length - 1].rank;
}

// Compare combos for a legal follow (same type and size unless bomb rule applies)
export function compareCombos(prev: Combo, next: Combo): number {
  // Returns -1 if next < prev, 0 if equal (rare), 1 if next > prev, with bomb handling
  if (prev.type === 'bomb4') {
    if (next.type === 'bomb4') {
      // compare by rank
      return Math.sign(rankIndex(next.primaryRank) - rankIndex(prev.primaryRank));
    }
    // only bombs can beat bombs (ignore special 2-bombs for now)
    return -1;
  }
  if (next.type === 'bomb4') return 1;

  if (prev.type !== next.type) return -1; // must match type unless bomb

  // Enforce identical size (for straights length must match)
  if (prev.type === 'straight') {
    if (prev.cards.length !== next.cards.length) return -1;
  } else {
    if (prev.cards.length !== next.cards.length) return -1;
  }

  const cmp = Math.sign(rankIndex(next.primaryRank) - rankIndex(prev.primaryRank));
  if (cmp !== 0) return cmp;

  // Tie-break by highest suit (optional rule). We'll use max suit in each combo.
  const prevMax = sortCardsByRankSuit(prev.cards)[prev.cards.length - 1];
  const nextMax = sortCardsByRankSuit(next.cards)[next.cards.length - 1];
  return Math.sign(suitIndex(nextMax.suit) - suitIndex(prevMax.suit));
}

// Deal cards for N players (default 4)
export function dealPlayers(deck: Card[], players = 4): Card[][] {
  const hands: Card[][] = Array.from({ length: players }, () => []);
  for (let i = 0; i < deck.length; i++) {
    hands[i % players].push(deck[i]);
  }
  // sort hands for display
  return hands.map(sortCardsByRankSuit);
}

// Game state skeleton for single-pile turns
export type PlayerId = number; // 0..N-1
export type GameState = {
  players: number;
  hands: Card[][];
  currentPlayer: PlayerId;
  lastCombo: Combo | null; // combo to beat
  passesInRow: number;
  started: boolean;
  finished: boolean;
};

// Initialize single-player (1 human + 3 simple AIs)
export function initSinglePlayer(rng = Math.random): GameState {
  const deck = shuffle(buildDeck(), rng);
  const hands = dealPlayers(deck, 4);
  // Typically, player with 3♣ starts; we’ll pick whoever has 3♣
  const starter = hands.findIndex(h => h.some(c => c.rank === '3' && c.suit === '♣'));
  return {
    players: 4,
    hands,
    currentPlayer: starter >= 0 ? starter : 0,
    lastCombo: null,
    passesInRow: 0,
    started: true,
    finished: false,
  };
}

// Validate if a move (set of cards) is legal given state
export function isLegalMove(state: GameState, player: PlayerId, cards: Card[]): { ok: boolean; reason?: string; combo?: Combo } {
  if (state.finished) return { ok: false, reason: 'game finished' };
  if (!state.started) return { ok: false, reason: 'game not started' };
  if (player !== state.currentPlayer) return { ok: false, reason: 'not your turn' };
  // verify all cards belong to player's hand
  const hand = state.hands[player].slice();
  for (const c of cards) {
    const idx = hand.findIndex(h => h.rank === c.rank && h.suit === c.suit);
    if (idx < 0) return { ok: false, reason: 'card not in hand' };
    hand.splice(idx, 1);
  }
  const combo = detectCombo(cards);
  if (!combo) return { ok: false, reason: 'invalid combo' };

  if (!state.lastCombo) {
    // starting new trick; any combo allowed
    return { ok: true, combo };
  }
  // must beat lastCombo
  if (compareCombos(state.lastCombo, combo) > 0) {
    return { ok: true, combo };
  }
  return { ok: false, reason: 'does not beat last combo', combo };
}

// Apply a legal move
export function applyMove(state: GameState, player: PlayerId, combo: Combo): GameState {
  // remove cards from player's hand
  const newState: GameState = { ...state, hands: state.hands.map(h => h.slice()) };
  for (const c of combo.cards) {
    const idx = newState.hands[player].findIndex(h => h.rank === c.rank && h.suit === c.suit);
    if (idx >= 0) newState.hands[player].splice(idx, 1);
  }
  newState.lastCombo = combo;
  newState.passesInRow = 0;

  // check finish
  if (newState.hands[player].length === 0) {
    newState.finished = true;
  }
  // next player
  newState.currentPlayer = (player + 1) % newState.players;
  return newState;
}

// Apply a pass
export function applyPass(state: GameState, player: PlayerId): GameState {
  if (state.finished) return state;
  const newState: GameState = { ...state };
  newState.passesInRow += 1;
  // If all others passed (N-1) since last combo, clear the pile
  if (newState.passesInRow >= newState.players - 1) {
    newState.lastCombo = null;
    newState.passesInRow = 0;
  }
  newState.currentPlayer = (player + 1) % newState.players;
  return newState;
}

// Enhanced AI with strategic hand management
export function aiChooseMove(state: GameState, player: PlayerId): { play: Card[] | null } {
  const hand = state.hands[player];
  const sorted = sortCardsByRankSuit(hand);
  
  // Get all possible legal moves
  const legalMoves = getAllLegalMoves(state, player);
  
  if (legalMoves.length === 0) {
    return { play: null };
  }
  
  // Strategy: Choose the best move based on multiple factors
  const bestMove = selectBestMove(legalMoves, state, player);
  return { play: bestMove };
}

// Get all possible legal moves for a player
function getAllLegalMoves(state: GameState, player: PlayerId): Card[][] {
  const hand = state.hands[player];
  const moves: Card[][] = [];
  
  // Try singles
  for (const card of hand) {
    const move = [card];
    const legal = isLegalMove(state, player, move);
    if (legal.ok) {
      moves.push(move);
    }
  }
  
  // Try pairs
  const rankGroups = groupCardsByRank(hand);
  for (const [rank, cards] of Object.entries(rankGroups)) {
    if (cards.length >= 2) {
      // Try pairs
      const pair = cards.slice(0, 2);
      const legal = isLegalMove(state, player, pair);
      if (legal.ok) {
        moves.push(pair);
      }
      
      // Try triples if available
      if (cards.length >= 3) {
        const triple = cards.slice(0, 3);
        const legal = isLegalMove(state, player, triple);
        if (legal.ok) {
          moves.push(triple);
        }
      }
    }
  }
  
  // Try straights
  const straights = findStraights(hand);
  for (const straight of straights) {
    const legal = isLegalMove(state, player, straight);
    if (legal.ok) {
      moves.push(straight);
    }
  }
  
  // Try bombs (4 of a kind)
  for (const [rank, cards] of Object.entries(rankGroups)) {
    if (cards.length === 4) {
      const legal = isLegalMove(state, player, cards);
      if (legal.ok) {
        moves.push(cards);
      }
    }
  }
  
  return moves;
}

// Group cards by rank
function groupCardsByRank(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  for (const card of cards) {
    if (!groups[card.rank]) {
      groups[card.rank] = [];
    }
    groups[card.rank].push(card);
  }
  return groups;
}

// Find all possible straights in a hand
function findStraights(hand: Card[]): Card[][] {
  const straights: Card[][] = [];
  const rankGroups = groupCardsByRank(hand);
  
  // For each possible starting rank
  for (let i = 0; i < RANKS.length - 2; i++) {
    // Try different straight lengths (3 to max possible)
    for (let length = 3; length <= Math.min(10, RANKS.length - i); length++) {
      const straightCards: Card[] = [];
      let valid = true;
      
      // Check if we can form a straight of this length
      for (let j = 0; j < length; j++) {
        const rank = RANKS[i + j];
        if (rank === '2') {
          valid = false; // 2 cannot be used in straights
          break;
        }
        const cardsOfRank = rankGroups[rank];
        if (!cardsOfRank || cardsOfRank.length === 0) {
          valid = false;
          break;
        }
        // Take the first available card of this rank
        straightCards.push(cardsOfRank[0]);
      }
      
      if (valid && straightCards.length === length) {
        straights.push(straightCards);
      }
    }
  }
  
  return straights;
}

// Select the best move based on strategic considerations
function selectBestMove(moves: Card[][], state: GameState, player: PlayerId): Card[] | null {
  if (moves.length === 0) return null;
  
  // If this is the first play of a new trick (no last combo), play strategically
  if (!state.lastCombo) {
    return selectBestOpeningMove(moves, state, player);
  }
  
  // If trying to beat a previous play, be more aggressive
  return selectBestFollowingMove(moves, state, player);
}

// Select the best opening move (when no cards on table)
function selectBestOpeningMove(moves: Card[][], state: GameState, player: PlayerId): Card[] | null {
  const hand = state.hands[player];
  
  // Strategy: 
  // 1. Prefer moves that preserve good combinations for future plays
  // 2. Avoid breaking up strong combinations unless necessary
  // 3. Consider hand size and position
  
  // Score each move based on strategic value
  const scoredMoves = moves.map(move => ({
    move,
    score: scoreOpeningMove(move, hand, state, player)
  }));
  
  // Sort by score (highest first)
  scoredMoves.sort((a, b) => b.score - a.score);
  
  // Return the best move, or the first move if all scores are equal
  return scoredMoves[0]?.move || moves[0] || null;
}

// Score an opening move based on strategic considerations
function scoreOpeningMove(move: Card[], hand: Card[], state: GameState, player: PlayerId): number {
  let score = 0;
  
  // Prefer singles over combinations for opening moves (preserve options)
  if (move.length === 1) {
    score += 10;
    
    // Prefer middle-ranked cards for opening moves
    const rankIdx = rankIndex(move[0].rank);
    if (rankIdx >= 4 && rankIdx <= 9) {
      score += 5; // Middle cards are generally safer
    }
    
    // Bonus for cards that don't break up good combinations
    const remainingHand = hand.filter(card => 
      !(card.rank === move[0].rank && card.suit === move[0].suit)
    );
    
    // Check if playing this card breaks up a pair
    const sameRankCards = remainingHand.filter(card => card.rank === move[0].rank);
    if (sameRankCards.length >= 1) {
      score -= 3; // Penalty for breaking up a pair
    }
    
    // Check if playing this card breaks up a straight potential
    // This is a simplified check - in practice, you'd want more sophisticated straight analysis
  } else {
    // For combinations, prefer smaller ones that don't overcommit
    if (move.length === 2) {
      score += 5; // Pairs are good
    } else if (move.length === 3) {
      score += 3; // Triples are okay
    } else if (move.length >= 4) {
      score += 1; // Bombs should be saved for important moments
    }
  }
  
  // Bonus for moves that help set up future plays
  const combo = detectCombo(move);
  if (combo) {
    if (combo.type === 'pair' || combo.type === 'triple') {
      // These help maintain hand structure
      score += 2;
    }
  }
  
  return score;
}

// Select the best move when following (trying to beat previous play)
function selectBestFollowingMove(moves: Card[][], state: GameState, player: PlayerId): Card[] | null {
  if (!state.lastCombo) return moves[0] || null;
  
  // Score each move based on how well it beats the previous play
  const scoredMoves = moves.map(move => {
    const combo = detectCombo(move);
    if (!combo) return { move, score: -1000 };
    
    const comparison = compareCombos(state.lastCombo!, combo);
    if (comparison <= 0) return { move, score: -1000 }; // Invalid move
    
    let score = comparison * 10; // Higher comparison = better
    
    // Bonus for not overcommitting (playing the minimum needed to win)
    if (combo.type === state.lastCombo!.type && combo.cards.length === state.lastCombo!.cards.length) {
      score += 5; // Same type and size is efficient
    }
    
    // Prefer to save bombs for when really needed
    if (combo.type === 'bomb4') {
      score -= 20; // Penalty for using bomb unless absolutely necessary
    }
    
    return { move, score };
  });
  
  // Remove invalid moves
  const validMoves = scoredMoves.filter(item => item.score > -1000);
  if (validMoves.length === 0) return null;
  
  // Sort by score (highest first)
  validMoves.sort((a, b) => b.score - a.score);
  
  return validMoves[0].move;
}

// Simple fallback AI (original implementation) for comparison
export function aiChooseMoveSimple(state: GameState, player: PlayerId): { play: Card[] | null } {
  const hand = state.hands[player];
  const sorted = sortCardsByRankSuit(hand);
  // try singles first
  for (const c of sorted) {
    const move = [c];
    const legal = isLegalMove(state, player, move);
    if (legal.ok) return { play: move };
  }
  // TODO: try pairs/straights etc. For now, pass if cannot play single.
  return { play: null };
}

export interface Card {
  id: string; // unique card id, e.g., 'black-5', 'white-5'
  color: 'black' | 'white';
  value: number; // 0 to 11
  isRevealed: boolean;
  owner: string | null;
}

export interface GameData {
  deck: Card[];
  hands: { [username: string]: Card[] };
  currentTurn: string; // username
  turnStatus: 'drawing' | 'guessing' | 'guessing_again' | 'ended'; // status within the turn
  lastDrawnCard: Card | null; // card drawn in this turn, exposed if guess fails
  winner: string | null;
  logs: string[];
}

// Generate the initial set of 24 cards (0-11 Black, 0-11 White)
export function generateCards(): Card[] {
  const cards: Card[] = [];
  const colors: ('black' | 'white')[] = ['black', 'white'];
  
  for (const color of colors) {
    for (let value = 0; value <= 11; value++) {
      cards.push({
        id: `${color}-${value}`,
        color,
        value,
        isRevealed: false,
        owner: null,
      });
    }
  }
  
  return cards;
}

// Shuffle cards using Fisher-Yates algorithm
export function shuffleCards(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Sort cards in hand: Left to right from smallest to largest
// Rule: Same numbers -> Black is placed on the left (smaller), White on the right (larger)
export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.value !== b.value) {
      return a.value - b.value;
    }
    return a.color === 'black' ? -1 : 1;
  });
}

// Initialize and deal cards to players
// 2-3 players: 4 cards each. 4 players: 3 cards each.
export function dealCards(usernames: string[]): { deck: Card[]; hands: { [username: string]: Card[] } } {
  const allCards = shuffleCards(generateCards());
  const hands: { [username: string]: Card[] } = {};
  
  const cardsPerPlayer = usernames.length <= 3 ? 4 : 3;
  let deckIndex = 0;
  
  for (const username of usernames) {
    const playerHand: Card[] = [];
    for (let i = 0; i < cardsPerPlayer; i++) {
      const card = allCards[deckIndex++];
      card.owner = username;
      playerHand.push(card);
    }
    hands[username] = sortCards(playerHand);
  }
  
  const deck = allCards.slice(deckIndex).map(card => {
    card.owner = null;
    return card;
  });
  
  return { deck, hands };
}

// Start a new game state
export function initGame(usernames: string[]): GameData {
  const { deck, hands } = dealCards(usernames);
  
  // Randomly pick who goes first
  const randomFirst = usernames[Math.floor(Math.random() * usernames.length)];
  
  return {
    deck,
    hands,
    currentTurn: randomFirst,
    turnStatus: 'drawing',
    lastDrawnCard: null,
    winner: null,
    logs: ['游戏开始！'],
  };
}

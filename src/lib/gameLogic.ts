export interface Card {
  id: string; // unique card id, e.g., 'black-5', 'white-5', 'black-joker', 'white-joker'
  color: 'black' | 'white';
  value: number; // 0 to 11, or -1 for Joker (-)
  isJoker?: boolean; // true if this is a Wildcard Joker (-)
  isRevealed: boolean;
  owner: string | null;
}

export interface GameData {
  deck: Card[];
  hands: { [username: string]: Card[] };
  currentTurn: string; // username
  turnStatus: 'setup' | 'drawing' | 'guessing' | 'guessing_again' | 'ended'; // status within the turn
  lastDrawnCard: Card | null; // card drawn in this turn, exposed if guess fails
  winner: string | null;
  logs: string[];
  setupPending?: string[];
  setupArranged?: string[];
  killStats?: { [username: string]: { correct: number; wrong: number } };
}

// Display helper for card value: -1 is displayed as '-', otherwise number string
export function getCardDisplayValue(value: number): string {
  return value === -1 ? '-' : String(value);
}

// Generate the initial set of 26 cards (0-11 Black + Black Joker (-), 0-11 White + White Joker (-))
export function generateCards(): Card[] {
  const cards: Card[] = [];
  const colors: ('black' | 'white')[] = ['black', 'white'];
  
  for (const color of colors) {
    // Standard cards 0 to 11
    for (let value = 0; value <= 11; value++) {
      cards.push({
        id: `${color}-${value}`,
        color,
        value,
        isRevealed: false,
        owner: null,
      });
    }
    // Wildcard Joker (-)
    cards.push({
      id: `${color}-joker`,
      color,
      value: -1,
      isJoker: true,
      isRevealed: false,
      owner: null,
    });
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
// Rule: Normal cards (0-11) sort from smallest to largest; Black left of White on tie.
// Joker cards (-) are placed at the end (right side) of the hand.
export function sortCards(cards: Card[]): Card[] {
  const normalCards = cards.filter(c => c.value !== -1).sort((a, b) => {
    if (a.value !== b.value) {
      return a.value - b.value;
    }
    return a.color === 'black' ? -1 : 1;
  });

  const jokerCards = cards.filter(c => c.value === -1);

  return [...normalCards, ...jokerCards];
}

// 重新调整手牌中某张百搭牌 (-) 的插入摆放位置
// 普通数字牌 (0-11) 保持相对的升序规则，百搭牌被移动插入到 targetIndex 索引位置
export function repositionJokerCard(hand: Card[], cardId: string, targetIndex: number): Card[] {
  const jokerCard = hand.find(c => c.id === cardId && c.value === -1);
  if (!jokerCard) return hand;

  const otherCards = hand.filter(c => c.id !== cardId);

  // 限制 targetIndex 在 0 到 otherCards.length 范围内
  const validIndex = Math.max(0, Math.min(targetIndex, otherCards.length));

  const newHand = [...otherCards];
  newHand.splice(validIndex, 0, jokerCard);
  return newHand;
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
  const killStats = Object.fromEntries(usernames.map(username => [username, { correct: 0, wrong: 0 }]));
  
  return {
    deck,
    hands,
    currentTurn: randomFirst,
    turnStatus: 'drawing',
    lastDrawnCard: null,
    winner: null,
    logs: ['游戏开始！包含了黑白两张【-】任意百搭牌。'],
    killStats,
  };
}

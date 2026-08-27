import { describe, expect, it } from 'vitest';
import { dealCards, generateCards, initGame, repositionJokerCard, sortCards } from './gameLogic';

describe('gameLogic', () => {
  it('generates the unchanged 26-card deck', () => {
    const cards = generateCards();
    expect(cards).toHaveLength(26);
    expect(cards.filter(card => card.isJoker)).toHaveLength(2);
  });

  it('deals 4 cards to 2-3 players and 3 cards to 4 players', () => {
    expect(Object.values(dealCards(['a', 'b']).hands).every(hand => hand.length === 4)).toBe(true);
    expect(Object.values(dealCards(['a', 'b', 'c', 'd']).hands).every(hand => hand.length === 3)).toBe(true);
  });

  it('keeps normal card ordering and places jokers at the end by default', () => {
    const cards = generateCards().slice(0, 4);
    const sorted = sortCards([...cards, generateCards().find(card => card.isJoker)!]);
    expect(sorted.at(-1)?.isJoker).toBe(true);
  });

  it('allows joker repositioning without changing other cards', () => {
    const cards = generateCards().filter(card => card.color === 'black').slice(0, 3);
    const joker = generateCards().find(card => card.id === 'black-joker')!;
    const hand = [...cards, joker];
    const moved = repositionJokerCard(hand, joker.id, 1);
    expect(moved[1].id).toBe(joker.id);
    expect(moved.filter(card => card.id !== joker.id).map(card => card.id)).toEqual(cards.map(card => card.id));
  });

  it('initializes a valid turn state for every player', () => {
    const state = initGame(['a', 'b']);
    expect(['a', 'b']).toContain(state.currentTurn);
    expect(state.turnStatus).toBe('drawing');
    expect(state.winner).toBeNull();
  });
});

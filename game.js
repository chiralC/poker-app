function createDeck(){
    const suits = ['H', 'D', 'C', 'S'];
    const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const cards = [];
    for (const suit of suits) for (const rank of ranks) cards.push(suit + rank);
    return cards;
}

const RANK_VALUES = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};

// Optimized using linear-time Fisher-Yates shuffle
function shuffle(){
    const cards = createDeck();
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
}

function dealInitial(numPlayers){
    const cards = shuffle();
    const hands = [];
    for(let i = 0; i < numPlayers; i++) hands.push(cards.splice(0,2));
    return {hands, remainingDeck: cards};
}

function createPlayer(name, chips){
    return{ name, chips, currentBet: 0, totalContributed: 0, folded: false, hand: [], allIn: false };
}

function createTable(playerNames, startingChips){
    const players = playerNames.map(name=>createPlayer(name, startingChips));
    return{ players, pot:0, currentBet: 0, minRaise: 0, deck: [], communityCards: [], currentPlayerIndex: 0, lastRaiserIndex: null, actedThisRound: new Set() };
}

function smallBlind(table, playerIndex, amount){
    const player = table.players[playerIndex];
    player.chips -= amount; player.currentBet = amount; player.totalContributed += amount;
    table.pot += amount; table.currentBet = amount; table.minRaise = amount;
}

function bigBlind(table, playerIndex, amount){
    const player = table.players[playerIndex];
    player.chips -= amount; player.currentBet = amount; player.totalContributed += amount;
    table.pot += amount; table.currentBet = amount; table.minRaise = amount; table.lastRaiserIndex = playerIndex;
}

function call(table, playerIndex){
    const player = table.players[playerIndex];
    const amountToAdd = table.currentBet - player.currentBet;
    player.chips -= amountToAdd; player.currentBet += amountToAdd; player.totalContributed += amountToAdd; table.pot += amountToAdd;
    table.actedThisRound.add(playerIndex);
}

function check(table, playerIndex){
    const player = table.players[playerIndex];
    if(player.currentBet != table.currentBet) return false;
    table.actedThisRound.add(playerIndex);
    return true;
}

function fold(table, playerIndex){
    table.players[playerIndex].folded = true;
    table.actedThisRound.add(playerIndex);
}

function raise(table, playerIndex, raiseTo){
    const player = table.players[playerIndex];
    const raiseBy = raiseTo - table.currentBet;
    const amountToAdd = raiseTo - player.currentBet;
    if(raiseBy < table.minRaise) return false;
    if(amountToAdd > player.chips) return false;
    player.chips -= amountToAdd; player.currentBet = raiseTo; player.totalContributed += amountToAdd;
    table.pot += amountToAdd; table.minRaise = raiseBy; table.currentBet = raiseTo; table.lastRaiserIndex = playerIndex;
    table.actedThisRound = new Set([playerIndex]);
    return true;
}

function getNextPlayerIndex(table, fromIndex){
    const numPlayers = table.players.length;
    let i = fromIndex;
    for(let count =0; count< numPlayers; count++){
        i = (i+1)%numPlayers; const p = table.players[i];
        if(!p.folded && !p.allIn && p.chips > 0) return i;
    }
    return null;
}

function advanceTurn(table){
    const next = getNextPlayerIndex(table, table.currentPlayerIndex);
    if(next!=null) table.currentPlayerIndex = next;
}

function isBettingRoundOver(table){
    const activeIndices = table.players.map((p,i)=>i).filter(i => !table.players[i].allIn && !table.players[i].folded && table.players[i].chips > 0);
    if(activeIndices.length <= 1) return true;
    const allMatched = activeIndices.every(i => table.players[i].currentBet === table.currentBet);
    const allActed = activeIndices.every(i => table.actedThisRound.has(i));
    return allMatched && allActed;
}

function dealFlop(table){ table.deck.splice(0,1); const flop = table.deck.splice(0,3); table.communityCards.push(...flop); }
function dealTurn(table){ table.deck.splice(0,1); const turn = table.deck.splice(0,1); table.communityCards.push(...turn); }
function dealRiver(table){ table.deck.splice(0,1); const river = table.deck.splice(0,1); table.communityCards.push(...river); }

function allIn(table, playerIndex){
    const player = table.players[playerIndex];
    const amount = player.chips;
    player.totalContributed += amount; player.currentBet += amount; player.chips = 0; player.allIn = true;
    table.pot += amount;
    if(player.currentBet > table.currentBet){
        const raiseBy = player.currentBet - table.currentBet;
        table.minRaise = Math.max(table.minRaise, raiseBy);
        table.currentBet = player.currentBet;
        table.actedThisRound = new Set([playerIndex]);
    } else {
        table.actedThisRound.add(playerIndex);
    }
}

function calculatePots(table){
    const contenders = table.players.filter(p => !p.folded);
    const contributions = contenders.map(p => p.totalContributed).filter(amount => amount > 0);
    const levels = [...new Set(contributions)].sort((a,b)=> a-b);
    const pots = []; let previousLevel = 0;
    for(const level of levels){
        const eligiblePlayers = contenders.filter(p => p.totalContributed >= level);
        const contributingPlayers = table.players.filter(p => p.totalContributed > previousLevel);
        const potAmount = contributingPlayers.reduce((sum,p)=>{
            const capped = Math.min(p.totalContributed, level) - previousLevel;
            return sum + Math.max(capped, 0);
        }, 0);
        if(potAmount > 0) pots.push({amount: potAmount, eligiblePlayers: eligiblePlayers.map(p=>p.name)});
        previousLevel = level;
    }
    return pots;
}

function parseCard(card) {
  const suit = card.slice(0, 1);
  const rank = card.slice(1);
  return { rank, suit, value: RANK_VALUES[rank] };
}

function getCombinations(cards, size) {
  if (size === 0) return [[]];
  if (cards.length < size) return [];
  const [first, ...rest] = cards;
  const withFirst = getCombinations(rest, size - 1).map(combo => [first, ...combo]);
  const withoutFirst = getCombinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

function isWheel(uniqueValues) {
  return uniqueValues.includes(14) && [5,4,3,2].every(v => uniqueValues.includes(v));
}

function checkStraight(uniqueValues){
    if(uniqueValues.length < 5) return false;
    for(let i =0; i<=uniqueValues.length - 5; i++){
        if( uniqueValues[i] - uniqueValues[i+4] === 4){return true;}
    }
    if (isWheel(uniqueValues)) return true;
    return false;
}

function sortByCount(rankCounts){
    return Object.entries(rankCounts)
        .sort((a,b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))
        .map(entry => Number(entry[0]));
}

function evaluateFiveCards(cards){
    const parsed = cards.map(parseCard);
    const values = parsed.map(c=>c.value).sort((a,b)=> b-a );
    const suits = parsed.map(c=> c.suit);
    const rankCounts = {};
    for(const v of values){ rankCounts[v] = (rankCounts[v] || 0) + 1; }
    const counts = Object.values(rankCounts).sort((a,b)=> b-a);
    const uniqueValues = [...new Set(values)].sort((a,b)=> b-a);
    const isFlush = suits.every(s => s===suits[0]);
    const isStraight = checkStraight(uniqueValues);
    const wheel = isWheel(uniqueValues);
    if(isStraight && isFlush) return {rank: 8, tiebreak: wheel ? [5,4,3,2,1] : uniqueValues};
    if(counts[0]===4) return {rank: 7, tiebreak: sortByCount(rankCounts)};
    if(counts[0]===3 && counts[1]===2) return {rank: 6, tiebreak: sortByCount(rankCounts)};
    if(isFlush) return {rank:5, tiebreak: values};
    if(isStraight) return {rank:4, tiebreak: wheel ? [5,4,3,2,1] : uniqueValues};
    if(counts[0]===3) return {rank:3, tiebreak: sortByCount(rankCounts)};
    if(counts[0]===2 && counts[1]===2) return {rank: 2, tiebreak: sortByCount(rankCounts)};
    if(counts[0]===2) return {rank: 1, tiebreak: sortByCount(rankCounts)};
    return {rank: 0, tiebreak: values};
}

function compareHands(a,b){
    if(a.rank !== b.rank) return a.rank - b.rank;
    for (let i = 0; i < a.tiebreak.length; i++) {
        if (a.tiebreak[i] !== b.tiebreak[i]) return a.tiebreak[i] - b.tiebreak[i];
    }
    return 0;
}

function getBestHand(sevenCards){
    const combos = getCombinations(sevenCards, 5);
    let best = null;
    for(const combo of combos){
        const result = evaluateFiveCards(combo);
        if(!best || compareHands(result, best) > 0){ best = result; best.cards = combo; }
    }
    return best;
}

function startNewHand(table, dealerIndex, smallBlindAmount, bigBlindAmount){
    const {hands, remainingDeck} = dealInitial(table.players.length);
    
    // 1. Reset player states & auto-fold players with no bankroll left
    table.players.forEach((player, i) => {
        player.hand = hands[i];
        player.currentBet = 0;
        player.totalContributed = 0;
        player.folded = (player.chips <= 0); 
        player.allIn = false;
    });
    
    table.deck = remainingDeck;
    table.communityCards = [];
    table.pot = 0;
    table.currentBet = 0;
    table.dealerIndex = dealerIndex;
    table.bigBlindAmount = bigBlindAmount;
    table.smallBlindAmount = smallBlindAmount;

    // Helper to find the next active player index (clockwise)
    const nextActive = (idx) => {
        let n = table.players.length;
        let i = idx;
        for (let up = 0; up < n; up++) {
            i = (i + 1) % n;
            if (table.players[i].chips > 0) return i;
        }
        return idx;
    };

    const activeCount = table.players.filter(p => p.chips > 0).length;
    if (activeCount < 2) return; // Game over or waiting for buy-ins

    // 2. Assign blinds dynamically relative to active players
    let sbIndex, bbIndex;
    if (activeCount === 2) {
        sbIndex = dealerIndex; // Heads-up rules: Dealer is Small Blind
        bbIndex = nextActive(dealerIndex);
    } else {
        sbIndex = nextActive(dealerIndex);
        bbIndex = nextActive(sbIndex);
    }

    // 3. Post Small Blind safely (prevents negative chips / triggers short-stack All-In)
    const sbPlayer = table.players[sbIndex];
    const sbPosted = Math.min(sbPlayer.chips, smallBlindAmount);
    sbPlayer.chips -= sbPosted;
    sbPlayer.currentBet = sbPosted;
    sbPlayer.totalContributed = sbPosted;
    table.pot += sbPosted;
    if (sbPlayer.chips === 0) sbPlayer.allIn = true;

    // 4. Post Big Blind safely
    const bbPlayer = table.players[bbIndex];
    const bbPosted = Math.min(bbPlayer.chips, bigBlindAmount);
    bbPlayer.chips -= bbPosted;
    bbPlayer.currentBet = bbPosted;
    bbPlayer.totalContributed = bbPosted;
    table.pot += bbPosted;
    if (bbPlayer.chips === 0) bbPlayer.allIn = true;

    // Update table tracking state parameters
    table.currentBet = Math.max(sbPosted, bbPosted);
    table.minRaise = bigBlindAmount;
    table.lastRaiserIndex = bbIndex;

    // 5. Turn action shifts to the first active player past the Big Blind
    table.currentPlayerIndex = getNextPlayerIndex(table, bbIndex);
    table.actedThisRound = new Set();
}

// Fixed dealer calculation to check for active bankrolls, ignoring old state flags
function startNextHand(table) {
  const numPlayers = table.players.length;
  let nextDealer = table.dealerIndex;
  for (let count = 0; count < numPlayers; count++) {
      nextDealer = (nextDealer + 1) % numPlayers;
      if (table.players[nextDealer].chips > 0) break;
  }
  startNewHand(table, nextDealer, table.smallBlindAmount, table.bigBlindAmount);
}

function resetBettingRound(table){
    table.players.forEach(p=>{p.currentBet = 0;});
    table.currentBet = 0; table.minRaise = table.bigBlindAmount || 10; table.lastRaiserIndex = null;
    table.currentPlayerIndex = getNextPlayerIndex(table, table.dealerIndex);
    table.actedThisRound = new Set();
}

function advanceStage(table){
    const remaining = table.players.filter(p => !p.folded);
    if(remaining.length <= 1) return 'showdown';
    if(table.communityCards.length === 0){ dealFlop(table); resetBettingRound(table); return 'flop'; }
    else if (table.communityCards.length === 3){ dealTurn(table); resetBettingRound(table); return 'turn'; }
    else if (table.communityCards.length === 4){ dealRiver(table); resetBettingRound(table); return 'river'; }
    else return 'showdown';
}

function runShowdown(table){
    const pots = calculatePots(table);
    const results = [];
    const stillIn = table.players.filter(p => !p.folded);
    if (stillIn.length === 1) {
        stillIn[0].chips += table.pot;
        return [{ pot: table.pot, winners: [stillIn[0].name] }];
    }
    for(const pot of pots){
        const eligible = table.players.filter(p => pot.eligiblePlayers.includes(p.name));
        const contenders = eligible.filter(p => !p.folded);
        if (contenders.length === 1){
            contenders[0].chips += pot.amount;
            results.push({ pot: pot.amount, winners: [contenders[0].name] });
            continue;
        }
        const scored = contenders.map(p => ({ player: p, hand: getBestHand([...p.hand, ...table.communityCards]) }));
        scored.sort((a,b) => compareHands(b.hand, a.hand));
        const topScore = scored[0].hand;
        const winners = scored.filter(s => compareHands(s.hand, topScore) === 0);
        const share = Math.floor(pot.amount / winners.length);
        winners.forEach(w => {w.player.chips += share});
        results.push({ pot: pot.amount, winners: winners.map(w => w.player.name)});
    }
    return results;
}

module.exports = { createDeck, shuffle, dealInitial, createPlayer, createTable, smallBlind, bigBlind, call, check, fold, raise, getNextPlayerIndex, advanceTurn, isBettingRoundOver, dealFlop, dealTurn, dealRiver, allIn, calculatePots, parseCard, getCombinations, evaluateFiveCards, startNewHand, startNextHand, advanceStage, runShowdown, getBestHand, compareHands, resetBettingRound };
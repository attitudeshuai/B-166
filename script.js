/**
 * 斗地主核心逻辑
 */

const SUITS = ['♠', '♥', '♣', '♦'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

/**
 * 自定义弹窗系统
 */
function showAlert(message, title = '💡 提示') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-alert');
        const titleEl = document.getElementById('alert-title');
        const messageEl = document.getElementById('alert-message');
        const closeBtn = document.getElementById('alert-close-btn');

        titleEl.innerText = title;
        messageEl.innerText = message;
        modal.classList.remove('hidden');

        const handleClose = () => {
            modal.classList.add('hidden');
            closeBtn.removeEventListener('click', handleClose);
            resolve();
        };

        closeBtn.addEventListener('click', handleClose);
    });
}

function showConfirm(message, title = '⚠️ 确认') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        titleEl.innerText = title;
        messageEl.innerText = message;
        modal.classList.remove('hidden');

        const handleOk = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

// 牌型定义
const HAND_TYPES = {
    SINGLE: 'SINGLE', // 单张
    PAIR: 'PAIR', // 对子
    TRIPLE: 'TRIPLE', // 三张
    TRIPLE_WITH_SINGLE: 'TRIPLE_WITH_SINGLE', // 三带一
    TRIPLE_WITH_PAIR: 'TRIPLE_WITH_PAIR', // 三带二
    STRAIGHT: 'STRAIGHT', // 顺子 (5+)
    PAIR_STRAIGHT: 'PAIR_STRAIGHT', // 连对 (3+)
    PLANE: 'PLANE', // 飞机 (2+ consecutive triples)
    PLANE_WITH_WINGS: 'PLANE_WITH_WINGS', // 飞机带翅膀
    BOMB: 'BOMB', // 炸弹
    ROCKET: 'ROCKET', // 王炸
    INVALID: 'INVALID'
};

const STORAGE_KEY = 'doudizhu_leaderboard';

class Leaderboard {
    static load() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    static save(records) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    static addRecord(score, role, isWin) {
        const records = this.load();
        records.push({
            score,
            role,
            isWin,
            timestamp: Date.now()
        });
        this.save(records);
    }

    static getRanked() {
        const records = this.load();
        return records
            .sort((a, b) => b.score - a.score)
            .map((r, i) => ({ ...r, rank: i + 1 }));
    }

    static clear() {
        localStorage.removeItem(STORAGE_KEY);
    }

    static renderList() {
        const listEl = document.getElementById('leaderboard-list');
        const records = this.getRanked();

        if (records.length === 0) {
            listEl.innerHTML = '<div class="leaderboard-empty">暂无战绩记录</div>';
            return;
        }

        listEl.innerHTML = records.map(r => {
            const rankClass = r.rank <= 3 ? ` top${r.rank}` : '';
            const scoreClass = r.score >= 0 ? 'positive' : 'negative';
            const scoreText = r.score >= 0 ? `+${r.score}` : `${r.score}`;
            const roleText = r.role === 'landlord' ? '地主' : '农民';
            const resultText = r.isWin ? '胜' : '负';
            const date = new Date(r.timestamp);
            const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            return `<div class="leaderboard-item">
                <div class="leaderboard-rank${rankClass}">${r.rank}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-score ${scoreClass}">${scoreText}</div>
                    <div class="leaderboard-meta">${roleText} · ${resultText} · ${timeStr}</div>
                </div>
            </div>`;
        }).join('');
    }
}

class Card {
    constructor(suit, rank, value) {
        this.suit = suit;
        this.rank = rank;
        this.value = value; // 3=3, ..., A=14, 2=15, Small Joker=16, Big Joker=17
    }

    get displayRank() {
        if (this.suit === 'JOKER') return this.rank === 'Small Joker' ? '小王' : '大王';
        return this.rank;
    }

    get color() {
        if (this.suit === '♥' || this.suit === '♦' || this.rank === 'Big Joker') return 'red';
        return 'black';
    }
}

class HandAnalyzer {
    // 基础牌型判断
    static analyze(cards) {
        if (!cards || cards.length === 0) return { type: HAND_TYPES.INVALID };

        cards.sort((a, b) => a.value - b.value); // sort ascending for analysis
        const len = cards.length;
        const counts = this.countCards(cards);
        const uniqueValues = Object.keys(counts).map(Number).sort((a, b) => a - b);
        const maxCount = Math.max(...Object.values(counts));

        // 1. Single
        if (len === 1) return { type: HAND_TYPES.SINGLE, value: cards[0].value, len: 1 };

        // 2. Rocket
        if (len === 2 && cards[0].value === 16 && cards[1].value === 17)
            return { type: HAND_TYPES.ROCKET, value: 999, len: 2 };

        // 3. Pair
        if (len === 2 && maxCount === 2) return { type: HAND_TYPES.PAIR, value: cards[0].value, len: 2 };

        // 4. Bomb
        if (len === 4 && maxCount === 4) return { type: HAND_TYPES.BOMB, value: cards[0].value, len: 4 };

        // 5. Triple
        if (len === 3 && maxCount === 3) return { type: HAND_TYPES.TRIPLE, value: cards[0].value, len: 3 };

        // 6. Triple w/ Single
        if (len === 4 && maxCount === 3) {
            const tripleVal = uniqueValues.find(v => counts[v] === 3);
            return { type: HAND_TYPES.TRIPLE_WITH_SINGLE, value: tripleVal, len: 4 };
        }

        // 7. Triple w/ Pair
        if (len === 5 && maxCount === 3 && uniqueValues.length === 2) {
            const tripleVal = uniqueValues.find(v => counts[v] === 3);
            return { type: HAND_TYPES.TRIPLE_WITH_PAIR, value: tripleVal, len: 5 };
        }

        // 8. Straight (5+)
        if (len >= 5 && maxCount === 1 && this.isConsecutive(uniqueValues) && uniqueValues[uniqueValues.length - 1] < 15) {
            return { type: HAND_TYPES.STRAIGHT, value: uniqueValues[0], len: len };
        }

        // 9. Pair Straight (3 pairs+)
        if (len >= 6 && len % 2 === 0 && maxCount === 2 && uniqueValues.length === len / 2 && this.isConsecutive(uniqueValues) && uniqueValues[uniqueValues.length - 1] < 15) {
            return { type: HAND_TYPES.PAIR_STRAIGHT, value: uniqueValues[0], len: len };
        }

        // 飞机 (Plane) Logic simplified for demo
        // ... Detect planes

        return { type: HAND_TYPES.INVALID };
    }

    static countCards(cards) {
        const counts = {};
        cards.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);
        return counts;
    }

    static isConsecutive(values) {
        for (let i = 0; i < values.length - 1; i++) {
            if (values[i + 1] !== values[i] + 1) return false;
        }
        return true;
    }

    // Check if newHand beats lastHand
    static canBeat(lastMove, newCards) {
        if (!lastMove) return this.analyze(newCards).type !== HAND_TYPES.INVALID;
        const newHand = this.analyze(newCards);
        if (newHand.type === HAND_TYPES.INVALID) return false;

        if (newHand.type === HAND_TYPES.ROCKET) return true;
        if (lastMove.type === HAND_TYPES.ROCKET) return false;

        if (newHand.type === HAND_TYPES.BOMB && lastMove.type !== HAND_TYPES.BOMB) return true;

        if (newHand.type === lastMove.type && newHand.len === lastMove.len) {
            return newHand.value > lastMove.value;
        }

        return false;
    }
}

class Game {
    constructor() {
        this.deck = [];
        this.players = { user: [], left: [], top: [] };
        this.holeCards = [];
        this.landlord = null; // 'user', 'left', 'top'
        this.currentTurn = null;
        this.multiplier = 1;
        this.baseScore = 10;
        this.lastMove = null; // { player, cards, type, value, len }
        this.consecutivePasses = 0;

        // 积分统计系统
        this.totalScore = this.loadTotalScore();
        this.currentGameScore = 0;

        // Dom Elements
        this.dom = {
            userHand: document.getElementById('user-hand'),
            holeCards: document.getElementById('hole-cards'),
            bidPanel: document.getElementById('bid-panel'),
            controlPanel: document.getElementById('control-panel'),
            resultModal: document.getElementById('result-modal'),
            cheatLeft: document.getElementById('cheat-left'),
            cheatTop: document.getElementById('cheat-top'),

            // Bot Containers
            leftHandBack: document.querySelector('#player-left .card-back-count'),
            topHandBack: document.querySelector('#player-top .card-back-count'),
            leftHandPC: document.querySelector('#player-left .bot-hand-container'),
            topHandPC: document.querySelector('#player-top .bot-hand-container'),

            playedCards: {
                user: document.querySelector('#player-user .played-cards-area'),
                left: document.querySelector('#player-left .played-cards-area'),
                top: document.querySelector('#player-top .played-cards-area')
            },

            // 积分显示
            totalScore: document.getElementById('total-score'),
            baseScore: document.getElementById('base-score'),
            multiplier: document.getElementById('multiplier')
        };

        this.cheats = { xray: false };
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateScoreDisplay(); // 初始化积分显示
        this.startNewGame();
    }

    bindEvents() {
        document.querySelector('[data-action="call"]').onclick = () => this.handleBid(true);
        document.querySelector('[data-action="no-call"]').onclick = () => this.handleBid(false);
        document.querySelector('[data-action="play"]').onclick = () => this.userPlay();
        document.querySelector('[data-action="pass"]').onclick = () => this.userPass();
        document.querySelector('[data-action="reset"]').onclick = () => this.resetSelection();

        document.getElementById('cheat-btn').onclick = () => document.getElementById('dev-menu').classList.remove('hidden');
        document.getElementById('close-dev').onclick = () => document.getElementById('dev-menu').classList.add('hidden');
        document.getElementById('toggle-xray').onchange = (e) => { this.cheats.xray = e.target.checked; this.updateView(); };
        document.getElementById('instant-win').onclick = () => { this.endGame('user'); document.getElementById('dev-menu').classList.add('hidden'); };
        document.getElementById('reset-score').onclick = () => { this.resetTotalScore(); document.getElementById('dev-menu').classList.add('hidden'); };
        document.getElementById('restart-btn').onclick = () => { document.getElementById('result-modal').classList.add('hidden'); this.startNewGame(); };

        document.getElementById('leaderboard-btn').onclick = () => { Leaderboard.renderList(); document.getElementById('leaderboard-modal').classList.remove('hidden'); };
        document.getElementById('leaderboard-close').onclick = () => { document.getElementById('leaderboard-modal').classList.add('hidden'); };
        document.getElementById('leaderboard-clear').onclick = async () => {
            const confirmed = await showConfirm('确定要清空所有战绩记录吗？此操作不可恢复！', '⚠️ 清空战绩');
            if (confirmed) {
                Leaderboard.clear();
                Leaderboard.renderList();
                showAlert('战绩记录已清空！', '✅ 成功');
            }
        };
    }

    startNewGame() {
        this.createDeck();
        this.shuffle();
        this.deal();
        this.lastMove = null;
        this.consecutivePasses = 0;
        this.clearPlayedCards();
        this.updateView();

        // Reset roles
        document.querySelectorAll('.role-icon').forEach(el => {
            el.className = 'role-icon hidden';
            el.innerText = '';
        });
        document.querySelector('#player-user .role-icon').style.display = 'none';

        this.dom.bidPanel.classList.remove('hidden');
    }

    createDeck() {
        this.deck = [];
        let value = 3;
        for (let rank of RANKS) {
            for (let suit of SUITS) {
                this.deck.push(new Card(suit, rank, value));
            }
            value++;
        }
        this.deck.push(new Card('JOKER', 'Small Joker', 16));
        this.deck.push(new Card('JOKER', 'Big Joker', 17));
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    deal() {
        this.players.user = this.deck.slice(0, 17);
        this.players.left = this.deck.slice(17, 34);
        this.players.top = this.deck.slice(34, 51);
        this.holeCards = this.deck.slice(51);

        for (let p in this.players) this.sortHand(this.players[p]);
    }

    sortHand(hand) {
        hand.sort((a, b) => b.value - a.value);
    }

    handleBid(isCall) {
        this.dom.bidPanel.classList.add('hidden');
        if (isCall) {
            this.setLandlord('user');
        } else {
            // Random bot landlord
            this.setLandlord(Math.random() > 0.5 ? 'left' : 'top');
        }
    }

    setLandlord(player) {
        this.landlord = player;
        this.players[player].push(...this.holeCards);
        this.sortHand(this.players[player]);
        this.revealHoleCards();
        this.updateRoles();
        this.updateView();
        this.startTurn(player);
    }

    updateRoles() {
        const roles = { user: 'user', left: 'left', top: 'top' };
        for (let p in roles) {
            const isLandlord = this.landlord === p;
            const areaId = p === 'user' ? 'player-user' : `player-${p}`;
            const icon = document.querySelector(`#${areaId} .role-icon`);
            if (icon) {
                icon.innerText = isLandlord ? '🤠' : '👨‍🌾';
                icon.classList.remove('hidden');
                icon.style.display = 'flex';
                icon.className = `role-icon ${isLandlord ? 'landlord' : 'peasant'}`;
            }
        }
    }

    startTurn(player) {
        this.currentTurn = player;
        this.updateStatus(player);

        // Pass Logic
        if (this.consecutivePasses >= 2) {
            this.lastMove = null; // New round
            this.clearPlayedCards();
        }

        if (player === 'user') {
            this.dom.controlPanel.classList.remove('hidden');
            // Enable/Disable pass button based on new round
            const passBtn = document.querySelector('[data-action="pass"]');
            passBtn.disabled = (this.lastMove === null);
            if (this.lastMove === null) passBtn.classList.add('disabled');
            else passBtn.classList.remove('disabled');

        } else {
            this.dom.controlPanel.classList.add('hidden');
            setTimeout(() => this.aiPlay(player), 1000); // 1s delay
        }
    }

    userPlay() {
        const selectedCards = this.getSelectedCards();
        if (selectedCards.length === 0) {
            showAlert('请选择要出的牌');
            return;
        }

        const handData = HandAnalyzer.analyze(selectedCards);
        if (handData.type === HAND_TYPES.INVALID) {
            showAlert('牌型不合法');
            return;
        }

        if (this.lastMove && !HandAnalyzer.canBeat(this.lastMove, selectedCards)) {
            showAlert('打不过上家的牌');
            return;
        }

        this.playCards('user', selectedCards, handData);
    }

    userPass() {
        if (this.lastMove === null) return; // Cannot pass on opening
        this.passTurn('user');
    }

    playCards(player, cards, handData) {
        this.removeCardsFromHand(player, cards);
        this.lastMove = { player, cards, ...handData };
        this.consecutivePasses = 0;
        this.showPlayedCard(player, cards);
        this.updateView();

        if (this.players[player].length === 0) {
            this.endGame(player);
            return;
        }

        this.dom.controlPanel.classList.add('hidden');
        this.startTurn(player === 'user' ? 'left' : (player === 'left' ? 'top' : 'user'));
    }

    passTurn(player) {
        this.consecutivePasses++;
        this.showPlayedCard(player, null); // Show "Pass" text
        this.startTurn(player === 'user' ? 'left' : (player === 'left' ? 'top' : 'user'));
    }

    aiPlay(player) {
        const hand = this.players[player];
        let move = null;

        // Simple AI Strategy
        if (this.lastMove) {
            // Try to beat
            move = this.findBestMove(hand, this.lastMove);
        } else {
            // Free play - play smallest valid hand (usually single or pair)
            // Or Straight if available
            move = this.findFreeMove(hand);
        }

        if (move) {
            const handData = HandAnalyzer.analyze(move);
            this.playCards(player, move, handData);
        } else {
            this.passTurn(player);
        }
    }

    // AI Helpers
    findFreeMove(hand) {
        // Just play smallest single for now... optimize later
        // Detect longest straight?
        // Simple default: play smallest single
        if (hand.length > 0) return [hand[hand.length - 1]];
        return null;
    }

    findBestMove(hand, target) {
        // Try simple types logic
        // 1. Same Type, Higher Value
        if (target.type === HAND_TYPES.SINGLE) {
            for (let i = hand.length - 1; i >= 0; i--) {
                if (hand[i].value > target.value) return [hand[i]];
            }
        }
        if (target.type === HAND_TYPES.PAIR) {
            // Find pair
            const counts = HandAnalyzer.countCards(hand);
            for (let val in counts) {
                if (counts[val] >= 2 && Number(val) > target.value) {
                    return this.getCardsByValue(hand, Number(val), 2);
                }
            }
        }

        // 2. Bomb
        if (target.type !== HAND_TYPES.BOMB && target.type !== HAND_TYPES.ROCKET) {
            const counts = HandAnalyzer.countCards(hand);
            for (let val in counts) {
                if (counts[val] === 4) return this.getCardsByValue(hand, Number(val), 4);
            }
            // Rocket
            if (hand.length >= 2 && hand[0].value === 17 && hand[1].value === 16) return [hand[0], hand[1]];
        }

        return null; // Pass
    }

    getCardsByValue(hand, val, count) {
        return hand.filter(c => c.value === val).slice(0, count);
    }

    endGame(winner) {
        this.dom.controlPanel.classList.add('hidden');
        const isLandlordWin = winner === this.landlord;
        const isUserWin = winner === 'user';

        // 计算积分变化
        let scoreChange = this.baseScore * this.multiplier;
        if (this.landlord === 'user') {
            // 玩家是地主
            scoreChange = isUserWin ? scoreChange * 2 : -scoreChange * 2;
        } else {
            // 玩家是农民
            scoreChange = isUserWin ? scoreChange : -scoreChange;
        }

        // 更新总积分
        this.currentGameScore = scoreChange;
        this.totalScore += scoreChange;
        this.saveTotalScore();
        this.updateScoreDisplay();

        Leaderboard.addRecord(scoreChange, this.landlord === 'user' ? 'landlord' : 'peasant', isUserWin);

        // 显示结算信息
        const msg = isLandlordWin
            ? (this.landlord === 'user' ? '地主(你) 胜利!' : '地主 胜利! (你输了)')
            : (this.landlord === 'user' ? '农民 胜利! (你输了)' : '农民(你) 胜利!');

        document.getElementById('result-title').innerText = msg;
        document.getElementById('result-score').innerText =
            `本局${scoreChange >= 0 ? '得分' : '失分'}: ${scoreChange >= 0 ? '+' : ''}${scoreChange}\n总积分: ${this.totalScore}`;
        this.dom.resultModal.classList.remove('hidden');
    }

    updateView() {
        // Render User Hand
        this.dom.userHand.innerHTML = '';
        this.players.user.forEach((card, index) => {
            const el = document.createElement('div');
            el.className = `card ${card.color}`;
            el.innerHTML = `
                <div class="rank">${card.displayRank}</div>
                <div class="suit">${card.suit !== 'JOKER' ? card.suit : ''}</div>
            `;
            el.dataset.index = index;
            el.onclick = () => this.toggleSelect(el);
            this.dom.userHand.appendChild(el);
        });

        // Update Bot Card Counts (Mobile/Folded)
        this.dom.leftHandBack.innerText = this.players.left.length;
        this.dom.topHandBack.innerText = this.players.top.length;

        // Update Bot Full Hands (PC)
        this.renderBotHand(this.players.left, this.dom.leftHandPC);
        this.renderBotHand(this.players.top, this.dom.topHandPC);

        // X-Ray: 透视模式隐藏文本提示，手牌正面由renderBotHand处理
        if (this.cheats.xray) {
            this.dom.cheatLeft.classList.add('hidden');
            this.dom.cheatTop.classList.add('hidden');
        } else {
            this.dom.cheatLeft.classList.add('hidden');
            this.dom.cheatTop.classList.add('hidden');
        }
    }

    renderBotHand(hand, container) {
        if (!container) return;
        container.innerHTML = '';
        hand.forEach(card => {
            const el = document.createElement('div');
            if (this.cheats.xray) {
                // Show Face
                el.className = `card ${card.color}`;
                el.innerHTML = `
                    <div class="rank">${card.displayRank}</div>
                    <div class="suit">${card.suit !== 'JOKER' ? card.suit : ''}</div>
                 `;
            } else {
                // Show Back
                el.className = 'card-back';
            }
            container.appendChild(el);
        });
    }

    showPlayedCard(player, cards) {
        const area = this.dom.playedCards[player];
        area.innerHTML = '';
        if (!cards) {
            area.innerHTML = '<div class="pass-text">不出</div>';
            return;
        }

        cards.forEach(card => {
            const el = document.createElement('div');
            el.className = `card ${card.color}`;
            el.innerHTML = `
                <div class="rank">${card.displayRank}</div>
                <div class="suit">${card.suit !== 'JOKER' ? card.suit : ''}</div>
            `;
            area.appendChild(el);
        });
    }

    clearPlayedCards() {
        Object.values(this.dom.playedCards).forEach(el => el.innerHTML = '');
    }

    handToString(hand) {
        return hand.map(c => c.displayRank + c.suit).join(' ');
    }

    toggleSelect(el) {
        el.classList.toggle('selected');
    }

    getSelectedCards() {
        const indices = Array.from(document.querySelectorAll('.card.selected')).map(el => parseInt(el.dataset.index));
        return indices.map(i => this.players.user[i]);
    }

    removeCardsFromHand(player, cards) {
        // Must remove mostly carefully by value matches
        const hand = this.players[player];
        for (let c of cards) {
            // Find index of card with same suit and rank
            const idx = hand.findIndex(h => h.suit === c.suit && h.rank === c.rank && h.value === c.value);
            if (idx > -1) hand.splice(idx, 1);
        }
    }

    revealHoleCards() {
        const container = this.dom.holeCards;
        container.innerHTML = '';
        this.holeCards.forEach(card => {
            const el = document.createElement('div');
            el.className = `card ${card.color}`;
            el.style.width = '40px';
            el.style.height = '56px';
            el.style.fontSize = '0.8rem';
            el.innerHTML = `<div>${card.displayRank}</div>`;
            container.appendChild(el);
        });
    }

    updateStatus(player) {
        document.querySelectorAll('.player-area').forEach(el => el.style.opacity = '0.6');
        document.querySelector(`.player-${player}`).style.opacity = '1';

        document.querySelectorAll('.status-bubble').forEach(el => el.classList.add('hidden'));
        const bubble = document.querySelector(`#player-${player} .status-bubble`);
        if (bubble) {
            bubble.classList.remove('hidden');
            bubble.innerText = 'Thinking...';
        }
    }

    resetSelection() {
        document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));
    }

    // 积分管理系统
    loadTotalScore() {
        const saved = localStorage.getItem('doudizhu_total_score');
        return saved ? parseInt(saved, 10) : 0;
    }

    saveTotalScore() {
        localStorage.setItem('doudizhu_total_score', this.totalScore.toString());
    }

    updateScoreDisplay() {
        if (this.dom.totalScore) {
            this.dom.totalScore.innerText = this.totalScore;
            // 根据积分正负添加颜色效果
            if (this.totalScore > 0) {
                this.dom.totalScore.style.color = '#10b981'; // 绿色
            } else if (this.totalScore < 0) {
                this.dom.totalScore.style.color = '#ef4444'; // 红色
            } else {
                this.dom.totalScore.style.color = ''; // 默认颜色
            }
        }
        if (this.dom.multiplier) {
            this.dom.multiplier.innerText = this.multiplier;
        }
    }

    async resetTotalScore() {
        const confirmed = await showConfirm('确定要清空总积分吗？此操作不可恢复！');
        if (confirmed) {
            this.totalScore = 0;
            this.saveTotalScore();
            this.updateScoreDisplay();
            showAlert('总积分已清空！', '✅ 成功');
        }
    }
}

// Start Game
window.game = new Game();

const ROWS = 8;
const COLS = 8;

const PIECES = {
    KING: '♚',
    QUEEN: '♛',
    ROOK: '♜',
    BISHOP: '♝',
    KNIGHT: '♞',
    PAWN: '♟'
};

// Map for internal types to display symbols (using white pieces for all, colored by CSS)
const SYMBOLS = {
    k: PIECES.KING,
    q: PIECES.QUEEN,
    r: PIECES.ROOK,
    b: PIECES.BISHOP,
    n: PIECES.KNIGHT,
    p: PIECES.PAWN
};

const FACTIONS = {
    A: 'A',
    B: 'B',
    ENEMY: 'Enemy'
};

class Piece {
    constructor(type, faction) {
        this.type = type; // 'k', 'q', 'r', 'b', 'n', 'p'
        this.faction = faction;
        this.hasMoved = false;
    }
}

class Game {
    constructor() {
        this.board = []; // 8x8
        this.turnIndex = 0; // 0: A, 1: Enemy, 2: B, 3: Enemy
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null; // Track last move {from, to}
        this.gameOver = false;

        // Drag and drop state
        this.draggingPiece = null;
        this.dragFrom = null;
        this.dragElement = null;

        // Arrow drawing state
        this.arrows = [];
        this.drawingArrow = false;
        this.arrowStart = null;
        this.previewArrow = null; // Live preview while dragging

        this.boardElement = document.getElementById('game-board');
        this.turnBadge = document.getElementById('turn-badge');
        this.messageLog = document.getElementById('message-log');
        this.restartBtn = document.getElementById('restart-btn');

        // Create canvas for arrows
        this.arrowCanvas = document.getElementById('arrow-canvas');
        this.arrowCtx = null;

        if (this.arrowCanvas) {
            this.arrowCtx = this.arrowCanvas.getContext('2d');
            this.setupArrowCanvas();
        } else {
            console.error('Arrow canvas element not found! Make sure the HTML has <canvas id="arrow-canvas"></canvas>');
        }

        // Multiplayer State
        this.socket = io();
        this.myRole = null; // 'A' or 'B'
        this.isMultiplayer = false;
        this.room = null;
        this.waiting = false;

        this.setupSocketListeners();

        // Initialize Simple AI
        this.ai = new SimpleAI(this);

        this.restartBtn.addEventListener('click', () => this.initGame());

        // Prevent context menu on the board globally
        this.boardElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Global mouseup for arrow drawing completion
        document.addEventListener('mouseup', (e) => {
            if (e.button === 2 && this.drawingArrow && this.arrowStart) {
                // Find which square the mouse is over
                const target = document.elementFromPoint(e.clientX, e.clientY);
                const square = target?.closest('.square');
                if (square) {
                    const r = parseInt(square.dataset.r);
                    const c = parseInt(square.dataset.c);

                    // Only add arrow if it's a different square
                    if (r !== this.arrowStart.r || c !== this.arrowStart.c) {
                        // Check if this arrow already exists, if so remove it
                        const existingIndex = this.arrows.findIndex(
                            a => a.from.r === this.arrowStart.r && a.from.c === this.arrowStart.c &&
                                a.to.r === r && a.to.c === c
                        );

                        if (existingIndex !== -1) {
                            this.arrows.splice(existingIndex, 1);
                        } else {
                            this.arrows.push({
                                from: { ...this.arrowStart },
                                to: { r, c },
                                color: 'rgba(255, 170, 0, 0.8)'
                            });
                        }
                        this.drawArrows();
                    }
                }

                this.drawingArrow = false;
                this.arrowStart = null;
                this.previewArrow = null;
                this.drawArrows(); // Redraw to clear preview
            }
        });

        this.initGame();
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.log('Connected to server. Joining game...');
            this.socket.emit('join_game');
        });

        this.socket.on('waiting_for_opponent', () => {
            this.waiting = true;
            this.log('Waiting for an ally to join...');
            this.updateStatus();
        });

        this.socket.on('init_game', (data) => {
            this.waiting = false;
            this.myRole = data.role;
            this.room = data.room;
            this.isMultiplayer = true;
            this.log(`Game Started! You are Player ${this.myRole}`);
            this.updateStatus();

            // Reset board to ensure fresh start
            this.initGame();
        });

        this.socket.on('opponent_move', (move) => {
            console.log('Received opponent move:', move);
            this.executeMove(move.from, move.to, false); // false = don't emit back
        });

        this.socket.on('restart_game', () => {
            this.log('Game restarted by opponent.');
            this.initGame();
        });
    }

    initGame() {
        this.createBoard();

        // Check for debug scenario
        const urlParams = new URLSearchParams(window.location.search);
        const scenarioName = urlParams.get('scenario');

        if (scenarioName && window.SCENARIOS && window.SCENARIOS[scenarioName]) {
            console.log(`Loading scenario: ${scenarioName}`);
            window.SCENARIOS[scenarioName].setup(this);
        } else {
            this.setupPieces();
        }

        this.turnIndex = 0;
        this.gameOver = false;
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.arrows = [];
        this.updateStatus();
        this.render();
        this.drawArrows();
    }

    createBoard() {
        this.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    }

    setupPieces() {
        // Enemy (Top) - Full 16 pieces on rows 0-1
        const enemyBackRow = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        enemyBackRow.forEach((type, i) => {
            this.board[0][i] = new Piece(type, FACTIONS.ENEMY);
        });
        for (let i = 0; i < 8; i++) {
            this.board[1][i] = new Piece('p', FACTIONS.ENEMY);
        }

        // Player Side (Bottom) - Split between A and B
        const playerBackRow = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

        // Player B controls Queenside (columns 0-3: a-d)
        for (let i = 0; i < 4; i++) {
            this.board[7][i] = new Piece(playerBackRow[i], FACTIONS.B);
            this.board[6][i] = new Piece('p', FACTIONS.B);
        }

        // Player A controls Kingside (columns 4-7: e-h)
        for (let i = 4; i < 8; i++) {
            this.board[7][i] = new Piece(playerBackRow[i], FACTIONS.A);
            this.board[6][i] = new Piece('p', FACTIONS.A);
        }
    }

    render() {
        this.boardElement.innerHTML = '';

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const square = document.createElement('div');
                square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.r = r;
                square.dataset.c = c;

                // Highlight last move
                if (this.lastMove) {
                    if ((this.lastMove.from.r === r && this.lastMove.from.c === c) ||
                        (this.lastMove.to.r === r && this.lastMove.to.c === c)) {
                        square.classList.add('last-move');
                    }
                }

                // Highlight selected
                if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
                    square.classList.add('selected');
                }

                // Highlight legal moves
                const move = this.legalMoves.find(m => m.r === r && m.c === c);
                if (move) {
                    if (this.board[r][c]) {
                        square.classList.add('valid-capture');
                    } else {
                        square.classList.add('valid-move');
                    }
                }

                const piece = this.board[r][c];
                if (piece) {
                    const pieceSpan = document.createElement('span');
                    pieceSpan.className = 'piece';
                    pieceSpan.textContent = SYMBOLS[piece.type];
                    pieceSpan.dataset.faction = piece.faction;
                    pieceSpan.draggable = false; // Prevent default drag
                    square.appendChild(pieceSpan);
                }

                square.addEventListener('click', () => this.handleSquareClick(r, c));
                square.addEventListener('mousedown', (e) => {
                    if (e.button === 0) {
                        this.handleMouseDown(e, r, c);
                    } else if (e.button === 2) {
                        this.handleRightMouseDown(e, r, c);
                    }
                });
                square.addEventListener('mouseup', (e) => this.handleMouseUp(e, r, c));
                square.addEventListener('mousemove', (e) => this.handleMouseMove(e, r, c));
                this.boardElement.appendChild(square);
            }
        }
    }

    handleSquareClick(r, c) {
        if (this.gameOver) return;

        const currentFaction = this.getCurrentFaction();

        // If it's Enemy turn, ignore clicks
        if (currentFaction === FACTIONS.ENEMY) return;

        const clickedPiece = this.board[r][c];
        const isControlable = clickedPiece && this.canSelectPiece(clickedPiece);

        // Select Piece
        if (isControlable) {
            this.selectedSquare = { r, c };
            this.legalMoves = this.getLegalMoves(r, c, clickedPiece);
            this.render();
            return;
        }

        // Move Piece
        if (this.selectedSquare) {
            const move = this.legalMoves.find(m => m.r === r && m.c === c);
            if (move) {
                this.executeMove(this.selectedSquare, { r, c }, true); // true = emit move
                return;
            }
        }

        // Deselect if clicking empty or invalid
        this.selectedSquare = null;
        this.legalMoves = [];
        this.render();
    }

    getCurrentFaction() {
        if (this.turnIndex === 0) return FACTIONS.A;
        if (this.turnIndex === 2) return FACTIONS.B;
        return FACTIONS.ENEMY;
    }

    isHostile(faction1, faction2) {
        if (faction1 === faction2) return false;
        if (faction1 === FACTIONS.ENEMY || faction2 === FACTIONS.ENEMY) return true;
        // A and B are friendly
        return false;
    }

    isSquareAttacked(r, c, faction) {
        // Check if any enemy piece can attack (r, c)
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const p = this.board[row][col];
                if (p && this.isHostile(p.faction, faction)) {
                    // For pawns, check capture moves specifically
                    if (p.type === 'p') {
                        const forward = p.faction === FACTIONS.ENEMY ? 1 : -1;
                        // Pawn captures diagonally
                        if (Math.abs(c - col) === 1 && row + forward === r) {
                            return true;
                        }
                    } else if (p.type === 'k') {
                        // King attacks adjacent
                        if (Math.abs(row - r) <= 1 && Math.abs(col - c) <= 1) {
                            return true;
                        }
                    } else {
                        // For sliding pieces/knights, use getLegalMovesRaw but filter for this square
                        // Optimization: Don't generate all moves, just check if it can hit target
                        // For now, reusing getLegalMovesRaw is easiest but maybe slow.
                        // Let's just use getLegalMovesRaw for now.
                        const moves = this.getLegalMovesRaw(row, col, p, true); // true = ignoreCastling to avoid recursion
                        if (moves.some(m => m.r === r && m.c === c)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    getLegalMovesRaw(r, c, piece, ignoreCastling = false) {
        // console.log(`getLegalMovesRaw: ${piece.type} at ${r},${c} ignoreCastling=${ignoreCastling} hasMoved=${piece.hasMoved}`);
        // Gets legal moves without check validation (used internally)
        const moves = [];
        const directions = {
            'r': [[0, 1], [0, -1], [1, 0], [-1, 0]],
            'b': [[1, 1], [1, -1], [-1, 1], [-1, -1]],
            'q': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
            'n': [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]],
            'k': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]
        };

        const isEnemy = piece.faction === FACTIONS.ENEMY;
        const forward = isEnemy ? 1 : -1; // Enemy moves down (row +), Players move up (row -)

        // Helper to add move if valid
        const tryAdd = (tr, tc) => {
            if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS) {
                const target = this.board[tr][tc];
                if (!target) {
                    moves.push({ r: tr, c: tc });
                    return true; // Continue sliding
                } else if (this.isHostile(piece.faction, target.faction)) {
                    moves.push({ r: tr, c: tc });
                    return false; // Stop sliding (capture)
                } else {
                    return false; // Blocked by friend
                }
            }
            return false; // Out of bounds
        };

        if (piece.type === 'p') {
            // Forward 1
            if (r + forward >= 0 && r + forward < ROWS && !this.board[r + forward][c]) {
                moves.push({ r: r + forward, c: c });

                // Forward 2 (Initial)
                const startRow = isEnemy ? 1 : 6; // Player pawns start at 6
                if (r === startRow && !this.board[r + forward * 2][c]) {
                    moves.push({ r: r + forward * 2, c: c });
                }
            }
            // Capture
            [[forward, 1], [forward, -1]].forEach(([dr, dc]) => {
                const tr = r + dr, tc = c + dc;
                if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS) {
                    const target = this.board[tr][tc];
                    if (target && this.isHostile(piece.faction, target.faction)) {
                        moves.push({ r: tr, c: tc });
                    }
                }
            });
        } else if (['r', 'b', 'q'].includes(piece.type)) {
            directions[piece.type].forEach(([dr, dc]) => {
                let tr = r + dr, tc = c + dc;
                while (tryAdd(tr, tc)) {
                    tr += dr;
                    tc += dc;
                }
            });
        } else if (piece.type === 'n' || piece.type === 'k') {
            directions[piece.type].forEach(([dr, dc]) => {
                tryAdd(r + dr, c + dc);
            });

            // Castling Logic
            if (piece.type === 'k' && !piece.hasMoved && !ignoreCastling) {
                const inCheck = this.isKingInCheck(piece.faction);

                if (!inCheck) {
                    // Kingside (Right) - Rook at column 7
                    if (c + 3 < COLS) {
                        const rightRook = this.board[r][7];
                        if (rightRook && rightRook.type === 'r' && rightRook.faction === piece.faction && !rightRook.hasMoved) {
                            // Check path between king and rook
                            let pathClear = true;
                            for (let col = c + 1; col < 7; col++) {
                                if (this.board[r][col]) {
                                    pathClear = false;
                                    break;
                                }
                            }

                            if (pathClear) {
                                const atk1 = this.isSquareAttacked(r, c + 1, piece.faction);
                                const atk2 = this.isSquareAttacked(r, c + 2, piece.faction);

                                if (!atk1 && !atk2) {
                                    moves.push({ r: r, c: c + 2, castling: 'kingside' });
                                }
                            }
                        }
                    }

                    // Queenside (Left) - Rook at column 0
                    if (c - 4 >= 0) {
                        const leftRook = this.board[r][0];
                        if (leftRook && leftRook.type === 'r' && leftRook.faction === piece.faction && !leftRook.hasMoved) {
                            // Check path between rook and king
                            let pathClear = true;
                            for (let col = 1; col < c; col++) {
                                if (this.board[r][col]) {
                                    pathClear = false;
                                    break;
                                }
                            }

                            if (pathClear) {
                                const atk1 = this.isSquareAttacked(r, c - 1, piece.faction);
                                const atk2 = this.isSquareAttacked(r, c - 2, piece.faction);

                                if (!atk1 && !atk2) {
                                    moves.push({ r: r, c: c - 2, castling: 'queenside' });
                                }
                            }
                        }
                    }
                }
            }
        }

        return moves;
    }

    getAllyFaction(faction) {
        if (faction === FACTIONS.A) return FACTIONS.B;
        if (faction === FACTIONS.B) return FACTIONS.A;
        return null;
    }

    isKingInCheck(faction) {
        // Find king(s)
        const kingPositions = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'k' && p.faction === faction) {
                    kingPositions.push({ r, c });
                }
            }
        }

        // Check if any king is under attack
        for (const kingPos of kingPositions) {
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const p = this.board[r][c];
                    if (p && this.isHostile(p.faction, faction)) {
                        const moves = this.getLegalMovesRaw(r, c, p, true);
                        if (moves.some(m => m.r === kingPos.r && m.c === kingPos.c)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    canRescueAlly(rescuerFaction, victimFaction) {
        // Iterate all pieces of rescuerFaction
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = this.board[r][c];
                if (p && p.faction === rescuerFaction) {
                    // If any move is legal, it means it's safe for both kings (due to wouldBeInCheck update)
                    if (this.getLegalMoves(r, c, p).length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    canSelectPiece(piece) {
        if (this.waiting) return false;

        const currentFaction = this.getCurrentFaction();

        // Multiplayer Check: Can only select own pieces
        if (this.isMultiplayer) {
            const myFaction = this.myRole === 'A' ? FACTIONS.A : FACTIONS.B;
            if (piece.faction !== myFaction) return false;

            // Can only move on my turn
            if (currentFaction !== myFaction) return false;
        }

        if (piece.faction === currentFaction) return true;

        const allyFaction = this.getAllyFaction(currentFaction);
        if (piece.faction === allyFaction) {
            if (this.isKingInCheck(allyFaction)) {
                if (!this.canRescueAlly(currentFaction, allyFaction)) {
                    return true;
                }
            }
        }
        return false;
    }

    wouldBeInCheck(from, to, faction) {
        // Simulate the move and check if THIS faction's king would be in check
        const piece = this.board[from.r][from.c];
        const target = this.board[to.r][to.c];

        // Make move temporarily
        this.board[to.r][to.c] = piece;
        this.board[from.r][from.c] = null;

        let inCheck = this.isKingInCheck(faction);
        if (!inCheck) {
            const allyFaction = this.getAllyFaction(faction);
            if (allyFaction) {
                inCheck = this.isKingInCheck(allyFaction);
            }
        }

        // Undo move
        this.board[from.r][from.c] = piece;
        this.board[to.r][to.c] = target;

        return inCheck;
    }

    getLegalMoves(r, c, piece) {
        // Get raw moves
        const rawMoves = this.getLegalMovesRaw(r, c, piece);

        // Filter out moves that would leave THIS faction's king in check
        const legalMoves = rawMoves.filter(move => {
            return !this.wouldBeInCheck({ r, c }, move, piece.faction);
        });

        return legalMoves;
    }

    checkPromotion(piece, r, c) {
        if (piece.type !== 'p') return false;

        // Player A/B promote at row 0
        if ((piece.faction === FACTIONS.A || piece.faction === FACTIONS.B) && r === 0) {
            return true;
        }

        // Enemy promotes at row ROWS-1
        if (piece.faction === FACTIONS.ENEMY && r === ROWS - 1) {
            return true;
        }

        return false;
    }

    handlePromotion(piece, r, c) {
        if (piece.faction === FACTIONS.ENEMY) {
            // Auto promote enemy to Queen
            piece.type = 'q';
            this.log(`${piece.faction} Pawn promoted to Queen!`);
            this.checkGameEnd();
            this.nextTurn();
        } else {
            // Show modal for player
            this.promotionPending = { piece, r, c };
            this.showPromotionModal();
        }
    }

    showPromotionModal() {
        const modal = document.getElementById('promotion-modal');
        modal.classList.remove('hidden');

        // Setup listeners if not already done (or just recreate them to be safe/simple)
        const buttons = modal.querySelectorAll('.promo-btn');
        buttons.forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.type;
                this.completePromotion(type);
                modal.classList.add('hidden');
            };
        });
    }

    completePromotion(type) {
        if (this.promotionPending) {
            const { piece, r, c } = this.promotionPending;
            piece.type = type;
            this.log(`${piece.faction} Pawn promoted to ${type.toUpperCase()}!`);
            this.promotionPending = null;
            this.render();
            this.checkGameEnd();
            this.nextTurn();
        }
    }

    executeMove(from, to, emit = true) {
        const piece = this.board[from.r][from.c];
        const target = this.board[to.r][to.c];

        // Handle Castling
        // We can detect castling if King moves 2 squares horizontally
        if (piece.type === 'k' && Math.abs(to.c - from.c) === 2) {
            // Determine side
            if (to.c > from.c) {
                // Kingside (Right)
                // Rook at column 7, moves to column 5
                const rook = this.board[from.r][7];
                this.board[from.r][5] = rook;
                this.board[from.r][7] = null;
                rook.hasMoved = true;
                this.log(`${piece.faction} Castles Kingside`);
            } else {
                // Queenside (Left)
                // Rook at column 0, moves to column 3
                const rook = this.board[from.r][0];
                this.board[from.r][3] = rook;
                this.board[from.r][0] = null;
                rook.hasMoved = true;
                this.log(`${piece.faction} Castles Queenside`);
            }
        }

        // Move Piece (King or otherwise)
        this.board[to.r][to.c] = piece;
        this.board[from.r][from.c] = null;
        piece.hasMoved = true;

        // Record Last Move
        this.lastMove = { from: { ...from }, to: { ...to } };

        // Log (if not castling, or add to log)
        if (!(piece.type === 'k' && Math.abs(to.c - from.c) === 2)) {
            let log = `${piece.faction} ${piece.type.toUpperCase()} to ${String.fromCharCode(97 + to.c)}${8 - to.r}`;
            if (target) {
                log += ` captures ${target.type.toUpperCase()}`;
            }
            this.log(log);
        }

        // Check Promotion
        if (this.checkPromotion(piece, to.r, to.c)) {
            this.handlePromotion(piece, to.r, to.c);
            return; // Wait for promotion to complete before next turn
        }

        // Check Win/Loss
        if (this.checkGameEnd()) return;

        // Emit Move
        if (this.isMultiplayer && emit) {
            this.socket.emit('make_move', {
                room: this.room,
                move: { from, to }
            });
        }

        // Next Turn
        this.selectedSquare = null;
        this.legalMoves = [];
        this.nextTurn();
    }

    nextTurn() {
        this.turnIndex = (this.turnIndex + 1) % 4;
        this.updateStatus();
        this.render();

        if (this.getCurrentFaction() === FACTIONS.ENEMY) {
            setTimeout(() => this.aiMove(), 500); // Small delay for effect
        }
    }

    updateStatus() {
        const factions = ['Player A', 'Enemy', 'Player B', 'Enemy'];
        const classes = ['player-a', 'enemy', 'player-b', 'enemy'];

        this.turnBadge.textContent = `${factions[this.turnIndex]}'s Turn`;
        this.turnBadge.className = `badge ${classes[this.turnIndex]}`;

        if (this.waiting) {
            this.turnBadge.textContent = "Waiting for Ally...";
            this.turnBadge.className = "badge enemy";
        } else if (this.isMultiplayer) {
            const myFaction = this.myRole === 'A' ? FACTIONS.A : FACTIONS.B;
            if (this.getCurrentFaction() === myFaction) {
                this.turnBadge.textContent += " (YOUR TURN)";
                this.turnBadge.style.border = "2px solid white";
            } else {
                this.turnBadge.style.border = "none";
            }
        }
    }

    log(msg) {
        this.messageLog.textContent = msg;
    }

    checkGameEnd() {
        let allyKings = 0;
        let enemyKings = 0;

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = this.board[r][c];
                if (p && p.type === 'k') {
                    if (p.faction === FACTIONS.A || p.faction === FACTIONS.B) {
                        allyKings++;
                    } else if (p.faction === FACTIONS.ENEMY) {
                        enemyKings++;
                    }
                }
            }
        }

        // Lose Condition: If the allied king is captured.
        // Players A and B share one king (controlled by Player A on kingside)
        if (allyKings === 0) {
            this.endGame(false);
            return true;
        }

        // Win Condition: Enemy king captured.
        if (enemyKings === 0) {
            this.endGame(true);
            return true;
        }

        return false;
    }

    endGame(victory) {
        this.gameOver = true;
        this.log(victory ? "VICTORY! All enemy kings defeated." : "DEFEAT! An allied king has fallen.");
        this.turnBadge.textContent = victory ? "VICTORY" : "GAME OVER";
        this.turnBadge.style.backgroundColor = victory ? "gold" : "grey";
        this.render();
    }

    setupArrowCanvas() {
        if (!this.arrowCanvas) return;

        const resizeCanvas = () => {
            const rect = this.boardElement.getBoundingClientRect();
            this.arrowCanvas.width = rect.width;
            this.arrowCanvas.height = rect.height;
            this.drawArrows();
        };

        window.addEventListener('resize', resizeCanvas);
        // Initial resize after DOM is loaded
        setTimeout(resizeCanvas, 0);
    }

    handleMouseDown(e, r, c) {
        if (e.button !== 0) return; // Only left click
        if (this.gameOver) return;

        const currentFaction = this.getCurrentFaction();
        if (currentFaction === FACTIONS.ENEMY) return;

        const piece = this.board[r][c];
        if (piece && this.canSelectPiece(piece)) {
            this.draggingPiece = piece;
            this.dragFrom = { r, c };
            this.selectedSquare = { r, c };
            this.legalMoves = this.getLegalMoves(r, c, piece);

            // Create dragging visual
            const square = e.currentTarget;
            const pieceElement = square.querySelector('.piece');
            if (pieceElement) {
                this.dragElement = pieceElement.cloneNode(true);
                this.dragElement.style.position = 'fixed';
                this.dragElement.style.pointerEvents = 'none';
                this.dragElement.style.zIndex = '1000';
                this.dragElement.style.fontSize = '2.5rem';
                this.dragElement.style.opacity = '0.8';
                document.body.appendChild(this.dragElement);
                this.updateDragElement(e);

                // Hide original piece while dragging
                pieceElement.style.opacity = '0.3';
            }

            this.render();
        }
    }

    handleMouseMove(e, r, c) {
        if (this.draggingPiece && this.dragElement) {
            this.updateDragElement(e);
        }

        // Update preview arrow while right-click dragging
        if (this.drawingArrow && this.arrowStart) {
            if (r !== this.arrowStart.r || c !== this.arrowStart.c) {
                this.previewArrow = {
                    from: { ...this.arrowStart },
                    to: { r, c },
                    color: 'rgba(255, 170, 0, 0.6)' // Slightly transparent for preview
                };
            } else {
                this.previewArrow = null;
            }
            this.drawArrows();
        }
    }

    handleMouseUp(e, r, c) {
        if (e.button !== 0) return; // Only left click

        if (this.draggingPiece && this.dragFrom) {
            // Check if this is a valid move
            const move = this.legalMoves.find(m => m.r === r && m.c === c);
            if (move) {
                this.executeMove(this.dragFrom, { r, c }, true); // true = emit
            } else {
                // Invalid move, just deselect
                this.selectedSquare = null;
                this.legalMoves = [];
                this.render();
            }

            // Clean up drag element
            if (this.dragElement) {
                this.dragElement.remove();
                this.dragElement = null;
            }

            this.draggingPiece = null;
            this.dragFrom = null;
        }
    }

    handleRightMouseDown(e, r, c) {
        e.preventDefault();

        // Clear arrows on right click if not already drawing
        if (!this.drawingArrow) {
            this.arrows = [];
            this.previewArrow = null;
            this.drawArrows();
        }

        this.drawingArrow = true;
        this.arrowStart = { r, c };
    }

    updateDragElement(e) {
        if (this.dragElement) {
            this.dragElement.style.left = (e.clientX - 20) + 'px';
            this.dragElement.style.top = (e.clientY - 20) + 'px';
        }
    }

    getSquareCenter(r, c) {
        const rect = this.boardElement.getBoundingClientRect();
        const squareWidth = rect.width / COLS;
        const squareHeight = rect.height / ROWS;

        return {
            x: c * squareWidth + squareWidth / 2,
            y: r * squareHeight + squareHeight / 2
        };
    }

    drawArrows() {
        if (!this.arrowCtx || !this.arrowCanvas) return;

        const ctx = this.arrowCtx;
        const rect = this.boardElement.getBoundingClientRect();

        // Clear canvas
        ctx.clearRect(0, 0, this.arrowCanvas.width, this.arrowCanvas.height);

        // Draw confirmed arrows
        this.arrows.forEach(arrow => {
            const from = this.getSquareCenter(arrow.from.r, arrow.from.c);
            const to = this.getSquareCenter(arrow.to.r, arrow.to.c);
            this.drawArrow(ctx, from.x, from.y, to.x, to.y, arrow.color);
        });

        // Draw preview arrow if dragging
        if (this.previewArrow) {
            const from = this.getSquareCenter(this.previewArrow.from.r, this.previewArrow.from.c);
            const to = this.getSquareCenter(this.previewArrow.to.r, this.previewArrow.to.c);
            this.drawArrow(ctx, from.x, from.y, to.x, to.y, this.previewArrow.color);
        }
    }

    drawArrow(ctx, fromX, fromY, toX, toY, color = 'rgba(255, 170, 0, 0.8)') {
        const headlen = 15; // Length of arrow head
        const angle = Math.atan2(toY - fromY, toX - fromX);

        // Shorten the arrow so it doesn't cover the pieces completely
        const shortenBy = 20;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const ratio = (length - shortenBy) / length;

        const adjustedToX = fromX + dx * ratio;
        const adjustedToY = fromY + dy * ratio;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';

        // Draw line
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(adjustedToX, adjustedToY);
        ctx.stroke();

        // Draw arrow head
        ctx.beginPath();
        ctx.moveTo(adjustedToX, adjustedToY);
        ctx.lineTo(
            adjustedToX - headlen * Math.cos(angle - Math.PI / 6),
            adjustedToY - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            adjustedToX - headlen * Math.cos(angle + Math.PI / 6),
            adjustedToY - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
    }

    clearArrows() {
        this.arrows = [];
        this.drawArrows();
    }

    aiMove() {
        if (this.gameOver) return;

        this.log("Enemy is thinking...");

        // Use setTimeout to allow UI to update before AI calculation blocks the thread
        setTimeout(() => {
            const move = this.ai.getBestMove();

            if (move) {
                // If I am the one running the AI (because it's my turn's aftermath), I should emit it
                // Logic: If it was MY turn, and now it's Enemy turn, I run the AI.
                // But wait, nextTurn() is called on both clients.
                // We need to decide who runs the AI.
                // Simple rule: Player A (Host-ish) runs AI? Or whoever just moved?
                // Let's say Player A runs AI for Enemy Turn 1 (after A), and Player B runs AI for Enemy Turn 3 (after B)?
                // Actually, turnIndex: 0(A) -> 1(Enemy) -> 2(B) -> 3(Enemy)

                let shouldEmit = false;
                if (this.isMultiplayer) {
                    // If turn is 1 (Enemy after A), Player A should run it.
                    // If turn is 3 (Enemy after B), Player B should run it.
                    if (this.turnIndex === 1 && this.myRole === 'A') shouldEmit = true;
                    if (this.turnIndex === 3 && this.myRole === 'B') shouldEmit = true;

                    if (!shouldEmit) return; // Don't run AI if it's not my responsibility
                }

                this.executeMove(move.from, move.to, true); // Emit AI move
            } else {
                console.warn('AI found no moves, skipping turn');
                this.nextTurn();
            }
        }, 100);
    }

    validateStockfishMove(move) {
        // Verify the move is valid in our game
        if (!move || !move.from || !move.to) return false;

        const { from, to } = move;

        // Check bounds
        if (from.r < 0 || from.r >= ROWS || from.c < 0 || from.c >= COLS) return false;
        if (to.r < 0 || to.r >= ROWS || to.c < 0 || to.c >= COLS) return false;

        // Check if there's a piece at from position
        const piece = this.board[from.r][from.c];
        if (!piece || piece.faction !== FACTIONS.ENEMY) return false;

        // Check if the move is in legal moves
        const legalMoves = this.getLegalMoves(from.r, from.c, piece);
        return legalMoves.some(m => m.r === to.r && m.c === to.c);
    }

    fallbackRandomAI() {
        // Find all enemy pieces
        const enemyPieces = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = this.board[r][c];
                if (p && p.faction === FACTIONS.ENEMY) {
                    enemyPieces.push({ r, c, piece: p });
                }
            }
        }

        // Collect all legal moves
        const allMoves = [];
        enemyPieces.forEach(item => {
            const moves = this.getLegalMoves(item.r, item.c, item.piece);
            moves.forEach(m => {
                allMoves.push({ from: { r: item.r, c: item.c }, to: m });
            });
        });

        if (allMoves.length > 0) {
            // Simple AI: Random Move with capture preference
            const captureMoves = allMoves.filter(m => this.board[m.to.r][m.to.c] !== null);

            let selectedMove;
            if (captureMoves.length > 0 && Math.random() > 0.3) { // 70% chance to take a capture if available
                selectedMove = captureMoves[Math.floor(Math.random() * captureMoves.length)];
            } else {
                selectedMove = allMoves[Math.floor(Math.random() * allMoves.length)];
            }

            this.executeMove(selectedMove.from, selectedMove.to);
        } else {
            // No moves available (Stalemate for enemy?)
            this.log("Enemy has no moves!");
            this.nextTurn();
        }
    }
}

// Start the game
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});

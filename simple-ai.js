class SimpleAI {
    constructor(game) {
        this.game = game;
        this.maxDepth = 2; // Depth 2 is decent for ~1000-1200 ELO
        this.nodeCount = 0;

        // Piece values
        this.PIECE_VALUES = {
            'p': 100,
            'n': 320,
            'b': 330,
            'r': 500,
            'q': 900,
            'k': 20000
        };
    }

    evaluate() {
        let score = 0;
        const board = this.game.board;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 16; c++) {
                const piece = board[r][c];
                if (!piece) continue;

                let value = this.PIECE_VALUES[piece.type] || 0;

                // Position bonuses
                if (piece.type === 'p') {
                    // Pawns get bonus for advancing
                    if (piece.faction === 'Enemy') {
                        value += r * 10; // Enemy moves down (row increases)
                    } else {
                        value += (7 - r) * 10; // Players move up
                    }
                } else if (piece.type === 'n' || piece.type === 'b') {
                    // Minor pieces get bonus for being central-ish
                    if (r > 1 && r < 6) value += 10;
                }

                if (piece.faction === 'Enemy') {
                    score += value;
                } else {
                    score -= value;
                }
            }
        }

        // Add some randomness to make it feel human/less robotic
        score += Math.floor(Math.random() * 20) - 10;

        return score;
    }

    getBestMove() {
        console.log("SimpleAI: Starting search...");
        this.nodeCount = 0;
        const startTime = performance.now();

        // Get all legal moves for Enemy
        const moves = this.getAllMoves('Enemy');
        console.log(`SimpleAI: Found ${moves.length} root moves`);

        if (moves.length === 0) return null;

        let bestMove = null;
        let bestValue = -Infinity;
        let alpha = -Infinity;
        let beta = Infinity;

        // Sort moves to improve pruning (captures first)
        this.orderMoves(moves);

        for (const move of moves) {
            // Execute move
            const capturedPiece = this.makeMove(move);

            // Minimax
            const boardValue = this.minimax(this.maxDepth - 1, false, alpha, beta);

            // Undo move
            this.undoMove(move, capturedPiece);

            if (boardValue > bestValue) {
                bestValue = boardValue;
                bestMove = move;
            }

            alpha = Math.max(alpha, bestValue);
        }

        const endTime = performance.now();
        console.log(`AI searched ${this.nodeCount} nodes in ${(endTime - startTime).toFixed(2)}ms. Best eval: ${bestValue}`);

        return bestMove;
    }

    minimax(depth, isMaximizing, alpha, beta) {
        this.nodeCount++;

        if (depth === 0) {
            return this.evaluate();
        }

        const faction = isMaximizing ? 'Enemy' : 'Player'; // Simplified: 'Player' covers both A and B
        const moves = this.getAllMoves(faction);

        if (moves.length === 0) {
            // Check for checkmate or stalemate
            let inCheck = false;
            if (faction === 'Enemy') {
                inCheck = this.game.isKingInCheck('Enemy');
                return inCheck ? -100000 : 0;
            } else {
                // Check if either player king is in check
                inCheck = this.game.isKingInCheck('A') || this.game.isKingInCheck('B');
                return inCheck ? 100000 : 0;
            }
        }

        this.orderMoves(moves);

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const capturedPiece = this.makeMove(move);
                const evalScore = this.minimax(depth - 1, false, alpha, beta);
                this.undoMove(move, capturedPiece);

                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const capturedPiece = this.makeMove(move);
                const evalScore = this.minimax(depth - 1, true, alpha, beta);
                this.undoMove(move, capturedPiece);

                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    getAllMoves(side) {
        const moves = [];
        const board = this.game.board;

        // Identify factions based on side
        const factions = side === 'Enemy' ? ['Enemy'] : ['A', 'B'];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 16; c++) {
                const piece = board[r][c];
                if (piece && factions.includes(piece.faction)) {
                    const pieceMoves = this.game.getLegalMoves(r, c, piece);
                    for (const to of pieceMoves) {
                        moves.push({
                            from: { r, c },
                            to: to,
                            piece: piece
                        });
                    }
                }
            }
        }
        return moves;
    }

    makeMove(move) {
        const board = this.game.board;
        const capturedPiece = board[move.to.r][move.to.c];

        // Move piece
        board[move.to.r][move.to.c] = board[move.from.r][move.from.c];
        board[move.from.r][move.from.c] = null;

        return capturedPiece;
    }

    undoMove(move, capturedPiece) {
        const board = this.game.board;

        // Move piece back
        board[move.from.r][move.from.c] = board[move.to.r][move.to.c];
        board[move.to.r][move.to.c] = capturedPiece;
    }

    orderMoves(moves) {
        // Simple move ordering: captures first
        moves.sort((a, b) => {
            const board = this.game.board;
            const captureA = board[a.to.r][a.to.c] ? 10 : 0;
            const captureB = board[b.to.r][b.to.c] ? 10 : 0;
            return captureB - captureA;
        });
    }
}

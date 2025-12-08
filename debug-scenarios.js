window.SCENARIOS = {
    'promotion_test': {
        setup: (game) => {
            // Clear board
            game.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));

            // Place Kings (Required for game loop)
            game.board[7][4] = new Piece('k', FACTIONS.A);
            game.board[7][12] = new Piece('k', FACTIONS.B);
            game.board[0][4] = new Piece('k', FACTIONS.ENEMY);
            game.board[0][12] = new Piece('k', FACTIONS.ENEMY);

            // Place Pawn ready to promote (Player A)
            // Row 1 is one step away from Row 0 (Promotion)
            game.board[1][0] = new Piece('p', FACTIONS.A);

            // Place Pawn ready to promote (Player B)
            game.board[1][8] = new Piece('p', FACTIONS.B);

            // Place Enemy Pawn ready to promote
            // Row 6 is one step away from Row 7
            game.board[6][15] = new Piece('p', FACTIONS.ENEMY);
        }
    },
    'castling_test': {
        setup: (game) => {
            // Clear board
            game.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));

            // Player A Setup for Castling
            game.board[7][4] = new Piece('k', FACTIONS.A);
            game.board[7][0] = new Piece('r', FACTIONS.A); // Queenside Rook
            game.board[7][7] = new Piece('r', FACTIONS.A); // Kingside Rook

            // Player B Setup for Castling
            game.board[7][12] = new Piece('k', FACTIONS.B);
            game.board[7][8] = new Piece('r', FACTIONS.B); // Queenside Rook
            game.board[7][15] = new Piece('r', FACTIONS.B); // Kingside Rook

            // Enemy Kings (Required)
            game.board[0][4] = new Piece('k', FACTIONS.ENEMY);
            game.board[0][12] = new Piece('k', FACTIONS.ENEMY);
        }
    }
};

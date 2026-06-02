document.addEventListener('DOMContentLoaded', () => {
    const boardEl = document.getElementById('chessboard');
    const turnIndicator = document.getElementById('turn-indicator');
    const SIZE = 8;

    const EMOJIS = {
        wK: '♔', bK: '♚',
        wQ: '♕', bQ: '♛',
        wR: '♖', bR: '♜',
        wB: '♗', bB: '♝',
        wN: '♘', bN: '♞',
        wP: '♙', bP: '♟'
    };

    let board;     // board[row][col] = piece string or null
    let turn;      // 'w' or 'b'
    let selected;  // { row, col } or null
    let moved;     // castling eligibility flags

    // ── Initialisation ────────────────────────────────────────────────────────

    function startGame() {
        board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
        for (let c = 0; c < SIZE; c++) {
            board[0][c] = 'w' + back[c];
            board[1][c] = 'wP';
            board[6][c] = 'bP';
            board[7][c] = 'b' + back[c];
        }
        turn = 'w';
        selected = null;
        moved = { wK: false, bK: false, wRa: false, wRh: false, bRa: false, bRh: false };
        render();
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    function render() {
        boardEl.innerHTML = '';
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const sq = document.createElement('div');
                sq.className = `square ${(r + c) % 2 === 0 ? 'white' : 'black'}`;
                sq.dataset.row = r;
                sq.dataset.col = c;
                sq.textContent = board[r][c] ? EMOJIS[board[r][c]] : '';
                sq.addEventListener('click', onSquareClick);
                sq.addEventListener('mouseover', () => { if (!selected) sq.classList.add('hover'); });
                sq.addEventListener('mouseout', () => sq.classList.remove('hover'));
                boardEl.appendChild(sq);
            }
        }
        refreshStatus();
    }

    function cell(r, c) {
        return boardEl.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
    }

    function clearDecoration() {
        boardEl.querySelectorAll('.valid-move, .invalid-move, .selected, .in-check')
            .forEach(el => el.classList.remove('valid-move', 'invalid-move', 'selected', 'in-check'));
    }

    function refreshStatus() {
        clearDecoration();
        const inCheck = isInCheck(turn, board);
        if (inCheck) {
            const [kr, kc] = findKing(turn, board);
            if (kr !== -1) cell(kr, kc).classList.add('in-check');
        }
        const label = inCheck ? ' — in check!' : '';
        turnIndicator.textContent = (turn === 'w' ? "White's Turn" : "Black's Turn") + label;
        turnIndicator.style.color = turn === 'w' ? '#1a1a1a' : '#f5f5f5';
        turnIndicator.style.backgroundColor = turn === 'w' ? '#f0d9b5' : '#4a3728';
    }

    function setGameOverMsg(msg) {
        turnIndicator.textContent = msg;
        turnIndicator.style.color = '#fff';
        turnIndicator.style.backgroundColor = '#570000';
    }

    // ── Click handling ────────────────────────────────────────────────────────

    function onSquareClick(e) {
        const r = +e.currentTarget.dataset.row;
        const c = +e.currentTarget.dataset.col;

        if (selected) {
            const { row: fr, col: fc } = selected;

            if (fr === r && fc === c) {
                selected = null;
                refreshStatus();
                return;
            }

            if (isLegalMove(fr, fc, r, c, board)) {
                doMove(fr, fc, r, c);
                return;
            }

            if (board[r][c] && board[r][c][0] === turn) {
                selected = { row: r, col: c };
                refreshStatus();
                cell(r, c).classList.add('selected');
                showHints(r, c);
                return;
            }

            selected = null;
            const el = cell(r, c);
            el.classList.add('invalid-move');
            setTimeout(() => el && el.classList.remove('invalid-move'), 500);
            refreshStatus();
        } else {
            if (board[r][c] && board[r][c][0] === turn) {
                selected = { row: r, col: c };
                refreshStatus();
                cell(r, c).classList.add('selected');
                showHints(r, c);
            }
        }
    }

    function showHints(r, c) {
        for (let tr = 0; tr < SIZE; tr++)
            for (let tc = 0; tc < SIZE; tc++)
                if (isLegalMove(r, c, tr, tc, board)) cell(tr, tc).classList.add('valid-move');
    }

    // ── Move execution ────────────────────────────────────────────────────────

    function doMove(fr, fc, tr, tc) {
        const piece = board[fr][fc];
        const colour = piece[0];
        const type = piece[1];
        const castleSide = (type === 'K' && Math.abs(tc - fc) === 2)
            ? (tc > fc ? 'K' : 'Q') : null;

        const next = copyBoard(board);
        applyMove(next, fr, fc, tr, tc, castleSide);

        if (type === 'P' && (tr === 7 || tr === 0)) next[tr][tc] = colour + 'Q';

        const nm = { ...moved };
        if (piece === 'wK') nm.wK = true;
        if (piece === 'bK') nm.bK = true;
        if (fr === 0 && fc === 0) nm.wRa = true;
        if (fr === 0 && fc === 7) nm.wRh = true;
        if (fr === 7 && fc === 0) nm.bRa = true;
        if (fr === 7 && fc === 7) nm.bRh = true;
        // A captured rook can no longer castle
        if (tr === 0 && tc === 0) nm.wRa = true;
        if (tr === 0 && tc === 7) nm.wRh = true;
        if (tr === 7 && tc === 0) nm.bRa = true;
        if (tr === 7 && tc === 7) nm.bRh = true;

        board = next;
        moved = nm;
        turn = colour === 'w' ? 'b' : 'w';
        selected = null;

        render();
        checkEndGame();
    }

    function applyMove(state, fr, fc, tr, tc, castleSide) {
        state[tr][tc] = state[fr][fc];
        state[fr][fc] = null;
        if (castleSide === 'K') {
            state[tr][5] = state[tr][7];
            state[tr][7] = null;
        } else if (castleSide === 'Q') {
            state[tr][3] = state[tr][0];
            state[tr][0] = null;
        }
    }

    // ── Legality ──────────────────────────────────────────────────────────────

    function isLegalMove(fr, fc, tr, tc, state) {
        if (!isPseudo(fr, fc, tr, tc, state, false)) return false;
        const piece = state[fr][fc];
        const colour = piece[0];
        const type = piece[1];
        const sim = copyBoard(state);
        const castleSide = (type === 'K' && Math.abs(tc - fc) === 2)
            ? (tc > fc ? 'K' : 'Q') : null;
        applyMove(sim, fr, fc, tr, tc, castleSide);
        if (type === 'P' && (tr === 7 || tr === 0)) sim[tr][tc] = colour + 'Q';
        return !isInCheck(colour, sim);
    }

    // forCheck=true omits castling validation to prevent mutual recursion
    function isPseudo(fr, fc, tr, tc, state, forCheck) {
        if (fr === tr && fc === tc) return false;
        if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) return false;
        const piece = state[fr][fc];
        if (!piece) return false;
        const colour = piece[0];
        const type = piece[1];
        const target = state[tr][tc];
        if (target && target[0] === colour) return false;

        switch (type) {
            case 'P': return pawnOk(fr, fc, tr, tc, colour, state);
            case 'R': return rookOk(fr, fc, tr, tc, state);
            case 'B': return bishopOk(fr, fc, tr, tc, state);
            case 'Q': return rookOk(fr, fc, tr, tc, state) || bishopOk(fr, fc, tr, tc, state);
            case 'N': return knightOk(fr, fc, tr, tc);
            case 'K': return kingOk(fr, fc, tr, tc, colour, state, forCheck);
            default:  return false;
        }
    }

    function pawnOk(fr, fc, tr, tc, colour, state) {
        const d = colour === 'w' ? 1 : -1;
        const start = colour === 'w' ? 1 : 6;
        const t = state[tr][tc];
        if (tc === fc && tr === fr + d && !t) return true;
        if (tc === fc && fr === start && tr === fr + 2 * d && !t && !state[fr + d][fc]) return true;
        if (Math.abs(tc - fc) === 1 && tr === fr + d && t && t[0] !== colour) return true;
        return false;
    }

    function rookOk(fr, fc, tr, tc, state) {
        if (fr !== tr && fc !== tc) return false;
        return pathClear(fr, fc, tr, tc, state);
    }

    function bishopOk(fr, fc, tr, tc, state) {
        if (Math.abs(tr - fr) !== Math.abs(tc - fc)) return false;
        return pathClear(fr, fc, tr, tc, state);
    }

    function knightOk(fr, fc, tr, tc) {
        const dr = Math.abs(tr - fr), dc = Math.abs(tc - fc);
        return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
    }

    function kingOk(fr, fc, tr, tc, colour, state, forCheck) {
        const dr = Math.abs(tr - fr), dc = Math.abs(tc - fc);
        if (dr <= 1 && dc <= 1) return true;
        if (!forCheck && dr === 0 && dc === 2) return castleOk(fr, fc, tr, tc, colour, state);
        return false;
    }

    function castleOk(fr, fc, tr, tc, colour, state) {
        if (colour === 'w' && moved.wK) return false;
        if (colour === 'b' && moved.bK) return false;
        if (isInCheck(colour, state)) return false;

        const row = colour === 'w' ? 0 : 7;
        if (fr !== row) return false;

        const kside = tc > fc;
        if (colour === 'w' &&  kside && moved.wRh) return false;
        if (colour === 'w' && !kside && moved.wRa) return false;
        if (colour === 'b' &&  kside && moved.bRh) return false;
        if (colour === 'b' && !kside && moved.bRa) return false;

        const rookCol = kside ? 7 : 0;
        if (state[row][rookCol] !== colour + 'R') return false;

        const lo = Math.min(fc, rookCol) + 1;
        const hi = Math.max(fc, rookCol) - 1;
        for (let c = lo; c <= hi; c++) if (state[row][c]) return false;

        // King must not pass through or land on an attacked square
        const step = kside ? 1 : -1;
        for (let c = fc + step; c !== tc + step; c += step) {
            const sim = copyBoard(state);
            sim[row][fc] = null;
            sim[row][c] = colour + 'K';
            if (isInCheck(colour, sim)) return false;
        }

        return true;
    }

    function pathClear(fr, fc, tr, tc, state) {
        const dr = Math.sign(tr - fr), dc = Math.sign(tc - fc);
        let r = fr + dr, c = fc + dc;
        while (r !== tr || c !== tc) {
            if (state[r][c]) return false;
            r += dr; c += dc;
        }
        return true;
    }

    // ── Check detection ───────────────────────────────────────────────────────

    function isInCheck(colour, state) {
        const [kr, kc] = findKing(colour, state);
        if (kr === -1) return true;
        const opp = colour === 'w' ? 'b' : 'w';
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (state[r][c] && state[r][c][0] === opp)
                    if (isPseudo(r, c, kr, kc, state, true)) return true;
        return false;
    }

    function findKing(colour, state) {
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++)
                if (state[r][c] === colour + 'K') return [r, c];
        return [-1, -1];
    }

    // ── End-game detection ────────────────────────────────────────────────────

    function checkEndGame() {
        if (hasLegalMove(turn, board)) return;
        const inCheck = isInCheck(turn, board);
        const msg = inCheck
            ? `Checkmate! ${turn === 'w' ? 'Black' : 'White'} wins!`
            : "Stalemate — it's a draw!";
        setGameOverMsg(msg);
        setTimeout(() => { if (confirm(msg + '\n\nPlay again?')) startGame(); }, 150);
    }

    function hasLegalMove(colour, state) {
        for (let fr = 0; fr < SIZE; fr++)
            for (let fc = 0; fc < SIZE; fc++) {
                const p = state[fr][fc];
                if (!p || p[0] !== colour) continue;
                for (let tr = 0; tr < SIZE; tr++)
                    for (let tc = 0; tc < SIZE; tc++)
                        if (isLegalMove(fr, fc, tr, tc, state)) return true;
            }
        return false;
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    function copyBoard(state) {
        return state.map(row => [...row]);
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    startGame();
    document.getElementById('reset').addEventListener('click', startGame);
});

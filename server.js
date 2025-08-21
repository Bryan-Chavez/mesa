// ai-server/server.js
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --- LÓGICA DEL JUEGO DE DAMAS ---

/**
 * Obtiene todos los movimientos posibles (simples y capturas) para un jugador dado,
 * respetando la regla de la captura obligatoria.
 * @param {Array<Array<Object>>} boardState - El estado actual del tablero.
 * @param {string} currentPlayer - El jugador ('white' o 'black') cuyo turno es.
 * @returns {Array<Object>} Una lista de todos los movimientos posibles.
 */
function getAllPossibleMoves(boardState, currentPlayer) {
    let allPossibleMoves = [];
    let allPossibleCaptures = [];

    // Primero, encuentra todas las posibles capturas para el jugador actual.
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState?.[r]?.[c];
            if (piece && piece.player === currentPlayer) {
                // Busca capturas, incluyendo multicapturas.
                const capturesForPiece = findJumpPaths(boardState, r, c, currentPlayer);
                if (capturesForPiece.length > 0) {
                    allPossibleCaptures.push(...capturesForPiece.map(path => ({
                        startRow: r,
                        startCol: c,
                        row: path.finalRow,
                        col: path.finalCol,
                        captured: path.captured,
                        continuationMoves: path.continuationMoves
                    })));
                }
            }
        }
    }

    // Si hay capturas, solo se permiten capturas.
    if (allPossibleCaptures.length > 0) {
        return allPossibleCaptures;
    }

    // Si no hay capturas, busca movimientos simples.
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState?.[r]?.[c];
            if (piece && piece.player === currentPlayer) {
                const simpleMovesForPiece = findSimpleMoves(boardState, r, c, currentPlayer);
                simpleMovesForPiece.forEach(move => {
                    allPossibleMoves.push({ startRow: r, startCol: c, ...move });
                });
            }
        }
    }
    return allPossibleMoves;
}

/**
 * Encuentra todos los movimientos simples para una pieza.
 * Se usa cuando no hay capturas obligatorias.
 */
function findSimpleMoves(boardState, row, col, currentPlayer) {
    const moves = [];
    const piece = boardState[row][col];
    const directions = [
        { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
        { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
    ];

    for (const dir of directions) {
        if (!piece.isKing) {
            if (piece.player === 'white' && dir.dr > 0) continue;
            if (piece.player === 'black' && dir.dr < 0) continue;
        }

        let r = row + dir.dr;
        let c = col + dir.dc;

        // Bucle para damas que se mueven varias casillas.
        while (r >= 0 && r < 8 && c >= 0 && c < 8 && !boardState?.[r]?.[c]) {
            moves.push({ row: r, col: c, captured: null });
            if (!piece.isKing) break;
            r += dir.dr;
            c += dir.dc;
        }
    }
    return moves;
}

/**
 * Función recursiva para encontrar todas las posibles cadenas de capturas.
 * Este es el principal cambio para manejar los multisaltos correctamente.
 */
function findJumpPaths(boardState, startRow, startCol, currentPlayer, capturedPath = []) {
    const paths = [];
    const piece = boardState[startRow][startCol];
    const opponent = piece.player === 'white' ? 'black' : 'white';
    const directions = [
        { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
        { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
    ];

    let foundCapture = false;

    for (const dir of directions) {
        // Lógica de movimiento y captura para fichas normales y damas.
        if (!piece.isKing) {
            const jumpedOverRow = startRow + dir.dr;
            const jumpedOverCol = startCol + dir.dc;
            const landingRow = startRow + 2 * dir.dr;
            const landingCol = startCol + 2 * dir.dc;

            if (landingRow >= 0 && landingRow < 8 && landingCol >= 0 && landingCol < 8) {
                const jumpedOverPiece = boardState?.[jumpedOverRow]?.[jumpedOverCol];
                const landingSquare = boardState?.[landingRow]?.[landingCol];
                if (jumpedOverPiece && jumpedOverPiece.player === opponent && !landingSquare) {
                    foundCapture = true;
                    const newCapturedPath = [...capturedPath, { row: jumpedOverRow, col: jumpedOverCol }];
                    const newBoard = simulateMove(boardState, startRow, startCol, landingRow, landingCol, [{ row: jumpedOverRow, col: jumpedOverCol }]);
                    
                    const continuationMoves = findJumpPaths(newBoard, landingRow, landingCol, currentPlayer, newCapturedPath);
                    
                    if (continuationMoves.length > 0) {
                        paths.push(...continuationMoves);
                    } else {
                        paths.push({ finalRow: landingRow, finalCol: landingCol, captured: newCapturedPath });
                    }
                }
            }
        } else { // Lógica para damas (kings)
            let steppedRow = startRow + dir.dr;
            let steppedCol = startCol + dir.dc;
            let capturedPiecePos = null;

            while (steppedRow >= 0 && steppedRow < 8 && steppedCol >= 0 && steppedCol < 8) {
                const currentSquare = boardState[steppedRow][steppedCol];
                if (currentSquare) {
                    if (currentSquare.player === opponent) {
                        if (capturedPiecePos) {
                            break; // Ya capturó una pieza en esta dirección, no puede capturar más
                        }
                        capturedPiecePos = { row: steppedRow, col: steppedCol };
                    } else {
                        break; // Bloqueado por una pieza propia
                    }
                } else {
                    if (capturedPiecePos) {
                        foundCapture = true;
                        const newCapturedPath = [...capturedPath, capturedPiecePos];
                        const newBoard = simulateMove(boardState, startRow, startCol, steppedRow, steppedCol, [capturedPiecePos]);
                        const continuationMoves = findJumpPaths(newBoard, steppedRow, steppedCol, currentPlayer, newCapturedPath);

                        if (continuationMoves.length > 0) {
                            paths.push(...continuationMoves);
                        } else {
                            paths.push({ finalRow: steppedRow, finalCol: steppedCol, captured: newCapturedPath });
                        }
                    }
                }
                steppedRow += dir.dr;
                steppedCol += dir.dc;
            }
        }
    }

    // Si no se encontraron más capturas, devuelve el camino actual como un movimiento final.
    if (!foundCapture && capturedPath.length > 0) {
        return [{ finalRow: startRow, finalCol: startCol, captured: capturedPath }];
    }

    return paths;
}


// Función para simular un movimiento en un tablero temporal
function simulateMove(currentBoard, startRow, startCol, endRow, endCol, capturedPieces) {
    const newBoard = JSON.parse(JSON.stringify(currentBoard)); // Copia profunda del tablero

    const piece = newBoard[startRow][startCol];
    newBoard[endRow][endCol] = piece;
    newBoard[startRow][startCol] = null;

    if (capturedPieces) {
        capturedPieces.forEach(cap => {
            if (cap) {
              newBoard[cap.row][cap.col] = null;
            }
        });
    }

    // Promoción a Dama
    if (piece.player === 'white' && endRow === 0) {
        newBoard[endRow][endCol].isKing = true;
    } else if (piece.player === 'black' && endRow === 7) {
        newBoard[endRow][endCol].isKing = true;
    }

    return newBoard;
}

// Función de evaluación de tablero (heurística para la IA)
function evaluateBoard(boardState, player) {
    let score = 0;
    const opponent = player === 'white' ? 'black' : 'white';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece) {
                if (piece.player === player) {
                    score += 10;
                    if (piece.isKing) score += 20;
                    if (player === 'white') score += (7 - r) * 0.5; // Avanzar es bueno
                    if (player === 'black') score += r * 0.5; // Avanzar es bueno
                } else if (piece.player === opponent) {
                    score -= 10;
                    if (piece.isKing) score -= 20;
                    if (opponent === 'white') score -= (7 - r) * 0.5;
                    if (opponent === 'black') score -= r * 0.5;
                }
            }
        }
    }
    return score;
}

// Función para verificar si el juego ha terminado en un estado dado
function isGameOver(boardState, player) {
    return getAllPossibleMoves(boardState, player).length === 0;
}


// --- ALGORITMO MINIMAX CON PODA ALFA-BETA ---
function minimax(boardState, depth, alpha, beta, maximizingPlayer, currentPlayer) {
    const opponent = currentPlayer === 'white' ? 'black' : 'white';

    if (depth === 0 || isGameOver(boardState, currentPlayer)) {
        return evaluateBoard(boardState, maximizingPlayer ? currentPlayer : opponent);
    }

    let allPossibleMoves = getAllPossibleMoves(boardState, currentPlayer);

    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of allPossibleMoves) {
            const simulatedBoard = simulateMove(boardState, move.startRow, move.startCol, move.row, move.col, move.captured);
            const evaluation = minimax(simulatedBoard, depth - 1, alpha, beta, false, opponent);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, maxEval);
            if (beta <= alpha) {
                break;
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of allPossibleMoves) {
            const simulatedBoard = simulateMove(boardState, move.startRow, move.startCol, move.row, move.col, move.captured);
            const evaluation = minimax(simulatedBoard, depth - 1, alpha, beta, true, opponent);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, minEval);
            if (beta <= alpha) {
                break;
            }
        }
        return minEval;
    }
}

// --- API Endpoint para la IA ---
app.post('/api/getAIMove', (req, res) => {
    const { boardState, currentPlayer } = req.body;

    const AI_PLAYER = currentPlayer;
    const OPPONENT_PLAYER = AI_PLAYER === 'white' ? 'black' : 'white';
    const SEARCH_DEPTH = 5; // Aumentar la profundidad de búsqueda para mejor juego

    let bestMove = null;
    let bestScore = -Infinity;

    const allMovesForAI = getAllPossibleMoves(boardState, AI_PLAYER);

    if (allMovesForAI.length === 0) {
        console.log('IA: No hay movimientos posibles para el jugador', AI_PLAYER);
        return res.json({ move: null });
    }

    for (const move of allMovesForAI) {
        const simulatedBoard = simulateMove(boardState, move.startRow, move.startCol, move.row, move.col, move.captured);
        const score = minimax(simulatedBoard, SEARCH_DEPTH - 1, -Infinity, Infinity, false, OPPONENT_PLAYER);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    const equallyGoodMoves = allMovesForAI.filter(move => {
        const simulatedBoard = simulateMove(boardState, move.startRow, move.startCol, move.row, move.col, move.captured);
        const score = minimax(simulatedBoard, SEARCH_DEPTH - 1, -Infinity, Infinity, false, OPPONENT_PLAYER);
        return score === bestScore;
    });
    
    // Seleccionar aleatoriamente entre los mejores movimientos para una IA menos predecible
    if (equallyGoodMoves.length > 0) {
        bestMove = equallyGoodMoves[Math.floor(Math.random() * equallyGoodMoves.length)];
    }

    res.json({ move: bestMove });
});

// Endpoint para obtener movimientos posibles de una pieza (usado por el cliente)
app.post('/api/getPossibleMoves', (req, res) => {
    const { boardState, startRow, startCol, currentPlayer } = req.body;
    
    // Primero, verifica si hay capturas obligatorias en el tablero
    const allCaptures = getAllPossibleMoves(boardState, currentPlayer).filter(m => m.captured && m.captured.length > 0);

    let moves = [];
    if (allCaptures.length > 0) {
        // Si hay capturas, solo muestra las de la pieza seleccionada
        const pieceCaptures = allCaptures.filter(m => m.startRow === startRow && m.startCol === startCol);
        if (pieceCaptures.length > 0) {
            moves = pieceCaptures;
        } else {
            // Si la pieza no tiene capturas, pero hay otras obligatorias, no tiene movimientos
            moves = [];
        }
    } else {
        // Si no hay capturas obligatorias, muestra los movimientos simples
        moves = findSimpleMoves(boardState, startRow, startCol, currentPlayer).map(m => ({
            ...m,
            captured: null, // Asegurar que el cliente sepa que no es una captura
            startRow: startRow, // Agregar startRow y startCol
            startCol: startCol,
        }));
    }
    res.json({ moves });
});


// Endpoint para que el cliente verifique el estado del juego
app.post('/api/getAllPossibleMoves', (req, res) => {
    const { boardState, currentPlayer } = req.body;
    const moves = getAllPossibleMoves(boardState, currentPlayer);
    res.json({ moves: moves });
});

// Endpoint de chat de IA
app.post('/api/chat', async (req, res) => {
    const message = req.body.message;
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    
    const genAI = new GoogleGenerativeAI(''); // La clave de API se inyecta en el entorno de ejecución
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

    try {
        const result = await model.generateContent(`Eres un asistente de juego de damas. Responde a mi pregunta sobre las damas o el tablero. No respondas sobre otro tema. Mi pregunta es: "${message}"`);
        const response = result.response;
        const text = response.text();
        res.json({ reply: text });
    } catch (error) {
        console.error('Error al comunicarse con el modelo de IA:', error);
        res.status(500).json({ reply: 'Hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.' });
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor de la IA escuchando en http://localhost3000:${port}`);
});

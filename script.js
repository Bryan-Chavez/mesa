// script.js

// --- VARIABLES GLOBALES DEL JUEGO ---
// El estado del tablero se representa como un array 2D. 0 = vacío, 1 = ficha blanca, 2 = ficha negra, 3 = reina blanca, 4 = reina negra
let boardState = [];
let selectedPiece = null;
let turn = 'white'; // 'white' o 'black'
let possibleMoves = [];
let isGameOver = false;
let isGameStarted = false; // Estado del tutorial
let isMidCapture = false; // Nueva variable para manejar capturas múltiples
let isAnimating = false; // Bandera para evitar clics durante la animación
const MOVE_ANIMATION_DURATION = 300; // Duración de la animación en milisegundos

// --- ELEMENTOS DEL DOM ---
const boardEl = document.getElementById('board');
const gameStatusEl = document.getElementById('current-turn');
const winnerMessageEl = document.getElementById('winner-message');
const resetButton = document.getElementById('reset-game-btn');
const suggestButton = document.getElementById('suggest-move-btn');
const aiSuggestionBox = document.getElementById('ai-suggestion-box');
const chatOutputEl = document.getElementById('chat-output');
const chatInputEl = document.getElementById('chat-input');
const chatButton = document.getElementById('send-chat-btn');
const tutorialOverlay = document.getElementById('tutorial-overlay');
const startGameButton = document.getElementById('start-game-btn');
const messageBoxEl = document.getElementById('message-box');
const messageTextEl = document.getElementById('message-text');

// --- FUNCIONES PRINCIPALES DEL JUEGO ---

/**
 * Muestra un mensaje en una caja de diálogo personalizada.
 * @param {string} message El mensaje a mostrar.
 */
function showMessage(message) {
    if (messageTextEl) messageTextEl.textContent = message;
    if (messageBoxEl) messageBoxEl.style.display = 'block';
}

/**
 * Oculta la caja de diálogo de mensajes.
 */
function hideMessage() {
    if (messageBoxEl) messageBoxEl.style.display = 'none';
}

/**
 * Inicializa el tablero del juego, tanto la estructura HTML como el estado lógico.
 */
function createBoard() {
    boardEl.innerHTML = '';
    boardState = [];
    selectedPiece = null;
    possibleMoves = [];
    isGameOver = false;
    isMidCapture = false;
    turn = 'white';
    gameStatusEl.textContent = 'Blancas';
    if (winnerMessageEl) winnerMessageEl.style.display = 'none';
    hideMessage();
    aiSuggestionBox.style.display = 'none';

    // Inicializar el array del estado del tablero
    for (let i = 0; i < 8; i++) {
        boardState[i] = [];
        for (let j = 0; j < 8; j++) {
            boardState[i][j] = 0;
        }
    }

    // Colocar las fichas iniciales
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 8; j++) {
            if ((i + j) % 2 !== 0) {
                boardState[i][j] = 2; // Fichas negras
            }
        }
    }

    for (let i = 5; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if ((i + j) % 2 !== 0) {
                boardState[i][j] = 1; // Fichas blancas
            }
        }
    }
    
    renderBoard();
}

/**
 * Actualiza el DOM del tablero para reflejar el estado actual del juego.
 */
function renderBoard() {
    boardEl.innerHTML = ''; // Limpiar el tablero existente
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.dataset.row = i;
            square.dataset.col = j;
            square.classList.add((i + j) % 2 === 0 ? 'light' : 'dark');

            // Crear y añadir las fichas
            const pieceType = boardState[i][j];
            if (pieceType !== 0) {
                const piece = document.createElement('div');
                piece.classList.add('piece');
                if (pieceType === 1 || pieceType === 3) {
                    piece.classList.add('white');
                } else {
                    piece.classList.add('black');
                }
                if (pieceType > 2) {
                    piece.classList.add('king');
                }
                square.appendChild(piece);
            }
            boardEl.appendChild(square);
        }
    }

    // Resaltar la pieza seleccionada y los posibles movimientos
    if (selectedPiece) {
        const { row, col } = selectedPiece;
        const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
        if (square && square.firstChild) {
            square.firstChild.classList.add('selected');
        }
        possibleMoves.forEach(move => {
            const square = document.querySelector(`.square[data-row="${move.row}"][data-col="${move.col}"]`);
            if (square) {
                square.classList.add('possible-move');
            }
        });
    }
}

/**
 * Maneja los clics en el tablero, ya sea para seleccionar una pieza o para moverla.
 * @param {Event} event El evento de click.
 */
async function handleBoardClick(event) {
    if (isAnimating || isGameOver || !isGameStarted || turn !== 'white') return; 

    const squareEl = event.target.closest('.square');
    if (!squareEl) return;

    const row = parseInt(squareEl.dataset.row);
    const col = parseInt(squareEl.dataset.col);
    const pieceType = boardState[row][col];
    const pieceColor = (pieceType === 1 || pieceType === 3) ? 'white' : 'black';

    if (selectedPiece) {
        const move = possibleMoves.find(m => m.row === row && m.col === col);
        if (move) {
            await movePiece(selectedPiece.row, selectedPiece.col, row, col, move.captured);
        } else if (!isMidCapture) {
            selectedPiece = null;
            possibleMoves = [];
            renderBoard();
        }
    } else if (pieceType !== 0 && pieceColor === turn) {
        const allCaptures = getAllPossibleMoves(boardState, turn).filter(move => move.captured);
        const capturesForThisPiece = getPossibleMoves(row, col, boardState).filter(move => move.captured);

        if (allCaptures.length > 0) {
            if (capturesForThisPiece.length > 0) {
                selectPiece(row, col);
            } else {
                showMessage("Debes realizar una captura si es posible.");
            }
        } else {
            selectPiece(row, col);
        }
    }
}

/**
 * Selecciona una pieza y determina sus posibles movimientos.
 * @param {number} row La fila de la pieza.
 * @param {number} col La columna de la pieza.
 */
function selectPiece(row, col) {
    selectedPiece = { row, col };
    let moves = getPossibleMoves(row, col, boardState);
    const captures = moves.filter(move => move.captured);
    if (captures.length > 0) {
        possibleMoves = captures; 
    } else {
        possibleMoves = moves;
    }
    renderBoard();
}

/**
 * Calcula todos los movimientos válidos (incluyendo saltos) para una pieza.
 * @param {number} row La fila de la pieza.
 * @param {number} col La columna de la pieza.
 * @param {Array<Array<number>>} board El estado del tablero para el que se calculan los movimientos.
 * @returns {Array<Object>} Un array de objetos con las coordenadas de los movimientos posibles y la pieza capturada (si aplica).
 */
function getPossibleMoves(row, col, board) {
    const moves = [];
    const pieceType = board[row][col];
    const isKing = pieceType > 2;
    const isWhite = pieceType === 1 || pieceType === 3;
    const directions = isKing ? [-1, 1] : (isWhite ? [-1] : [1]);
    const myColor = isWhite ? 'white' : 'black';

    for (const dRow of directions) {
        for (const dCol of [-1, 1]) {
            // Movimientos para piezas normales
            if (!isKing) {
                const newRow = row + dRow;
                const newCol = col + dCol;
                
                // Mover a casilla vacía
                if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8 && board[newRow][newCol] === 0) {
                    moves.push({ row: newRow, col: newCol });
                }
                
                // Salto sobre una pieza enemiga
                const jumpRow = row + dRow * 2;
                const jumpCol = col + dCol * 2;
                if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8 && board[jumpRow][jumpCol] === 0) {
                    const capturedPiece = board[newRow][newCol];
                    if (capturedPiece !== 0) {
                        const capturedColor = (capturedPiece === 1 || capturedPiece === 3) ? 'white' : 'black';
                        if (capturedColor !== myColor) {
                            moves.push({ row: jumpRow, col: jumpCol, captured: { row: newRow, col: newCol } });
                        }
                    }
                }
            } else { // Movimientos y saltos para las reinas
                let tempRow = row + dRow;
                let tempCol = col + dCol;
                let capturedPiece = null;
                let foundOpponent = false;

                while (tempRow >= 0 && tempRow < 8 && tempCol >= 0 && tempCol < 8) {
                    const nextSquare = board[tempRow][tempCol];
                    const nextPieceColor = (nextSquare === 1 || nextSquare === 3) ? 'white' : 'black';

                    if (nextSquare === 0) {
                        if (foundOpponent) {
                             // Si ya se ha encontrado una pieza enemiga, cualquier casilla vacía más allá es un movimiento de captura válido
                            moves.push({ row: tempRow, col: tempCol, captured: capturedPiece });
                        } else {
                            // Si no se ha encontrado pieza enemiga, es un movimiento normal
                            moves.push({ row: tempRow, col: tempCol });
                        }
                    } else if (nextPieceColor === myColor) {
                        // Pieza del mismo color, el camino está bloqueado
                        break;
                    } else { // Pieza enemiga
                        if (foundOpponent) {
                            // Ya se ha encontrado una pieza enemiga, el camino está bloqueado
                            break;
                        } else {
                            // Se encontró la primera pieza enemiga, se guarda para un posible salto
                            foundOpponent = true;
                            capturedPiece = { row: tempRow, col: tempCol };
                        }
                    }
                    tempRow += dRow;
                    tempCol += dCol;
                }
            }
        }
    }
    return moves;
}

/**
 * Mueve una pieza en el tablero y actualiza el estado del juego con animación.
 * @param {number} startRow Fila de inicio.
 * @param {number} startCol Columna de inicio.
 * @param {number} endRow Fila de destino.
 * @param {number} endCol Columna de destino.
 * @param {Object} captured La pieza capturada, si la hay.
 * @returns {Promise<void>} Una promesa que se resuelve cuando la animación ha terminado.
 */
function movePiece(startRow, startCol, endRow, endCol, captured) {
    return new Promise(resolve => {
        isAnimating = true;

        const startSquare = document.querySelector(`.square[data-row="${startRow}"][data-col="${startCol}"]`);
        const pieceEl = startSquare.querySelector('.piece');
        const endSquare = document.querySelector(`.square[data-row="${endRow}"][data-col="${endCol}"]`);

        if (!pieceEl || !endSquare) {
            isAnimating = false;
            resolve();
            return;
        }
        
        // Animación de movimiento
        pieceEl.classList.add('moving-piece');
        const startRect = startSquare.getBoundingClientRect();
        const endRect = endSquare.getBoundingClientRect();
        const deltaX = endRect.left - startRect.left;
        const deltaY = endRect.top - startRect.top;
        pieceEl.style.transition = `transform ${MOVE_ANIMATION_DURATION}ms ease-in-out`;
        pieceEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        
        // Animación de captura
        if (captured) {
            const capturedSquare = document.querySelector(`.square[data-row="${captured.row}"][data-col="${captured.col}"]`);
            const capturedPieceEl = capturedSquare.querySelector('.piece');
            if (capturedPieceEl) {
                capturedPieceEl.style.transition = `transform ${MOVE_ANIMATION_DURATION}ms ease-in-out, opacity ${MOVE_ANIMATION_DURATION}ms ease-in-out`;
                capturedPieceEl.style.transform = 'scale(0)';
                capturedPieceEl.style.opacity = '0';
            }
        }

        setTimeout(() => {
            // Eliminar estilos de animación
            pieceEl.classList.remove('moving-piece');
            pieceEl.style.transform = 'none';

            // Actualizar el estado del tablero
            const pieceType = boardState[startRow][startCol];
            boardState[endRow][endCol] = pieceType;
            boardState[startRow][startCol] = 0;
            if (captured) {
                boardState[captured.row][captured.col] = 0;
                updateChat(turn === 'white' ? 'user' : 'ai', `¡Ficha capturada en (${captured.row}, ${captured.col})!`);
            }
            
            checkPromotion(endRow, endCol);
            
            // Lógica para capturas múltiples
            if (captured) {
                const nextCaptures = getPossibleMoves(endRow, endCol, boardState).filter(move => move.captured);
                if (nextCaptures.length > 0) {
                    isMidCapture = true;
                    selectedPiece = { row: endRow, col: endCol };
                    possibleMoves = nextCaptures;
                    renderBoard();
                    isAnimating = false;
                    resolve();
                    return;
                }
            }

            // Si no hay más capturas o no fue una captura, terminar el turno
            isMidCapture = false;
            selectedPiece = null;
            possibleMoves = [];
            renderBoard();
            if (turn === 'white') {
                switchTurn();
                checkForWin();
            }
            isAnimating = false;
            resolve();
        }, MOVE_ANIMATION_DURATION);
    });
}


/**
 * Revisa si una ficha ha llegado al final del tablero y la convierte en reina.
 * @param {number} row La fila de la pieza.
 * @param {number} col La columna de la pieza.
 */
function checkPromotion(row, col) {
    const pieceType = boardState[row][col];
    if (pieceType === 1 && row === 0) {
        boardState[row][col] = 3; 
        updateChat('user', '¡Tu ficha se ha convertido en una Reina! 👑');
    } else if (pieceType === 2 && row === 7) {
        boardState[row][col] = 4;
        updateChat('ai', '¡La ficha de tu oponente se ha convertido en una Reina! 👑');
    }
}

/**
 * Cambia el turno al siguiente jugador y activa el turno de la IA si corresponde.
 */
function switchTurn() {
    turn = turn === 'white' ? 'black' : 'white';
    gameStatusEl.textContent = turn === 'white' ? 'Blancas' : 'Negras';
    if (turn === 'black' && !isGameOver) {
        updateChat('ai', 'Estoy pensando en mi movimiento...');
        makeAIMove();
    }
}

/**
 * Revisa si hay un ganador y actualiza el estado del juego.
 */
function checkForWin() {
    const whitePieces = boardState.flat().filter(p => p === 1 || p === 3).length;
    const blackPieces = boardState.flat().filter(p => p === 2 || p === 4).length;
    const allWhiteMoves = getAllPossibleMoves(boardState, 'white');
    const allBlackMoves = getAllPossibleMoves(boardState, 'black');

    if (whitePieces === 0 || allWhiteMoves.length === 0) {
        isGameOver = true;
        showMessage('¡Negras han ganado!');
        if (winnerMessageEl) {
            winnerMessageEl.textContent = '¡Negras han ganado!';
            winnerMessageEl.style.display = 'block';
        }
        updateChat('ai', '¡Buen juego! ¡He ganado!');
        animateReset();
    } else if (blackPieces === 0 || allBlackMoves.length === 0) {
        isGameOver = true;
        showMessage('¡Blancas han ganado!');
        if (winnerMessageEl) {
            winnerMessageEl.textContent = '¡Blancas han ganado!';
            winnerMessageEl.style.display = 'block';
        }
        updateChat('ai', '¡Felicidades! Has ganado.');
        animateReset();
    }
}

/**
 * Agrega un mensaje al área de chat.
 * @param {string} role 'user' o 'ai'.
 * @param {string} message El mensaje a mostrar.
 */
function updateChat(role, message) {
    if (!chatOutputEl) return;
    const p = document.createElement('p');
    p.classList.add(role === 'user' ? 'user' : 'ai');
    p.textContent = `${role === 'user' ? 'Tú' : 'Asistente IA'}: ${message}`;
    chatOutputEl.appendChild(p);
    chatOutputEl.scrollTop = chatOutputEl.scrollHeight;
}

/**
 * Maneja el envío de mensajes al chat.
 */
async function handleChatSubmit() {
    const message = chatInputEl.value.trim();
    if (message === '') return;

    updateChat('user', message);
    chatInputEl.value = '';

    const payload = {
        message: message
    };

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();
        const aiMessage = result.message;
        if (aiMessage) {
            updateChat('ai', aiMessage);
        } else {
            updateChat('ai', 'Lo siento, no pude generar una respuesta. Inténtalo de nuevo.');
        }

    } catch (error) {
        console.error('Error al llamar a la API:', error);
        updateChat('ai', '¡Error de conexión con el servidor! Asegúrate de que tu `server.js` esté ejecutándose.');
    }
}

/**
 * Reinicia el juego.
 */
function resetGame() {
    isGameStarted = true;
    updateChat('ai', '¡Juego reiniciado! Turno para Blancas.');
    createBoard();
}

/**
 * Inicializa el juego al cargar la página.
 */
function init() {
    showTutorial();
    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            hideTutorial();
            resetGame();
        });
    } else {
        console.error("El botón 'Empezar a juego' no se encontró. Asegúrate de que la ID en tu HTML sea 'start-game-btn'.");
    }
    
    boardEl.addEventListener('click', handleBoardClick);
    if (resetButton) resetButton.addEventListener('click', resetGame);
    if (chatButton) chatButton.addEventListener('click', handleChatSubmit);
    if (chatInputEl) {
        chatInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleChatSubmit();
            }
        });
    }
    
    if (suggestButton) {
        suggestButton.addEventListener('click', handleAISuggestion);
    }
}

/**
 * Muestra la pantalla del tutorial.
 */
function showTutorial() {
    if (tutorialOverlay) tutorialOverlay.classList.remove('hidden');
}

/**
 * Oculta la pantalla del tutorial.
 */
function hideTutorial() {
    if (tutorialOverlay) tutorialOverlay.classList.add('hidden');
}

/**
 * Reinicia el tablero al estado inicial. No se usa animación para simplificar el código.
 */
function animateReset() {
    setTimeout(createBoard, 1500);
}

// ======================================
// === LÓGICA DE IA OPTIMIZADA ===
// ======================================

/**
 * Función principal para que la IA realice su movimiento, incluyendo capturas encadenadas.
 */
async function makeAIMove() {
    await new Promise(resolve => setTimeout(resolve, 500)); // Pausa para simular "pensamiento"

    let allPossibleMoves = getAllPossibleMoves(boardState, 'black');
    const captures = allPossibleMoves.filter(move => move.captured);

    if (captures.length > 0) {
        let currentMove = captures[0];
        while (currentMove) {
            const { start, end, captured } = currentMove;
            updateChat('ai', `Muevo mi ficha desde (${start.row}, ${start.col}) a (${end.row}, ${end.col}).`);
            await movePiece(start.row, start.col, end.row, end.col, captured);

            const nextCaptures = getPossibleMoves(end.row, end.col, boardState).filter(move => move.captured);
            if (nextCaptures.length > 0) {
                currentMove = {
                    start: { row: end.row, col: end.col },
                    end: nextCaptures[0],
                    captured: nextCaptures[0].captured
                };
            } else {
                currentMove = null;
            }
        }
    } else if (allPossibleMoves.length > 0) {
        const simpleMove = allPossibleMoves[0];
        const { start, end } = simpleMove;
        updateChat('ai', `Muevo mi ficha desde (${start.row}, ${start.col}) a (${end.row}, ${end.col}).`);
        await movePiece(start.row, start.col, end.row, end.col, null);
    } else {
        updateChat('ai', '¡Vaya! No tengo movimientos válidos. Parece que has ganado o me has bloqueado.');
        isGameOver = true;
        checkForWin();
        return;
    }
    
    if (!isGameOver) {
        switchTurn();
        checkForWin();
    }
}

/**
 * ** NUEVO: Función para obtener una sugerencia del asistente de IA para el jugador. **
 */
async function handleAISuggestion() {
    if (turn !== 'white') {
        showMessage('La IA solo puede ayudarte en tu turno (fichas blancas).');
        return;
    }
    
    suggestButton.disabled = true;
    aiSuggestionBox.style.display = 'block';
    aiSuggestionBox.innerHTML = '<div class="loading">Asistente de IA pensando...</div>';
    
    const possibleMoves = getAllPossibleMoves(boardState, 'white');
    
    const prompt = `Eres un experto jugador de damas. Ayúdame a elegir el mejor movimiento. 
    Aquí está el estado actual del tablero, donde 0=vacío, 1=blanco, 2=negro, 3=reina blanca, 4=reina negra:
    ${JSON.stringify(boardState)}
    
    Mi turno (jugador BLANCO). Mis movimientos posibles son:
    ${JSON.stringify(possibleMoves)}
    
    Analiza la situación y elige el mejor movimiento de la lista. Dame la respuesta en español en el siguiente formato:
    "Mi mejor sugerencia es mover la ficha de [fila_inicio, columna_inicio] a [fila_destino, columna_destino].
    Razón: [Una breve explicación de por qué es la mejor jugada, por ejemplo, "porque captura una pieza del oponente", o "porque bloquea un movimiento enemigo", o "porque te acerca a coronar una reina"]."
    
    Si no hay movimientos posibles, di: "No hay movimientos disponibles."
    `;
    
    const payload = {
        prompt: prompt
    };

    try {
        const response = await fetch('/api/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();
        const aiMessage = result.message;
        
        if (aiMessage) {
            aiSuggestionBox.innerHTML = aiMessage;
        } else {
            aiSuggestionBox.textContent = 'Lo siento, no pude generar una sugerencia. Inténtalo de nuevo.';
        }

    } catch (error) {
        console.error('Error al llamar a la API de sugerencia:', error);
        aiSuggestionBox.textContent = '¡Error de conexión! No se pudo obtener la sugerencia.';
    } finally {
        suggestButton.disabled = false;
    }
}

/**
 * Genera todos los movimientos posibles para un jugador en un tablero dado.
 * @param {Array<Array<number>>} board El estado del tablero.
 * @param {string} player El jugador ('white' o 'black').
 * @returns {Array<Object>} Un array de movimientos posibles, incluyendo start, end, y capturas.
 */
function getAllPossibleMoves(board, player) {
    const allMoves = [];
    let allCaptures = [];

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const pieceType = board[i][j];
            const isWhite = pieceType === 1 || pieceType === 3;
            const pieceColor = isWhite ? 'white' : 'black';

            if (pieceType !== 0 && pieceColor === player) {
                const moves = getPossibleMoves(i, j, board);
                const captures = moves.filter(move => move.captured);

                for (const move of moves) {
                    const moveObj = {
                        start: { row: i, col: j },
                        end: { row: move.row, col: move.col }
                    };
                    if (move.captured) {
                        moveObj.captured = move.captured;
                        allCaptures.push(moveObj);
                    } else {
                        allMoves.push(moveObj);
                    }
                }
            }
        }
    }
    
    return allCaptures.length > 0 ? allCaptures : allMoves;
}

document.addEventListener('DOMContentLoaded', init);

let accessToken = '';
let currentTrack = null;
let timerInterval = null;
let player = null;
let playlistId = '2TieOXUFdPe8OrB8WYgKJy?si=5iJTAhqeQYWRAJj2HZf3kA';
let allTracks = [];  // Variable global para almacenar todas las canciones

// Variables para el nuevo sistema de juego
let gameConfig = {
    mode: 'single',
    rounds: 5,
    category: 'song',
    currentRound: 1,
    usedTracks: new Set(),
    players: {
        player1: { name: 'Jugador 1', score: 0 },
        player2: { name: 'Jugador 2', score: 0 }
    },
    currentPlayer: 'player1'
};
document.getElementById('selectionType').addEventListener('change', function(e) {
    if (e.target.value === 'artist') {
        document.getElementById('playlistSelection').style.display = 'none';
        document.getElementById('artistSelection').style.display = 'block';
    } else {
        document.getElementById('playlistSelection').style.display = 'block';
        document.getElementById('artistSelection').style.display = 'none';
    }
});
const artistTracksCache = {}; // Objeto para almacenar las canciones por artista


async function getTracksByArtist(artistName) {
    if (!accessToken) {
        accessToken = await getAccessToken();
    }

    // Obtener el nivel de dificultad
    const difficulty = document.getElementById('difficultySelect').value;

    // Verificar si ya tenemos canciones en caché para este artista y dificultad
    if (artistTracksCache[artistName]?.[difficulty]) {
        console.log(`Usando canciones en caché para el artista: ${artistName}, dificultad: ${difficulty}`);
        return artistTracksCache[artistName][difficulty];
    }

    try {
        // Buscar el artista
        const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const searchData = await searchResponse.json();
        const artistId = searchData.artists.items[0]?.id;

        if (!artistId) {
            updateGameStatus('No se encontró el artista', 'error');
            return null;
        }

        let tracks = [];

        if (difficulty === 'normal') {
            // Obtener las canciones más populares (top 10)
            const topTracksResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const topTracksData = await topTracksResponse.json();
            tracks = topTracksData.tracks.slice(0, 10); // Solo tomar las primeras 10 canciones
        } else {
            // Obtener todas las canciones del artista (modo extremo)
            const albumsResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?market=US&include_groups=album,single&limit=50`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const albumsData = await albumsResponse.json();

            // Recorrer los álbumes para obtener las canciones de cada uno
            for (let album of albumsData.items) {
                const albumTracksResponse = await fetch(`https://api.spotify.com/v1/albums/${album.id}/tracks`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                const albumTracksData = await albumTracksResponse.json();
                tracks.push(...albumTracksData.items);
            }
        }

        // Guardar las canciones en caché según el nivel de dificultad
        if (!artistTracksCache[artistName]) {
            artistTracksCache[artistName] = {};
        }
        artistTracksCache[artistName][difficulty] = tracks;

        return tracks;
    } catch (error) {
        console.error('Error al obtener las canciones del artista:', error);
        updateGameStatus('Error al obtener las canciones del artista', 'error');
        return null;
    }
}

// Función para inicializar el juego
function initializeGame() {
    const roundsInput = document.getElementById('roundsNumber').value;
    const rounds = parseInt(roundsInput);

    if (isNaN(rounds) || rounds <= 0) {
        updateGameStatus('Por favor, introduce un número válido de rondas.', 'error');
        return;
    }

    gameConfig.mode = document.getElementById('gameMode').value;
    gameConfig.rounds = rounds; // Número de rondas establecido por el usuario
    gameConfig.currentRound = 1;
    gameConfig.usedTracks.clear();
    gameConfig.players.player1.score = 0;
    gameConfig.players.player2.score = 0;
    gameConfig.currentPlayer = 'player1';
    gameConfig.totalRounds = gameConfig.mode === 'multi' ? rounds * 2 : rounds; // Ajuste para multijugador
    gameConfig.category = document.getElementById('gameCategory').value;

    // Configurar nombres de jugadores
    if (gameConfig.mode === 'multi') {
        gameConfig.players.player1.name = document.getElementById('player1').value || 'Jugador 1';
        gameConfig.players.player2.name = document.getElementById('player2').value || 'Jugador 2';
        document.getElementById('player2Score').style.display = 'block';
    } else {
        document.getElementById('player2Score').style.display = 'none';
    }

    // Resetear puntuaciones y ronda actual
    gameConfig.currentRound = 1;
    gameConfig.currentTurn = 1; // Turno global
    gameConfig.usedTracks.clear();
    gameConfig.players.player1.score = 0;
    gameConfig.players.player2.score = 0;
    gameConfig.currentPlayer = 'player1';

    // Actualizar UI
    document.getElementById('gameConfig').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    document.getElementById('currentRound').textContent = gameConfig.currentRound;
    document.getElementById('totalRounds').textContent = gameConfig.rounds;
    updateScores();
    updateCurrentPlayer();

    // Comenzar primera ronda
    newGame();
}




// Event listener para el modo de juego
document.getElementById('gameMode').addEventListener('change', function(e) {
    document.getElementById('playerNames').style.display = 
        e.target.value === 'multi' ? 'block' : 'none';
});

async function getAccessToken() {
    try {
        const response = await fetch('/api/getAccessToken');
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Error al obtener el token:', error);
        return null;
    }
}



// Usarla directamente en getRandomTrack:
async function getRandomTrack() {
    if (!accessToken) {
        accessToken = await getAccessToken(); // Asignar el token aquí
    }
   

    try {
        const playlistResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const playlist = await playlistResponse.json();
        
        // Filtrar canciones ya usadas
        const availableTracks = playlist.tracks.items.filter(item => 
            !gameConfig.usedTracks.has(item.track.id)
        );

        if (availableTracks.length === 0) {
            updateGameStatus('¡No hay más canciones disponibles!', 'error');
            return null;
        }

        const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)].track;
        gameConfig.usedTracks.add(randomTrack.id);
        
        return randomTrack;
    } catch (error) {
        updateGameStatus('Error al obtener la canción', 'error');
        return null;
    }
}

function updatePlayer(trackId) {
    const playerContainer = document.getElementById('playerContainer');
    playerContainer.innerHTML = `
        <iframe
            src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator"
            width="100%"
            height="100px"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
        ></iframe>
    `;
}
function normalizeString(str) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Elimina marcas diacríticas (tildes)
}

function checkGuess() {
    const guess = normalizeString(document.getElementById('guessInput').value.trim());
    let correctAnswer = '';
    let isCorrect = false;

    // Validar que el usuario ingresó una respuesta
    if (!guess) {
        updateGameStatus('Escribe una respuesta antes de enviar.', 'error');
        return;
    }

    if (gameConfig.category === 'song') {
        correctAnswer = normalizeString(currentTrack.name);
        isCorrect = guess.length > 0 && (guess === correctAnswer || 
            correctAnswer.includes(guess) || 
            guess.includes(correctAnswer));
 
    } else {
        correctAnswer = normalizeString(currentTrack.artists[0].name);
        isCorrect = guess.length > 0 && (guess === correctAnswer || 
            correctAnswer.includes(guess) || 
            guess.includes(correctAnswer));
 
    }
    
    clearInterval(timerInterval);
    endRound(isCorrect);
    guessInput.value = '';
}



function endRound(isCorrect) {
    const guessInputShow = document.getElementById('guessInput').value.trim();
    document.getElementById('guessInput').disabled = true;
    document.getElementById('submitGuess').disabled = true;
    
    if (isCorrect) {
        gameConfig.players[gameConfig.currentPlayer].score += 1;
        updateGameStatus('¡Correcto! 🎉', 'correct');
    } else {
        const correctAnswer = gameConfig.category === 'song' ? 
            currentTrack.name : currentTrack.artists[0].name;
        updateGameStatus(`¡Incorrecto! no era: ${guessInputShow}, era: ${correctAnswer}`, 'incorrect');
    }

    updateScores();
    displaySongInfo();

    // Preparar siguiente ronda o finalizar juego
    setTimeout(() => {
        if (gameConfig.mode === 'multi') {
            if (gameConfig.currentPlayer === 'player1' && !isCorrect) {
                // Si el jugador 1 falló, le toca al jugador 2
                gameConfig.currentPlayer = 'player2';
                updateCurrentPlayer();
                newGame();
            } else {
                nextRound();
            }
        } else {
            nextRound();
        }
    }, 5000);
}

function nextRound() {
    if (gameConfig.mode === 'multi') {
        // Cambiar jugador
        gameConfig.currentPlayer = (gameConfig.currentPlayer === 'player1') ? 'player2' : 'player1';
        
        // Solo incrementar la ronda cuando vuelve al primer jugador
        if (gameConfig.currentPlayer === 'player1') {
            gameConfig.currentRound++;
        }
    } else {
        // Modo un jugador - simplemente incrementar la ronda
        gameConfig.currentRound++;
    }

    // Verificar si el juego debe finalizar
    if (gameConfig.currentRound > gameConfig.rounds) {
        showFinalResults();
    } else {
        document.getElementById('currentRound').textContent = gameConfig.currentRound;
        updateCurrentPlayer();
        newGame();
    }
    document.getElementById('guessInput').clear()
}


function updateScores() {
    document.getElementById('player1Score').innerHTML = 
        `${gameConfig.players.player1.name}: <span>${gameConfig.players.player1.score}</span>`;
    if (gameConfig.mode === 'multi') {
        document.getElementById('player2Score').innerHTML = 
            `${gameConfig.players.player2.name}: <span>${gameConfig.players.player2.score}</span>`;
    }
}

function updateCurrentPlayer() { 
    const currentPlayerElement = document.getElementById("currentPlayer");
    
    // Crear el nuevo h2 con la clase 'current-player'
    const playerNameElement = document.createElement("h2");
    playerNameElement.classList.add("current-player");  // Asignar la clase 'current-player'
    playerNameElement.textContent = gameConfig.players[gameConfig.currentPlayer].name;
    
    // Limpiar el contenido anterior (si hay alguno) antes de agregar el nuevo
    currentPlayerElement.innerHTML = ''; // Limpiar el contenido actual
    
    // Insertar el nuevo h2 al contenedor
    currentPlayerElement.appendChild(playerNameElement);
    
    // También se puede mostrar el texto adicional (por ejemplo, "Turno de: ")
    const turnTextElement = document.createElement("span");
    turnTextElement.textContent = `Turno de: `;
    currentPlayerElement.prepend(turnTextElement);
}


function showFinalResults() {
    document.getElementById("gameArea").style.display = "none";
    const finalResults = document.getElementById("finalResults");
    finalResults.style.display = "block";

    let resultsHTML = `<h3>La puntuación es de:</h3><h2 class="final-score-player">${gameConfig.players.player1.name}</h2><h2 class="final-score-number"> ${gameConfig.players.player1.score} / ${gameConfig.rounds} </h2>`;

    if (gameConfig.mode === "multi") {
        resultsHTML += `<h2 class="final-score-player">${gameConfig.players.player2.name}:</h2><h2 class="final-score-number">${gameConfig.players.player2.score} / ${gameConfig.rounds} </h2>`;
        const winner =
            gameConfig.players.player1.score > gameConfig.players.player2.score
                ? gameConfig.players.player1.name
                : gameConfig.players.player1.score <
                  gameConfig.players.player2.score
                ? gameConfig.players.player2.name
                : "Empate";
        resultsHTML += `<h4>El ganador es : </h4><h2 class="final-score-winner">${winner}</h2>`;
    }

    // Agregar botón de "Volver a Jugar"
    resultsHTML += `
        <button id="playAgainButton" class="btn btn-primary">Volver a Jugar</button>
    `;

    finalResults.innerHTML = resultsHTML;

    // Agregar listener al botón de "Volver a Jugar"
    document.getElementById("playAgainButton").addEventListener("click", () => {
        resetGame(); // Volver a la configuración inicial del juego
    });
}
    
    function updateGameStatus(message, status) {
        const gameStatus = document.getElementById('gameStatus');
        gameStatus.textContent = message;
        gameStatus.className = `game-status ${status}`;
    }
    
    function displaySongInfo() {
        const songInfo = document.getElementById('songInfo');
        songInfo.innerHTML = `
            <p><strong>Canción:</strong> ${currentTrack.name}</p>
            <p><strong>Artista:</strong> ${currentTrack.artists[0].name}</p>
        `;
        document.getElementById('answerContainer').style.display = 'block';
    }
    
// Función para extraer el ID de la playlist
function extractPlaylistId(input) {
    // Si el input está vacío, retornar el ID por defecto
    if (!input) return "2TieOXUFdPe8OrB8WYgKJy";

    // Si es una URL de Spotify
    if (input.includes('spotify.com/playlist/')) {
        // Extraer el ID después de /playlist/
        const match = input.match(/playlist\/([a-zA-Z0-9]+)/);
        if (match) {
            // Remover cualquier parámetro adicional después del ID
            return match[1].split('?')[0];
        }
    }
    
    // Si no es una URL, asumimos que es un ID directo
    return input.split('?')[0]; // Remover cualquier parámetro adicional
}

async function newGame() {
    resetGameUI();  // Llamada a una función que resetee la UI del juego
    updateGameStatus('Cargando nueva canción...');

    const selectionType = document.getElementById('selectionType').value;

    if (selectionType === "playlist") {
        const playlistInput = document.getElementById("playlistIdInput").value.trim();
        playlistId = extractPlaylistId(playlistInput) || playlistId;
        currentTrack = await getRandomTrack();
    } else {
        const artistName = document.getElementById('artistNameInput').value.trim();
        
        // Llamar a resetArtistTracks para limpiar canciones de un artista previo
        resetArtistTracks();
        
        const artistTracks = await getTracksByArtist(artistName);
        
        if (!artistTracks || artistTracks.length === 0) {
            updateGameStatus('No se encontraron canciones para el artista', 'error');
            return;
        }

        // Filtrar canciones ya usadas
        const availableTracks = artistTracks.filter(track => !gameConfig.usedTracks.has(track.id));
        if (availableTracks.length === 0) {
            updateGameStatus('¡No hay más canciones disponibles!', 'error');
            return;
        }

        currentTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
        gameConfig.usedTracks.add(currentTrack.id);
    }

    if (!currentTrack) {
        return;
    }

    updatePlayer(currentTrack.id);
    document.getElementById('guessInput').disabled = false;
    document.getElementById('submitGuess').disabled = false;
    startTimer();
    updateGameStatus('¡Escucha y adivina!');
}


function resetArtistTracks() {
    allTracks = [];  // Limpiar las canciones almacenadas
}

        
    function startTimer() {
        const timer = document.getElementById('timer');
        let timeLeft = 25;
        timer.textContent = timeLeft;
    
        timerInterval = setInterval(() => {
            timeLeft--;
            timer.textContent = timeLeft;
    
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                endRound(false);
            }
        }, 1000);
    }
    
    function resetGameUI() {
        document.getElementById('answerContainer').style.display = 'none';
        document.getElementById('songInfo').innerHTML = '';
    }
    
    function resetGame() {
        document.getElementById('gameConfig').style.display = 'block';
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('finalResults').style.display = 'none';
    }
    
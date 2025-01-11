let accessToken = "";
let currentTrack = null;
let timerInterval = null;
let player = null;
let playlistId = "2TieOXUFdPe8OrB8WYgKJy?si=5iJTAhqeQYWRAJj2HZf3kA";
let allTracks = []; // Variable global para almacenar todas las canciones

// Variables para el nuevo sistema de juego
let gameConfig = {
    mode: "single",
    rounds: 5,
    category: "song",
    currentRound: 1,
    usedTracks: new Set(),
    players: {
        player1: { name: "Jugador 1", score: 0, correctAnswers: 0 },
        player2: { name: "Jugador 2", score: 0, correctAnswers: 0 },
    },
    currentPlayer: "player1",
};
document
    .getElementById("selectionType")
    .addEventListener("change", function (e) {
        if (e.target.value === "artist") {
            document.getElementById("playlistSelection").style.display = "none";
            document.getElementById("artistSelection").style.display = "block";
        } else {
            document.getElementById("playlistSelection").style.display =
                "block";
            document.getElementById("artistSelection").style.display = "none";
        }
    });
const artistTracksCache = {}; // Caché para almacenar canciones por artista y dificultad

async function getTracksByArtist(artistName) {
    if (!accessToken) {
        accessToken = await getAccessToken();
    }

    // Obtener el nivel de dificultad
    const difficulty = document.getElementById("difficultySelect").value;

    // Verificar si ya tenemos canciones en caché para este artista y dificultad
    if (artistTracksCache[artistName]?.[difficulty]) {
        return artistTracksCache[artistName][difficulty];
    }

    try {
        // Buscar el artista
        const searchResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(
                artistName
            )}&type=artist`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );
        const searchData = await searchResponse.json();
        const artistId = searchData.artists.items[0]?.id;

        if (!artistId) {
            updateGameStatus("No se encontró el artista", "error");
            return null;
        }

        let tracks = [];

        if (difficulty === "normal") {
            // Obtener las canciones más populares (top 10)
            const topTracksResponse = await fetch(
                `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            );
            const topTracksData = await topTracksResponse.json();
            tracks = topTracksData.tracks.slice(0, 10); // Solo tomar las primeras 10 canciones
        } else {
            // Obtener todas las canciones del artista (modo extremo)
            const albumsResponse = await fetch(
                `https://api.spotify.com/v1/artists/${artistId}/albums?market=US&include_groups=album,single&limit=50`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            );
            const albumsData = await albumsResponse.json();

            // Recorrer los álbumes para obtener las canciones de cada uno
            for (let album of albumsData.items) {
                const albumTracksResponse = await fetch(
                    `https://api.spotify.com/v1/albums/${album.id}/tracks`,
                    {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }
                );
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
        console.error("Error al obtener las canciones del artista:", error);
        updateGameStatus("Error al obtener las canciones del artista", "error");
        return null;
    }
}

// Función para inicializar el juego
function initializeGame() {
    const guessTheSong = document.getElementById("guessTheArtist");
    if (guessTheSong.textContent === "Adivina el Artista") {
        document.getElementById("subtitle").textContent = "GUESS THE ARTIST";
    }

    const roundsInput = document.getElementById("roundsNumber").value;
    const rounds = parseInt(roundsInput);

    if (isNaN(rounds) || rounds <= 0) {
        updateGameStatus(
            "Por favor, introduce un número válido de rondas.",
            "error"
        );
        return;
    }

    gameConfig.mode = document.getElementById("gameMode").value;
    gameConfig.rounds = rounds; // Número de rondas establecido por el usuario
    gameConfig.currentRound = 1;
    gameConfig.usedTracks.clear();
    gameConfig.players.player1.score = 0;
    gameConfig.players.player2.score = 0;
    gameConfig.currentPlayer = "player1";
    gameConfig.totalRounds = gameConfig.mode === "multi" ? rounds * 2 : rounds; // Ajuste para multijugador
    gameConfig.category = document.getElementById("gameCategory").value;

    // Configurar nombres de jugadores
    if (gameConfig.mode === "multi") {
        gameConfig.players.player1.name =
            document.getElementById("player1").value || "Jugador 1";
        gameConfig.players.player2.name =
            document.getElementById("player2").value || "Jugador 2";
        document.getElementById("player2Score").style.display = "block";
    } else {
        document.getElementById("player2Score").style.display = "none";
    }

    // Resetear puntuaciones y ronda actual
    gameConfig.currentRound = 1;
    gameConfig.currentTurn = 1; // Turno global
    gameConfig.usedTracks.clear();
    gameConfig.players.player1.score = 0;
    gameConfig.players.player2.score = 0;
    gameConfig.currentPlayer = "player1";

    // Actualizar UI
    document.getElementById("gameConfig").style.display = "none";
    document.getElementById("gameArea").style.display = "block";
    document.getElementById("currentRound").textContent =
        gameConfig.currentRound;
    document.getElementById("totalRounds").textContent = gameConfig.rounds;
    updateScores();
    updateCurrentPlayer();

    // Comenzar primera ronda
    newGame();
}

// Event listener para el modo de juego
document.getElementById("gameMode").addEventListener("change", function (e) {
    document.getElementById("playerNames").style.display =
        e.target.value === "multi" ? "block" : "none";
});

async function getAccessToken() {
    try {
        const response = await fetch("/api/getAccessToken");
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Error al obtener el token:", error);
        return null;
    }
}

// Usarla directamente en getRandomTrack:
async function getRandomTrack() {
    if (!accessToken) {
        accessToken = await getAccessToken(); // Asignar el token aquí
    }

    try {
        const playlistResponse = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );
        const playlist = await playlistResponse.json();

        // Filtrar canciones ya usadas
        const availableTracks = playlist.tracks.items.filter(
            (item) => !gameConfig.usedTracks.has(item.track.id)
        );

        if (availableTracks.length === 0) {
            updateGameStatus("¡No hay más canciones disponibles!", "error");
            return null;
        }

        const randomTrack =
            availableTracks[Math.floor(Math.random() * availableTracks.length)]
                .track;
        gameConfig.usedTracks.add(randomTrack.id);

        return randomTrack;
    } catch (error) {
        updateGameStatus("Error al obtener la canción", "error");
        return null;
    }
}

function updatePlayer(trackId) {
    return new Promise((resolve) => {
        const playerContainer = document.getElementById("playerContainer");
        
        // Crear el iframe
        const iframe = document.createElement('iframe');
        iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`;
        iframe.width = "100%";
        iframe.height = "100px";
        iframe.frameBorder = "0";
        iframe.allow = "clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        iframe.loading = "lazy";
        
        // Agregar el evento de carga
        iframe.onload = () => {
            console.log('Spotify player loaded');
            resolve();
        };
        
        // Limpiar y agregar el nuevo iframe
        playerContainer.innerHTML = '';
        playerContainer.appendChild(iframe);
    });
}
function normalizeString(str) {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Elimina marcas diacríticas (tildes)
}

function checkGuess(isTimeOut = false) {
    const guess = normalizeString(
        document.getElementById("guessInput").value.trim()
    );
    let correctAnswer = "";
    let isCorrect = false;

    // Si es timeout y no hay respuesta, terminamos la ronda directamente
    if (isTimeOut && !guess) {
        clearInterval(timerInterval);
        endRound(false);
        return;
    }

    // Validar que el usuario ingresó una respuesta (solo si no es timeout)
    if (!isTimeOut && !guess) {
        updateGameStatus("Escribe una respuesta antes de enviar.", "error");
        return;
    }

    // Determinar la respuesta correcta según la categoría
    if (gameConfig.category === "song") {
        correctAnswer = normalizeString(currentTrack.name);
    } else {
        correctAnswer = normalizeString(currentTrack.artists[0].name);
    }

    // Comparar con reglas de coincidencia parcial
    const minLength = 3; // Longitud mínima para coincidencias parciales
    isCorrect =
        guess === correctAnswer || // Coincidencia exacta
        (guess.length >= minLength && correctAnswer.includes(guess)) || // Guess incluido en la respuesta
        (correctAnswer.length >= minLength && guess.includes(correctAnswer)); // Respuesta incluida en guess

    clearInterval(timerInterval);
    endRound(isCorrect);
    guessInput.value = "";
}

let timeLeft = 25; // Tiempo inicial del temporizador

function endRound(isCorrect) {
    const guessInputShow = document.getElementById("guessInput").value.trim();
    document.getElementById("guessInput").disabled = true;
    document.getElementById("submitGuess").disabled = true;

    // Calcular los puntos por tiempo restante
    let pointsForTime = 0;
    if (timeLeft > 20) {
        pointsForTime = 200; // Si quedan más de 20 segundos, da 100 puntos extra
    } else if (timeLeft > 10) {
        pointsForTime = 150; // Si quedan entre 10 y 20 segundos, da 75 puntos extra
    } else if (timeLeft > 5) {
        pointsForTime = 100; // Si quedan entre 5 y 10 segundos, da 50 puntos extra
    } else if (timeLeft > 0) {
        pointsForTime = 50; // Si quedan menos de 5 segundos, da 25 puntos extra
    }

    if (isCorrect) {
        gameConfig.players[gameConfig.currentPlayer].score +=
            300 + pointsForTime; // 100 puntos por respuesta correcta + puntos por tiempo
        gameConfig.players[gameConfig.currentPlayer].correctAnswers += 1; // Incrementa los aciertos
        updateGameStatus("¡Correcto! 🎉", "correct");
    } else {
        const correctAnswer =
            gameConfig.category === "song"
                ? currentTrack.name
                : currentTrack.artists[0].name;
        // Restar 50 puntos por respuesta incorrecta
        if (gameConfig.players[gameConfig.currentPlayer].score > 0) {
            gameConfig.players[gameConfig.currentPlayer].score -= 50;
        }
        updateGameStatus(
            `¡Incorrecto! no era: <h2 class="answer-submited">${guessInputShow}</h2> era: <h2 class="answer-submited">${correctAnswer}</h2>`,
            "incorrect"
        );
    }

    updateScores();
    displaySongInfo();

    // Preparar siguiente ronda o finalizar juego
    setTimeout(() => {
        if (gameConfig.mode === "multi") {
            if (gameConfig.currentPlayer === "player1" && !isCorrect) {
                // Si el jugador 1 falló, le toca al jugador 2
                gameConfig.currentPlayer = "player2";
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
    if (gameConfig.mode === "multi") {
        // Cambiar jugador
        gameConfig.currentPlayer =
            gameConfig.currentPlayer === "player1" ? "player2" : "player1";

        // Solo incrementar la ronda cuando vuelve al primer jugador
        if (gameConfig.currentPlayer === "player1") {
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
        document.getElementById("currentRound").textContent =
            gameConfig.currentRound;
        updateCurrentPlayer();
        newGame();
    }
    document.getElementById("guessInput").value = ""; // Limpia el campo de entrada
}

function updateScores() {
    document.getElementById("player1Score").innerHTML = `
        <div class="player-info">
            <span class="player-name">${gameConfig.players.player1.name}</span><span class="separator-1">:</span> <span class="score">${gameConfig.players.player1.score}</span><span class="emoji fire">⭐</span>
        </div>
        <div class="player-stats">
            <span class="correct-answer">${gameConfig.players.player1.correctAnswers}</span><span class="separator-2">/</span><span class="total-rounds">${gameConfig.rounds}</span>
        </div>
    `;

    if (gameConfig.mode === "multi") {
        document.getElementById("player2Score").innerHTML = `
        <div class="player-info">
            <span class="player-name">${gameConfig.players.player2.name}</span><span class="separator-1">: </span><span class="score">${gameConfig.players.player2.score}</span><span class="emoji fire">⭐</span>
        </div>
        <div class="player-stats">
            <span class="correct-answer">${gameConfig.players.player2.correctAnswers}</span><span class="separator-2">/</span><span class="total-rounds">${gameConfig.rounds}</span>
        </div>
    `;
    }
}

function updateCurrentPlayer() {
    const currentPlayerElement = document.getElementById("currentPlayer");

    // Crear el nuevo h2 con la clase 'current-player'
    const playerNameElement = document.createElement("h2");
    playerNameElement.classList.add("current-player"); // Asignar la clase 'current-player'
    playerNameElement.textContent =
        gameConfig.players[gameConfig.currentPlayer].name;

    // Limpiar el contenido anterior (si hay alguno) antes de agregar el nuevo
    currentPlayerElement.innerHTML = ""; // Limpiar el contenido actual

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

    let resultsHTML = "";

    if (gameConfig.mode === "multi") {
        const winner =
            gameConfig.players.player1.score > gameConfig.players.player2.score
                ? gameConfig.players.player1.name
                : gameConfig.players.player1.score <
                  gameConfig.players.player2.score
                ? gameConfig.players.player2.name
                : "Empate";

        // Mensaje del ganador en la parte superior
        resultsHTML += `
            <h2 class="final-score-winner">${winner} 🏆</h2>
        `;
    }

    // Detalles de los jugadores
    resultsHTML += `
        <div class="player-info-final">
            <span class="player-name-final">${gameConfig.players.player1.name}</span>
            <span class="separator-1-final">:</span>
            <span class="score-final">${gameConfig.players.player1.score}</span>
            <span class="emoji-final">⭐</span>
        </div>
        <div class="player-stats-final">
            <span class="correct-answer-final">${gameConfig.players.player1.correctAnswers}</span>
            <span class="separator-2-final">/</span>
            <span class="total-rounds-final">${gameConfig.rounds}</span>
        </div>
    `;

    if (gameConfig.mode === "multi") {
        resultsHTML += `
            <div class="player-info-final">
                <span class="player-name-final">${gameConfig.players.player2.name}</span>
                <span class="separator-1-final">:</span>
                <span class="score-final">${gameConfig.players.player2.score}</span>
                <span class="emoji-final">⭐</span>
            </div>
            <div class="player-stats-final">
                <span class="correct-answer-final">${gameConfig.players.player2.correctAnswers}</span>
                <span class="separator-2-final">/</span>
                <span class="total-rounds-final">${gameConfig.rounds}</span>
            </div>
        `;
    }

    // Botón de "Volver a Jugar"
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
    const gameStatus = document.getElementById("gameStatus");
    gameStatus.innerHTML = message; // Cambiamos textContent a innerHTML
    gameStatus.className = `game-status ${status}`;
}

function displaySongInfo() {
    document.getElementById("playInstruction").style.display = "none";
    const songInfo = document.getElementById("songInfo");
    songInfo.innerHTML = `
            <p><strong>Canción:</strong> ${currentTrack.name}</p>
            <p><strong>Artista:</strong> ${currentTrack.artists[0].name}</p>
        `;
    document.getElementById("answerContainer").style.display = "block";
}

// Función para buscar artistas
async function searchArtists(query) {
    if (!accessToken) {
        accessToken = await getAccessToken();
    }

    try {
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(
                query
            )}&type=artist&limit=5`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.artists.items;
    } catch (error) {
        console.error("Error al buscar artistas:", error);
        updateGameStatus("Error al buscar artistas", "error");
        return [];
    }
}

// Función para mostrar los resultados de la búsqueda de artistas
function displayArtistResults(artists) {
    const resultsContainer = document.getElementById("artistSearchResults");
    resultsContainer.innerHTML = "";

    if (!artists || artists.length === 0) {
        resultsContainer.innerHTML =
            "<div class='artist-result'>No se encontraron artistas</div>";
        return;
    }

    artists.forEach((artist) => {
        if (!artist) return;

        const artistElement = document.createElement("div");
        artistElement.className = "artist-result";

        // Obtener la imagen del artista o usar un placeholder
        const imageUrl =
            artist.images && artist.images.length > 0
                ? artist.images[0].url
                : "https://placehold.co/60x60?text=No+Image";

        // Obtener el número de seguidores formateado
        const followers = artist.followers?.total
            ? new Intl.NumberFormat().format(artist.followers.total)
            : "0";

        artistElement.innerHTML = `
            <div class="artist-item">
                <img src="${imageUrl}" alt="${
            artist.name
        }" class="artist-thumbnail">
                <div class="artist-info">
                    <h4>${artist.name}</h4>
                    <p>${followers} seguidores</p>
                    <p>Popularidad: ${artist.popularity || 0}%</p>
                </div>
            </div>
        `;

        if (artist.name) {
            artistElement.addEventListener("click", () => {
                document.getElementById("artistNameInput").value = artist.name;
                resultsContainer.innerHTML = ""; // Limpiar resultados
            });
        }

        resultsContainer.appendChild(artistElement);
    });
}

// Función para inicializar la búsqueda de artistas
function initializeArtistSearch() {
    const artistInput = document.getElementById("artistNameInput");
    if (!artistInput) {
        console.error("No se encontró el elemento artistNameInput");
        return;
    }

    artistInput.insertAdjacentHTML(
        "afterend",
        `
        <div id="artistSearchContainer">
            <div id="artistSearchResults" class="artist-results-container"></div>
        </div>
    `
    );

    // Configurar el evento de búsqueda con debounce
    let timeout;
    artistInput.addEventListener("input", (e) => {
        clearTimeout(timeout);
        const query = e.target.value.trim();

        if (query.length < 3) {
            document.getElementById("artistSearchResults").innerHTML = "";
            return;
        }

        timeout = setTimeout(async () => {
            const artists = await searchArtists(query);
            displayArtistResults(artists);
        }, 500);
    });
}

// Llamar a la inicialización cuando se cargue la página
document.addEventListener("DOMContentLoaded", () => {
    initializeArtistSearch();
});

// Función para extraer el ID de la playlist
function extractPlaylistId(input) {
    // Si el input está vacío, retornar el ID por defecto
    if (!input) return "2TieOXUFdPe8OrB8WYgKJy";

    // Si es una URL de Spotify
    if (input.includes("spotify.com/playlist/")) {
        // Extraer el ID después de /playlist/
        const match = input.match(/playlist\/([a-zA-Z0-9]+)/);
        if (match) {
            // Remover cualquier parámetro adicional después del ID
            return match[1].split("?")[0];
        }
    }

    // Si no es una URL, asumimos que es un ID directo
    return input.split("?")[0]; // Remover cualquier parámetro adicional
}

// Función para mostrar los resultados de la búsqueda con manejo de datos faltantes
function displayPlaylistResults(playlists) {
    const resultsContainer = document.getElementById("playlistSearchResults");
    resultsContainer.innerHTML = "";

    if (!playlists || playlists.length === 0) {
        resultsContainer.innerHTML =
            "<div class='playlist-result'>No se encontraron playlists</div>";
        return;
    }

    playlists.forEach((playlist) => {
        // Verificar que playlist es un objeto válido
        if (!playlist) return;

        const playlistElement = document.createElement("div");
        playlistElement.className = "playlist-result";

        // Manejar caso donde no hay imágenes o datos faltantes
        const imageUrl =
            playlist.images && playlist.images.length > 0
                ? playlist.images[0].url
                : "https://placehold.co/60x60?text=No+Image";

        // Manejar otros datos potencialmente faltantes
        const playlistName = playlist.name || "Sin nombre";
        const ownerName = playlist.owner?.display_name || "Usuario desconocido";
        const trackCount = playlist.tracks?.total || 0;

        playlistElement.innerHTML = `
            <div class="playlist-item">
                <img src="${imageUrl}" alt="${playlistName}" class="playlist-thumbnail">
                <div class="playlist-info">
                    <h4>${playlistName}</h4>
                    <p>Por: ${ownerName}</p>
                    <p>${trackCount} canciones</p>
                </div>
            </div>
        `;

        // Solo añadir el evento click si tenemos un ID válido
        if (playlist.id) {
            playlistElement.addEventListener("click", () => {
                document.getElementById("playlistIdInput").value = playlist.id;
                resultsContainer.innerHTML = ""; // Limpiar resultados después de seleccionar
                // También podríamos ocultar el contenedor de búsqueda aquí
            });
        }

        resultsContainer.appendChild(playlistElement);
    });
}

// Función para buscar playlists con mejor manejo de errores
async function searchPlaylists(query) {
    if (!accessToken) {
        try {
            accessToken = await getAccessToken();
        } catch (error) {
            console.error("Error al obtener el token:", error);
            updateGameStatus("Error al conectar con Spotify", "error");
            return [];
        }
    }

    try {
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(
                query
            )}&type=playlist&limit=5`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Verificar que tenemos los datos que esperamos
        if (!data.playlists || !data.playlists.items) {
            console.error("Formato de respuesta inesperado:", data);
            return [];
        }

        return data.playlists.items;
    } catch (error) {
        console.error("Error al buscar playlists:", error);
        updateGameStatus("Error al buscar playlists", "error");
        return [];
    }
}

function initializePlaylistSearch() {
    // Insertar el HTML de búsqueda después del input de playlist existente
    const playlistInput = document.getElementById("playlistIdInput");
    if (!playlistInput) {
        console.error("No se encontró el elemento playlistIdInput");
        return;
    }

    playlistInput.insertAdjacentHTML(
        "afterend",
        `
        <div id="playlistSearchContainer">
            <input 
                type="text" 
                id="playlistSearchInput" 
                class="form-control" 
                placeholder="Buscar playlist (ej: top 100 rock)"
            >
            <div id="playlistSearchResults" class="playlist-results-container"></div>
        </div>
    `
    );

    // Configurar el evento de búsqueda con debounce
    let timeout;
    const searchInput = document.getElementById("playlistSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            clearTimeout(timeout);
            const query = e.target.value.trim();

            if (query.length < 3) {
                document.getElementById("playlistSearchResults").innerHTML = "";
                return;
            }

            timeout = setTimeout(async () => {
                const playlists = await searchPlaylists(query);
                displayPlaylistResults(playlists);
            }, 500);
        });
    }
}

// Llamar a esta función cuando se cargue la página
document.addEventListener("DOMContentLoaded", initializePlaylistSearch);

async function newGame() {
    resetGameUI();
    updateGameStatus("Cargando nueva canción...");

    // Deshabilitar controles durante la carga
    document.getElementById("guessInput").disabled = true;
    document.getElementById("submitGuess").disabled = true;

    const selectionType = document.getElementById("selectionType").value;

    try {
        if (selectionType === "playlist") {
            const playlistInput = document
                .getElementById("playlistIdInput")
                .value.trim();
            playlistId = extractPlaylistId(playlistInput) || playlistId;
            currentTrack = await getRandomTrack();
        } else {
            const artistName = document
                .getElementById("artistNameInput")
                .value.trim();

            // Llamar a resetArtistTracks para limpiar canciones de un artista previo
            resetArtistTracks();

            const artistTracks = await getTracksByArtist(artistName);

            if (!artistTracks || artistTracks.length === 0) {
                updateGameStatus(
                    "No se encontraron canciones para el artista",
                    "error"
                );
                return;
            }

            // Filtrar canciones ya usadas
            const availableTracks = artistTracks.filter(
                (track) => !gameConfig.usedTracks.has(track.id)
            );
            if (availableTracks.length === 0) {
                updateGameStatus("¡No hay más canciones disponibles!", "error");
                return;
            }

            currentTrack =
                availableTracks[Math.floor(Math.random() * availableTracks.length)];
            gameConfig.usedTracks.add(currentTrack.id);
        }

        if (!currentTrack) {
            return;
        }

        // Esperar a que el reproductor se cargue completamente
        await updatePlayer(currentTrack.id);
        
        // Una vez cargado el reproductor, habilitar controles e iniciar el timer
        document.getElementById("guessInput").disabled = false;
        document.getElementById("submitGuess").disabled = false;
        document.getElementById("guessInput").focus();
        
        startTimer();
        updateGameStatus("¡Escucha y adivina!");
    } catch (error) {
        console.error("Error en newGame:", error);
        updateGameStatus("Error al cargar la canción", "error");
        // Asegurar que los controles estén habilitados en caso de error
        document.getElementById("guessInput").disabled = false;
        document.getElementById("submitGuess").disabled = false;
    }
}

function resetArtistTracks() {
    allTracks = []; // Limpiar las canciones almacenadas
}

// Actualizar la función de startTimer (mantener la versión modificada anterior)
function startTimer() {
    const timer = document.getElementById("timer");
    timeLeft = 25;
    timer.textContent = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        timer.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            checkGuess(true);
        }
    }, 1000);
}

function resetGameUI() {
    document.getElementById("answerContainer").style.display = "none";
    document.getElementById("playInstruction").style.display = "flex";
    document.getElementById("songInfo").innerHTML = "";
}

function resetGame() {
    document.getElementById("gameConfig").style.display = "block";
    document.getElementById("gameArea").style.display = "none";
    document.getElementById("finalResults").style.display = "none";
}

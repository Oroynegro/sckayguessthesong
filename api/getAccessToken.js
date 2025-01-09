// api/getAccessToken.js
export default async function handler(req, res) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${encodedCredentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        const data = await response.json();
        res.status(200).json({ access_token: data.access_token });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el token de Spotify' });
    }
}

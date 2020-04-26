const scopes = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-read-currently-playing',
    'user-modify-playback-state',
];

const SCOPE = scopes.join(' ');

const API_BASE_URL = 'https://api.spotify.com/v1';

exports.SCOPE = SCOPE;
exports.API_BASE_URL = API_BASE_URL;

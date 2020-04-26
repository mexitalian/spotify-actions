/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

require('dotenv').config();
const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const Sequelize = require('sequelize');

const { generateRandomString } = require('./utils');
const { SCOPE, API_BASE_URL } = require('./const');

const {
  CLIENT_ID: client_id,
  CLIENT_SECRET: client_secret,
  REDIRECT_URI: redirect_uri,
  PORT: port=8000,
  DB_HOST,
  DB_NAME,
  DB_USER,
  DB_PASS,
} = process.env;
const stateKey = 'spotify_auth_state';

const app = express();
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  dialect: 'mysql',
});

class User extends Sequelize.Model {}
User.init({
  // attributes
  spotifyId: {
    type: Sequelize.STRING,
    allowNull: false
  },
  accessToken: {
    type: Sequelize.STRING,
  },
  refreshToken: {
    type: Sequelize.STRING,
  }
}, {
  sequelize,
  modelName: 'user'
});
User.sync();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id,
      scope: SCOPE,
      redirect_uri,
      state
    }));
});


app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter
  const { code = null, state = null } = req.query;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': `Basic ${new Buffer(`${client_id}:${client_secret}`).toString('base64')}`
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        const { access_token, refresh_token } = body;
        const options = {
          url: `${API_BASE_URL}/me`,
          headers: { 'Authorization': `Bearer ${access_token}` },
          json: true
        };

        // use the access token to access the Spotify Web API
        // TODO can all of this be done from the original response body
        request.get(options, function(error, response, body) {
          const user = User.build({
            spotifyId: body.id,
            accessToken: access_token,
            refreshToken: refresh_token,
          });
          user.save();
          console.log(body);
        });



        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

app.listen(port);
console.log('Listening:' + port);

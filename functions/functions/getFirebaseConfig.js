const functions = require('firebase-functions');
require('dotenv').config();

// Função para fornecer o firebaseConfig
const getFirebaseConfig = functions.https.onRequest((request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  response.set('Access-Control-Max-Age', '3600');

  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  if (request.method !== 'GET') {
    response.status(405).send('Method Not Allowed: Use GET');
    return;
  }

  const firebaseConfig = {
    apiKey: process.env.APP_API_KEY,
    authDomain: process.env.APP_AUTH_DOMAIN,
    projectId: process.env.APP_PROJECT_ID,
    storageBucket: process.env.APP_STORAGE_BUCKET,
    messagingSenderId: process.env.APP_MESSAGING_SENDER_ID,
    appId: process.env.APP_APP_ID,
    measurementId: process.env.APP_MEASUREMENT_ID
  };

  response.status(200).json(firebaseConfig);
});

module.exports = getFirebaseConfig;
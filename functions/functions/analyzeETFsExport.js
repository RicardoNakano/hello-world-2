const functions = require('firebase-functions');
const analyzeETFs = require('./analyzeETFs');

// Função para chamar a análise de ETFs (mantida como endpoint pra testes diretos)
const analyzeETFsExport = functions.https.onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  response.set('Access-Control-Max-Age', '3600');

  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).send('Method Not Allowed: Use POST');
    return;
  }

  const result = await analyzeETFs();

  if (result.success) {
    response.status(200).send({
      success: true,
      message: 'Analysis retrieved successfully',
      analysis: result.tweetText
    });
  } else {
    response.status(500).send({
      success: false,
      message: result.message
    });
  }
});

module.exports = analyzeETFsExport;
const functions = require('firebase-functions');
const { TwitterApi } = require('twitter-api-v2');
const analyzeETFs = require('./analyzeETFs');
require('dotenv').config();

// Configurar cliente do Twitter com as credenciais do .env
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Função para postar no Twitter (manual via UI)
const postTweet = functions.https.onRequest(async (request, response) => {
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

  try {
    // Chamar a função analyzeETFs pra obter a análise
    const etfAnalysis = await analyzeETFs();

    if (!etfAnalysis.success) {
      throw new Error(etfAnalysis.message);
    }

    const tweetText = etfAnalysis.tweetText;
    console.log('Tweet text to be posted:', tweetText); // Log do texto do tweet

    // Postar no Twitter
    const tweet = await twitterClient.v2.tweet(tweetText);

    response.status(200).send({
      success: true,
      message: 'Tweet posted successfully',
      tweetId: tweet.data.id,
      tweetText: tweetText // Retornar o texto postado pra exibir na UI
    });
  } catch (error) {
    console.error('Error posting tweet:', error);
    response.status(500).send({
      success: false,
      message: 'Error posting tweet: ' + error.message,
      errorDetails: error // Incluir detalhes do erro pra depuração
    });
  }
});

module.exports = postTweet;
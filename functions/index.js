const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { TwitterApi } = require('twitter-api-v2');
const yahooFinance = require('yahoo-finance2').default;
const axios = require('axios');
require('dotenv').config();

// Configurar o firebase-admin
const adminConfig = {
  credential: admin.credential.applicationDefault(),
  projectId: process.env.APP_PROJECT_ID
};

admin.initializeApp(adminConfig);

// Configurar o Auth Emulator no ambiente local
if (process.env.FUNCTIONS_EMULATOR) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

// Configurar cliente do Twitter com as credenciais do .env
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Função helloWorld
exports.helloWorld = functions.https.onRequest((request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.set('Access-Control-Max-Age', '3600');

  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  const authHeader = request.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    response.status(401).send('Unauthorized: Missing or invalid token');
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  admin.auth().verifyIdToken(idToken)
    .then((decodedToken) => {
      response.send(`Hello World! Bem-vindo, ${decodedToken.name || 'usuário'}!`);
    })
    .catch((error) => {
      response.status(401).send('Unauthorized: ' + error.message);
    });
});

// Função para fornecer o firebaseConfig
exports.getFirebaseConfig = functions.https.onRequest((request, response) => {
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

// Função para analisar ETFs (função interna, não exposta como endpoint)
const analyzeETFs = async () => {
  try {
    // Lista de ETFs
    const etfs = ['QYLD', 'JEPQ', 'JEPI', 'SCHD'];

    // --- Dados atuais (hoje) ---
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Ex.: 2025-05-24
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const formattedToday = dateFormatter.format(today); // Ex.: May 24, 2025

    const currentData = [];
    for (const symbol of etfs) {
      // Buscar o preço atual (ou último preço disponível se o mercado estiver fechado)
      const quote = await yahooFinance.quote(symbol);
      const currentPrice = quote.regularMarketPrice;

      // Buscar dados históricos pra calcular o 200-DMA atual (últimos 300 dias pra garantir 200 dias úteis)
      const endDate = new Date(todayStr);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 300); // Pegar 300 dias pra garantir 200 dias úteis

      const historicalForSmaCurrent = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: todayStr,
        interval: '1d'
      });

      if (historicalForSmaCurrent.length < 200) {
        throw new Error(`Not enough data to calculate current 200-DMA for ${symbol}`);
      }

      // Calcular o 200-DMA atual
      const last200DaysCurrent = historicalForSmaCurrent.slice(-200);
      const sma200Current = last200DaysCurrent.reduce((sum, day) => sum + day.close, 0) / 200;

      // Calcular a diferença percentual
      const percentageDiffCurrent = ((currentPrice - sma200Current) / sma200Current) * 100;

      // Formatar o resultado
      const iconCurrent = percentageDiffCurrent < 0 ? '✔' : '✘';
      const formattedDiffCurrent = percentageDiffCurrent >= 0 ? `+${percentageDiffCurrent.toFixed(2)}%` : `${percentageDiffCurrent.toFixed(2)}%`;
      const formattedPriceCurrent = currentPrice.toFixed(2);
      const formattedSma200Current = sma200Current.toFixed(2);

      currentData.push(`${iconCurrent} - ${symbol} - ${formattedDiffCurrent} - $${formattedPriceCurrent} (MA200=$${formattedSma200Current})`);
    }

    // --- Dados de duas segundas-feiras atrás ---
    const dayOfWeek = today.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    // Voltar até a última segunda-feira
    const daysSinceLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - daysSinceLastMonday);
    // Voltar mais 7 dias pra chegar à segunda segunda-feira atrás
    const targetDate = new Date(lastMonday);
    targetDate.setDate(lastMonday.getDate() - 7);
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setDate(targetDate.getDate() + 1); // Dia seguinte pra criar um intervalo

    // Formatar as datas no formato YYYY-MM-DD
    const targetDateStr = targetDate.toISOString().split('T')[0]; // Ex.: 2025-05-12
    const targetDateEndStr = targetDateEnd.toISOString().split('T')[0]; // Ex.: 2025-05-13

    // Formatar a data pro título do post
    const formattedDate = dateFormatter.format(targetDate); // Ex.: May 12, 2025

    // Buscar dados financeiros usando Yahoo Finance
    const etfData = [];
    for (const symbol of etfs) {
      // Buscar preços históricos do dia alvo
      const historicalData = await yahooFinance.historical(symbol, {
        period1: targetDateStr,
        period2: targetDateEndStr,
        interval: '1d'
      });

      if (!historicalData || historicalData.length === 0) {
        throw new Error(`No data found for ${symbol} on ${targetDateStr}`);
      }

      // Obter o preço mais baixo do dia
      const lowestPrice = historicalData[0].low;

      // Buscar dados históricos pra calcular o 200-DMA (últimos 300 dias pra garantir 200 dias úteis)
      const endDate = new Date(targetDateStr);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 300); // Pegar 300 dias pra garantir 200 dias úteis

      const historicalForSma = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: targetDateStr,
        interval: '1d'
      });

      if (historicalForSma.length < 200) {
        throw new Error(`Not enough data to calculate 200-DMA for ${symbol}`);
      }

      // Calcular o 200-DMA
      const last200Days = historicalForSma.slice(-200);
      const sma200 = last200Days.reduce((sum, day) => sum + day.close, 0) / 200;

      // Calcular a diferença percentual
      const percentageDiff = ((lowestPrice - sma200) / sma200) * 100;

      // Formatar o resultado
      const icon = percentageDiff < 0 ? '✔' : '✘';
      const formattedDiff = percentageDiff >= 0 ? `+${percentageDiff.toFixed(2)}%` : `${percentageDiff.toFixed(2)}%`;
      const formattedPrice = lowestPrice.toFixed(2);
      const formattedSma200 = sma200.toFixed(2);

      etfData.push(`${icon} - ${symbol} - ${formattedDiff} - $${formattedPrice} (MA200=$${formattedSma200})`);
    }

    // Construir o tweet com as duas seções
    const currentSection = `ETF Analysis today (${formattedToday}):\n${currentData.join('\n')}\n\n`;
    const historicalSection = `ETF Analysis (Two Mondays Ago - ${formattedDate})\nLowest Prices:\n${etfData.join('\n')}`;
    const tweetText = `${currentSection}${historicalSection}`;

    return { success: true, tweetText };
  } catch (error) {
    console.error('Error fetching financial data in analyzeETFs:', error);
    return { success: false, message: 'Error fetching financial data: ' + error.message };
  }
};

// Função para postar no Twitter (manual via UI)
exports.postTweet = functions.https.onRequest(async (request, response) => {
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
      message: 'Error posting tweet: ' + error.message
    });
  }
});

// Função para chamar a análise de ETFs (mantida como endpoint pra testes diretos)
exports.analyzeETFs = functions.https.onRequest(async (request, response) => {
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

// Função para gerar posts virais no LinkedIn
exports.generateLinkedInPost = functions.https.onRequest(async (request, response) => {
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
    // Calcular o intervalo de datas (últimos 5 dias)
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 5); // 5 dias atrás
    const startDateStr = startDate.toISOString().split('T')[0]; // Ex.: 2025-05-20
    const endDateStr = endDate.toISOString().split('T')[0]; // Ex.: 2025-05-24

    // Configurar a query pro DeepSearch
    const query = "Based on viral LinkedIn posts in English from the last 5 days, write a new viral post in English following the most effective structure, without any additional explanations. The post must have around 1200 caracters and include emojis, line breaks, bullets, actionable tips, and a call to action. Do not use double asterisks (**) for bold formatting.";

    const url = 'https://api.x.ai/v1/chat/completions';
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.XAI_API_KEY}`
    };
    const payload = {
      messages: [
        {
          role: 'user',
          content: query
        }
      ],
      search_parameters: {
        mode: "on",
        from_date: startDateStr, // Ex.: 2025-05-20
        to_date: endDateStr, // Ex.: 2025-05-24
        sources: [
          { type: "web" }
        ]
      },
      model: 'grok-3-mini',
      max_tokens: 1000,
      temperature: 0.7
    };

    const grokResponse = await axios.post(url, payload, { headers });

    const postContent = grokResponse.data.choices[0].message.content;

    response.status(200).send({
      success: true,
      message: 'LinkedIn post generated successfully',
      postContent: postContent
    });
  } catch (error) {
    console.error('Error generating LinkedIn post:', error);
    response.status(500).send({
      success: false,
      message: 'Error generating LinkedIn post: ' + error.message
    });
  }
});

// Função para gerar uma imagem ilustrativa para o post do LinkedIn
exports.generateLinkedInPostImage = functions.https.onRequest(async (request, response) => {
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
    // Receber o texto do post do corpo da requisição
    const postContent = request.body.postContent;

    console.log('Received postContent:', postContent); // Log pra verificar o postContent

    if (!postContent || typeof postContent !== 'string' || postContent.trim() === '') {
      throw new Error('Post content is missing, invalid, or empty');
    }

    // Truncar o postContent pra reduzir o tamanho do prompt enviado ao chat/completions
    const truncatedPostContent = postContent.length > 200 ? postContent.slice(0, 197) + '...' : postContent;

    // Passo 1: Gerar um prompt resumido com menos de 100 caracteres
    const summaryQuery = `Generate a short image prompt (under 1024 chars) for this LinkedIn post, featuring a Nordic woman with a slight smile performing an action (subject, verb, predicate): "${truncatedPostContent}"`;

    const summaryUrl = 'https://api.x.ai/v1/chat/completions';
    const summaryHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.XAI_API_KEY}`
    };
    const summaryPayload = {
      messages: [
        {
          role: 'user',
          content: summaryQuery
        }
      ],
      model: 'grok-3', // Usar o mesmo modelo que gerou o post
      max_tokens: 1024, // Reduzir pra garantir resposta curta
      temperature: 0.7 // Reduzir criatividade pra evitar respostas inesperadas
    };

    const summaryResponse = await axios.post(summaryUrl, summaryPayload, { headers: summaryHeaders });
    console.log('Raw summary response:', summaryResponse.data); // Log da resposta bruta

    let imagePrompt = summaryResponse.data.choices && summaryResponse.data.choices[0] && summaryResponse.data.choices[0].message && summaryResponse.data.choices[0].message.content
      ? summaryResponse.data.choices[0].message.content.trim()
      : '';

    console.log('Generated image prompt:', imagePrompt); // Log do prompt resumido

    if (!imagePrompt) {
      console.warn('Image prompt generation failed, using fallback prompt');
      // Fallback: Criar um prompt genérico baseado no postContent
      const firstLine = postContent.split('\n')[0].replace(/[^a-zA-Z\s]/g, '').trim(); // Pegar a primeira linha, remover emojis e caracteres especiais
      const fallbackPrompt = `A Nordic woman with a slight smile shares a LinkedIn post at her desk.`;
      imagePrompt = firstLine.length > 50
        ? fallbackPrompt
        : `A Nordic woman with a slight smile shares: ${firstLine}`;
    }

    if (imagePrompt.length > 1024) {
      imagePrompt = imagePrompt.slice(0, 1021) + '...'; // Truncar pra evitar exceder o limite
    }

    console.log('Final image prompt after fallback:', imagePrompt); // Log do prompt final

    if (!imagePrompt || imagePrompt.trim() === '') {
      throw new Error('Failed to generate or fallback image prompt: Prompt is empty');
    }

    // Passo 2: Usar o prompt resumido pra gerar a imagem
    const url = 'https://api.x.ai/v1/images/generations';
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.XAI_API_KEY}`
    };
    const payload = {
      model: 'grok-2-image-1212',
      prompt: imagePrompt,
      n: 1 // Gera apenas uma imagem
    };

    const grokResponse = await axios.post(url, payload, { headers });

    // A resposta deve conter a imagem (assumindo que retorna um objeto com uma URL ou base64)
    const imageData = grokResponse.data.data[0];
    const imageUrl = imageData.url || `data:image/jpeg;base64,${imageData.b64_json}`; // Suporta URL ou base64

    response.status(200).send({
      success: true,
      message: 'Image generated successfully',
      imageUrl: imageUrl,
      prompt: imagePrompt // Retorna o prompt usado
    });
  } catch (error) {
    console.error('Error generating image for LinkedIn post:', error);
    response.status(500).send({
      success: false,
      message: 'Error generating image: ' + error.message
    });
  }
});
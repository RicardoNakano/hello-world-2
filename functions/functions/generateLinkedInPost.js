const functions = require('firebase-functions');
const axios = require('axios');
require('dotenv').config();

// Função para gerar posts virais no LinkedIn
const generateLinkedInPost = functions.https.onRequest(async (request, response) => {
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
    const query = "Based on viral LinkedIn posts in English from the last 5 days related to IT, AI, improve people performance, a funny sittuation or a very emotional situation, write a new viral post in English following the most effective structure, without any additional explanations. The post must have around 1200 caracters and include emojis, line breaks, bullets, actionable tips, and a call to action. Do not use double asterisks (**) for bold formatting. relate it to the last US news that whent viral in the last 5 days.";

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
      max_tokens: 2000,
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

module.exports = generateLinkedInPost;
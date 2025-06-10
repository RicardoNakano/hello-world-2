const functions = require('firebase-functions');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

// Função para gerar posts ou artigos virais no LinkedIn
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
    // Calcular o intervalo de datas (últimos 7 dias)
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 7); // 7 dias atrás
    const startDateStr = startDate.toISOString().split('T')[0]; // Ex.: 2025-06-03
    const endDateStr = endDate.toISOString().split('T')[0]; // Ex.: 2025-06-10

    // Consultar posts/artigos recentes no Firestore
    const db = admin.firestore();
    const linkedinPostsRef = db.collection('linkedin_posts');
    const querySnapshot = await linkedinPostsRef
      .where('createdAt', '>=', startDate)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const recentPosts = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      recentPosts.push({
        content: data.content,
        type: data.type,
        articleTitle: data.articleTitle || null,
        createdAt: data.createdAt.toDate().toISOString()
      });
    });

    // Extrair temas dos posts/artigos recentes
    const recentThemes = recentPosts.map(post => {
      const titleOrContent = post.articleTitle || post.content.slice(0, 100);
      return titleOrContent.replace(/[^a-zA-Z\s]/g, '').trim();
    }).join('; ');

    // Configurar a query pro DeepSearch
    const query = `
      Based on viral LinkedIn articles in English from the last 7 days related to IT, AI, improving people performance, a funny situation, or a very emotional situation, write a new viral article in English following the most effective structure, without any additional explanations. The article must have:
      - A compelling title (50-100 characters)
      - A body of around 2000-3000 characters
      - Emojis, line breaks, bullet points, actionable tips, and a call to action
      - No double asterisks (**) for bold formatting
      - Content related to the latest world technology, US macroeconomy (inflation, FED interest rates, or unemployment), or politics news that went viral in the last 7 days
      - Avoid repeating themes from these recent posts: "${recentThemes || 'None'}"
      Format the response as JSON: {"title": "Article Title", "body": "Article Body"}
    `;

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
        from_date: startDateStr, // Ex.: 2025-06-03
        to_date: endDateStr, // Ex.: 2025-06-10
        sources: [
          { type: "web" }
        ]
      },
      model: 'grok-3-mini',
      max_tokens: 4000, // Aumentado para suportar artigos mais longos
      temperature: 0.7
    };

    const grokResponse = await axios.post(url, payload, { headers });
    const responseContent = grokResponse.data.choices[0].message.content;

    // Parsear o conteúdo como JSON
    let postContent;
    try {
      postContent = JSON.parse(responseContent);
      if (!postContent.title || !postContent.body) {
        throw new Error('Invalid response format: missing title or body');
      }
    } catch (error) {
      throw new Error('Failed to parse response as JSON: ' + error.message);
    }

    response.status(200).send({
      success: true,
      message: 'LinkedIn article generated successfully',
      postContent: postContent.body,
      articleTitle: postContent.title
    });
  } catch (error) {
    console.error('Error generating LinkedIn article:', error);
    response.status(500).send({
      success: false,
      message: 'Error generating LinkedIn article: ' + error.message
    });
  }
});

module.exports = generateLinkedInPost;
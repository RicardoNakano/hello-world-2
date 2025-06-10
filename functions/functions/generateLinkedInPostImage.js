const functions = require('firebase-functions');
const axios = require('axios');
require('dotenv').config();

// Função para gerar uma imagem ilustrativa para o post do LinkedIn
const generateLinkedInPostImage = functions.https.onRequest(async (request, response) => {
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
      model: 'grok-3-mini', // Usar o mesmo modelo que gerou o post
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
      const fallbackPrompt = `A very beautiful, sexy, but professional, Nordic woman with a slight smile shares a LinkedIn post at her desk.`;
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

module.exports = generateLinkedInPostImage;
const functions = require('firebase-functions');
const axios = require('axios');
require('dotenv').config();

// Função para publicar o post com imagem no LinkedIn
const publishLinkedInPost = functions.https.onRequest(async (request, response) => {
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
    // Receber o texto do post e a URL da imagem do corpo da requisição
    const { postContent, imageUrl } = request.body;

    console.log('Received postContent:', postContent); // Log pra verificar o postContent
    console.log('Received imageUrl:', imageUrl); // Log pra verificar a URL da imagem

    if (!postContent || typeof postContent !== 'string' || postContent.trim() === '') {
      throw new Error('Post content is missing, invalid, or empty');
    }

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      throw new Error('Image URL is missing, invalid, or empty');
    }

    // Passo 1: Registrar a imagem no LinkedIn
    const registerUrl = 'https://api.linkedin.com/v2/assets?action=registerUpload';
    const registerHeaders = {
      'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202301',
      'Content-Type': 'application/json'
    };
    const registerPayload = {
      "registerUploadRequest": {
        "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
        "owner": process.env.LINKEDIN_USER_URN,
        "serviceRelationships": [
          {
            "relationshipType": "OWNER",
            "identifier": "urn:li:userGeneratedContent"
          }
        ]
      }
    };

    const registerResponse = await axios.post(registerUrl, registerPayload, { headers: registerHeaders });
    const assetUrn = registerResponse.data.value.asset; // Ex.: urn:li:digitalmediaAsset:abc123
    const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;

    console.log('Registered image, asset URN:', assetUrn, 'upload URL:', uploadUrl);

    // Passo 2: Fazer upload da imagem pro LinkedIn
    // Como a imagem já está hospedada (imageUrl), precisamos baixá-la e enviá-la como binário
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageData = imageResponse.data;

    const uploadHeaders = {
      'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      'Content-Type': 'application/octet-stream'
    };
    await axios.post(uploadUrl, imageData, { headers: uploadHeaders });

    console.log('Image uploaded successfully to LinkedIn');

    // Passo 3: Criar o post com o texto e a imagem
    const postUrl = 'https://api.linkedin.com/v2/ugcPosts';
    const postHeaders = {
      'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202301',
      'Content-Type': 'application/json'
    };
    const postPayload = {
      "author": process.env.LINKEDIN_USER_URN,
      "lifecycleState": "PUBLISHED",
      "specificContent": {
        "com.linkedin.ugc.ShareContent": {
          "shareCommentary": {
            "text": postContent
          },
          "shareMediaCategory": "IMAGE",
          "media": [
            {
              "status": "READY",
              "description": {
                "text": "Image generated for LinkedIn post"
              },
              "media": assetUrn,
              "title": {
                "text": "Generated Image"
              }
            }
          ]
        }
      },
      "visibility": {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    };

    const postResponse = await axios.post(postUrl, postPayload, { headers: postHeaders });
    const postId = postResponse.headers['x-restli-id'];

    response.status(200).send({
      success: true,
      message: 'Post published successfully on LinkedIn',
      postId: postId
    });
  } catch (error) {
    console.error('Error publishing LinkedIn post:', error);
    response.status(500).send({
      success: false,
      message: 'Error publishing LinkedIn post: ' + error.message
    });
  }
});

module.exports = publishLinkedInPost;
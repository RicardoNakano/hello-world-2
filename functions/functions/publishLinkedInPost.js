const functions = require('firebase-functions');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

// Função para publicar o post ou artigo com imagem no LinkedIn
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
    // Receber o texto do post, URL da imagem, tipo (post ou artigo) e título (se artigo) do corpo da requisição
    const { postContent, imageUrl, contentType, articleTitle } = request.body;

    console.log('Received postContent:', postContent);
    console.log('Received imageUrl:', imageUrl);
    console.log('Received contentType:', contentType);
    console.log('Received articleTitle:', articleTitle);

    // Validações
    if (!postContent || typeof postContent !== 'string' || postContent.trim() === '') {
      throw new Error('Post content is missing, invalid, or empty');
    }
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      throw new Error('Image URL is missing, invalid, or empty');
    }
    if (!contentType || !['POST', 'ARTICLE'].includes(contentType)) {
      throw new Error('Content type must be either POST or ARTICLE');
    }
    if (contentType === 'ARTICLE' && (!articleTitle || typeof articleTitle !== 'string' || articleTitle.trim() === '')) {
      throw new Error('Article title is missing, invalid, or empty for ARTICLE type');
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
    const assetUrn = registerResponse.data.value.asset;
    const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;

    console.log('Registered image, asset URN:', assetUrn, 'upload URL:', uploadUrl);

    // Passo 2: Fazer upload da imagem pro LinkedIn
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageData = imageResponse.data;

    const uploadHeaders = {
      'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      'Content-Type': 'application/octet-stream'
    };
    await axios.post(uploadUrl, imageData, { headers: uploadHeaders });

    console.log('Image uploaded successfully to LinkedIn');

    // Passo 3: Criar o post ou artigo no LinkedIn
    const postUrl = 'https://api.linkedin.com/v2/ugcPosts';
    const postHeaders = {
      'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202301',
      'Content-Type': 'application/json'
    };
    let postPayload;

    if (contentType === 'ARTICLE') {
      // Payload para artigo
      postPayload = {
        "author": process.env.LINKEDIN_USER_URN,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
          "com.linkedin.ugc.ShareContent": {
            "shareCommentary": {
              "text": postContent
            },
            "shareMediaCategory": "NONE",
            "media": [
              {
                "status": "READY",
                "description": {
                  "text": "Cover image for LinkedIn article"
                },
                "media": assetUrn,
                "title": {
                  "text": articleTitle
                }
              }
            ]
          }
        },
        "visibility": {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
      };
    } else {
      // Payload para post
      postPayload = {
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
    }

    const postResponse = await axios.post(postUrl, postPayload, { headers: postHeaders });
    const postId = postResponse.headers['x-restli-id'];

    // Passo 4: Salvar no Firestore
    const db = admin.firestore();
    const linkedinPostsRef = db.collection('linkedin_posts').doc();
    const timestamp = process.env.FUNCTIONS_EMULATOR
      ? new Date()
      : admin.firestore().FieldValue.serverTimestamp();
    await linkedinPostsRef.set({
      postId: postId,
      content: postContent,
      type: contentType,
      articleTitle: contentType === 'ARTICLE' ? articleTitle : null,
      imageUrl: imageUrl,
      createdAt: timestamp
    });

    console.log('Post/Article saved to Firestore with ID:', linkedinPostsRef.id);

    response.status(200).send({
      success: true,
      message: `LinkedIn ${contentType.toLowerCase()} published successfully`,
      postId: postId
    });
  } catch (error) {
    console.error('Error publishing LinkedIn post/article:', error);
    response.status(500).send({
      success: false,
      message: 'Error publishing LinkedIn post/article: ' + error.message
    });
  }
});

module.exports = publishLinkedInPost;
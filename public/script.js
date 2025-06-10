// Importar Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Determinar a URL base dependendo do ambiente
const isEmulator = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const baseUrl = isEmulator
  ? 'http://127.0.0.1:5001/hello-world-firebase-f1b5d/us-central1'
  : 'https://us-central1-hello-world-firebase-f1b5d.cloudfunctions.net';

// Variável global pra armazenar o último post/artigo gerado
let lastLinkedInContent = null;

// Variáveis globais pra Firebase
let app, auth;

// Função pra login com Google
window.signInWithGoogle = function() {
  if (!auth) {
    console.error('Firebase Auth não inicializado ainda.');
    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.innerText = 'Por favor, aguarde a inicialização do Firebase.';
    return;
  }
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      const userInfo = document.getElementById('user-info');
      if (userInfo) userInfo.innerText = `Bem-vindo, ${user.displayName}!`;
      document.getElementById('sign-in-button').style.display = 'none';
      document.getElementById('sign-out-button').style.display = 'block';
      document.getElementById('tweet-section').style.display = 'block';
      document.getElementById('etf-section').style.display = 'block';
      document.getElementById('linkedin-section').style.display = 'block';
      fetchCloudFunction();
    })
    .catch((error) => {
      console.error('Erro ao fazer login:', error);
      const userInfo = document.getElementById('user-info');
      if (userInfo) userInfo.innerText = 'Erro ao fazer login: ' + error.message;
    });
};

// Função pra logout
window.signOut = function() {
  if (!auth) {
    console.error('Firebase Auth não inicializado ainda.');
    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.innerText = 'Por favor, aguarde a inicialização do Firebase.';
    return;
  }
  signOut(auth)
    .then(() => {
      const userInfo = document.getElementById('user-info');
      if (userInfo) userInfo.innerText = 'Você saiu.';
      document.getElementById('sign-in-button').style.display = 'block';
      document.getElementById('sign-out-button').style.display = 'none';
      document.getElementById('tweet-section').style.display = 'none';
      document.getElementById('etf-section').style.display = 'none';
      document.getElementById('linkedin-section').style.display = 'none';
      const mensagem = document.getElementById('mensagem');
      if (mensagem) mensagem.innerText = '';
      const tweetMessage = document.getElementById('tweet-message');
      if (tweetMessage) tweetMessage.innerText = '';
      const etfMessage = document.getElementById('etf-message');
      if (etfMessage) etfMessage.innerHTML = '';
      const linkedinMessage = document.getElementById('linkedin-message');
      if (linkedinMessage) linkedinMessage.value = '';
      const articleTitle = document.getElementById('article-title');
      if (articleTitle) articleTitle.value = '';
      const linkedinImageMessage = document.getElementById('linkedin-image-message');
      if (linkedinImageMessage) linkedinImageMessage.innerText = '';
      document.getElementById('linkedin-image-preview').style.display = 'none';
      document.getElementById('linkedin-image-button').style.display = 'none';
      document.getElementById('publish-linkedin-button').style.display = 'none';
      const publishLinkedInMessage = document.getElementById('publish-linkedin-message');
      if (publishLinkedInMessage) publishLinkedInMessage.innerText = '';
      lastLinkedInContent = null;
    })
    .catch((error) => {
      console.error('Erro ao sair:', error);
      const userInfo = document.getElementById('user-info');
      if (userInfo) userInfo.innerText = 'Erro ao sair: ' + error.message;
    });
};

// Função pra buscar o firebaseConfig do backend
async function fetchFirebaseConfig() {
  try {
    const response = await fetch(`${baseUrl}/getFirebaseConfig`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch Firebase config');
    }
    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar firebaseConfig:', error);
    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.innerText = 'Erro ao carregar configuração do Firebase: ' + error.message;
    throw error;
  }
}

// Inicializar Firebase com configuração dinâmica
document.addEventListener('DOMContentLoaded', () => {
  fetchFirebaseConfig()
    .then((firebaseConfig) => {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);

      // Monitorar estado de autenticação
      onAuthStateChanged(auth, (user) => {
        const userInfo = document.getElementById('user-info');
        if (user) {
          if (userInfo) userInfo.innerText = `Bem-vindo, ${user.displayName}!`;
          document.getElementById('sign-in-button').style.display = 'none';
          document.getElementById('sign-out-button').style.display = 'block';
          document.getElementById('tweet-section').style.display = 'block';
          document.getElementById('etf-section').style.display = 'block';
          document.getElementById('linkedin-section').style.display = 'block';
          fetchCloudFunction();
        } else {
          if (userInfo) userInfo.innerText = 'Nenhum usuário logado.';
          document.getElementById('sign-in-button').style.display = 'block';
          document.getElementById('sign-out-button').style.display = 'none';
          document.getElementById('tweet-section').style.display = 'none';
          document.getElementById('etf-section').style.display = 'none';
          document.getElementById('linkedin-section').style.display = 'none';
          const mensagem = document.getElementById('mensagem');
          if (mensagem) mensagem.innerText = '';
          const tweetMessage = document.getElementById('tweet-message');
          if (tweetMessage) tweetMessage.innerText = '';
          const etfMessage = document.getElementById('etf-message');
          if (etfMessage) etfMessage.innerHTML = '';
          const linkedinMessage = document.getElementById('linkedin-message');
          if (linkedinMessage) linkedinMessage.value = '';
          const articleTitle = document.getElementById('article-title');
          if (articleTitle) articleTitle.value = '';
          const linkedinImageMessage = document.getElementById('linkedin-image-message');
          if (linkedinImageMessage) linkedinImageMessage.innerText = '';
          document.getElementById('linkedin-image-preview').style.display = 'none';
          document.getElementById('linkedin-image-button').style.display = 'none';
          document.getElementById('publish-linkedin-button').style.display = 'none';
          const publishLinkedInMessage = document.getElementById('publish-linkedin-message');
          if (publishLinkedInMessage) publishLinkedInMessage.innerText = '';
          lastLinkedInContent = null;
        }
      });
    })
    .catch((error) => {
      console.error('Falha na inicialização do Firebase:', error);
    });

  // Inicializar MDC Ripple nos botões
  if (typeof mdc !== 'undefined' && mdc.ripple) {
    document.querySelectorAll('.mdc-button').forEach(button => {
      new mdc.ripple.MDCRipple(button);
    });
  } else {
    console.warn('MDC Ripple não disponível. Efeito de ripple não será aplicado.');
  }

  // Listener para o seletor de tipo de conteúdo
  const contentTypeSelect = document.getElementById('content-type');
  const articleTitleSection = document.getElementById('article-title-section');
  if (contentTypeSelect && articleTitleSection) {
    contentTypeSelect.addEventListener('change', () => {
      articleTitleSection.style.display = contentTypeSelect.value === 'ARTICLE' ? 'block' : 'none';
    });
  }
});

// Chamar a Cloud Function helloWorld
async function fetchCloudFunction() {
  const user = auth.currentUser;
  if (user) {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`${baseUrl}/helloWorld`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await response.text();
      const mensagem = document.getElementById('mensagem');
      if (mensagem) mensagem.innerText = data;
    } catch (error) {
      console.error('Erro:', error);
      const mensagem = document.getElementById('mensagem');
      if (mensagem) mensagem.innerText = 'Erro ao chamar a função: ' + error.message;
    }
  } else {
    const mensagem = document.getElementById('mensagem');
    if (mensagem) mensagem.innerText = 'Faça login para acessar a função.';
  }
}

// Função pra postar tweet
async function postTweet() {
  const tweetButton = document.getElementById('tweet-button');
  const spinner = document.getElementById('tweet-spinner');
  const tweetMessage = document.getElementById('tweet-message');

  if (!tweetButton || !spinner || !tweetMessage) return;

  tweetButton.disabled = true;
  spinner.style.display = 'inline-block';
  tweetMessage.innerText = '';

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    const response = await fetch(`${baseUrl}/postTweet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (result.success) {
      tweetMessage.innerText = `Tweet postado com sucesso! ID: ${result.tweetId}\nConteúdo:\n${result.tweetText}`;
    } else {
      tweetMessage.innerText = 'Erro: ' + result.message;
    }
  } catch (error) {
    console.error('Erro ao postar tweet:', error);
    tweetMessage.innerText = 'Erro ao postar tweet: ' + error.message;
  } finally {
    tweetButton.disabled = false;
    spinner.style.display = 'none';
  }
}

// Função pra analisar ETFs
async function analyzeETFs() {
  const etfButton = document.getElementById('etf-button');
  const spinner = document.getElementById('etf-spinner');
  const etfMessage = document.getElementById('etf-message');

  if (!etfButton || !spinner || !etfMessage) return;

  etfButton.disabled = true;
  spinner.style.display = 'inline-block';
  etfMessage.innerHTML = '';

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    const response = await fetch(`${baseUrl}/analyzeETFs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (result.success) {
      etfMessage.innerHTML = result.analysis; // Renderizar a tabela HTML
    } else {
      etfMessage.innerText = 'Erro: ' + result.message;
    }
  } catch (error) {
    console.error('Erro ao analisar ETFs:', error);
    etfMessage.innerText = 'Erro ao analisar ETFs: ' + error.message;
  } finally {
    etfButton.disabled = false;
    spinner.style.display = 'none';
  }
}

// Função pra gerar post ou artigo no LinkedIn
async function generateLinkedInPost() {
  const linkedinButton = document.getElementById('linkedin-button');
  const spinner = document.getElementById('linkedin-spinner');
  const linkedinMessage = document.getElementById('linkedin-message');
  const articleTitleInput = document.getElementById('article-title');
  const linkedinImageButton = document.getElementById('linkedin-image-button');
  const linkedinImagePreview = document.getElementById('linkedin-image-preview');
  const publishLinkedInButton = document.getElementById('publish-linkedin-button');
  const contentTypeSelect = document.getElementById('content-type');

  if (!linkedinButton || !spinner || !linkedinMessage || !articleTitleInput || !linkedinImageButton || !linkedinImagePreview || !publishLinkedInButton || !contentTypeSelect) return;

  linkedinButton.disabled = true;
  spinner.style.display = 'inline-block';
  linkedinMessage.value = '';
  articleTitleInput.value = '';
  linkedinMessage.readOnly = false; // Permitir edição
  linkedinImageButton.style.display = 'none';
  linkedinImagePreview.style.display = 'none';
  publishLinkedInButton.style.display = 'none';

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    const contentType = contentTypeSelect.value;

    const response = await fetch(`${baseUrl}/generateLinkedInPost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contentType })
    });

    const result = await response.json();
    if (result.success) {
      lastLinkedInContent = { content: result.postContent, type: contentType, articleTitle: result.articleTitle || null };
      console.log('Generated LinkedIn content:', lastLinkedInContent);
      linkedinMessage.value = result.postContent;
      if (contentType === 'ARTICLE' && result.articleTitle) {
        articleTitleInput.value = result.articleTitle;
      }
      linkedinImageButton.style.display = 'block';
    } else {
      linkedinMessage.value = 'Erro: ' + result.message;
      linkedinMessage.readOnly = true;
    }
  } catch (error) {
    console.error('Erro ao gerar conteúdo no LinkedIn:', error);
    linkedinMessage.value = 'Erro ao gerar conteúdo no LinkedIn: ' + error.message;
    linkedinMessage.readOnly = true;
  } finally {
    linkedinButton.disabled = false;
    spinner.style.display = 'none';
  }
}

// Função pra gerar a imagem pro post ou artigo do LinkedIn
async function generateLinkedInPostImage() {
  const linkedinImageButton = document.getElementById('linkedin-image-button');
  const spinner = document.getElementById('linkedin-image-spinner');
  const linkedinImageMessage = document.getElementById('linkedin-image-message');
  const linkedinImagePreview = document.getElementById('linkedin-image-preview');
  const linkedinMessage = document.getElementById('linkedin-message');
  const publishLinkedInButton = document.getElementById('publish-linkedin-button');

  if (!linkedinImageButton || !spinner || !linkedinImageMessage || !linkedinImagePreview || !linkedinMessage || !publishLinkedInButton) return;

  linkedinImageButton.disabled = true;
  spinner.style.display = 'inline-block';
  linkedinImageMessage.innerText = '';
  linkedinImagePreview.style.display = 'none';
  publishLinkedInButton.style.display = 'none';

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    // Usar o texto editado do textarea
    const editedPostContent = linkedinMessage.value.trim();
    if (!editedPostContent) {
      throw new Error('Nenhum conteúdo do LinkedIn disponível. Gere ou edite um conteúdo primeiro.');
    }

    console.log('Sending postContent to generateLinkedInPostImage:', editedPostContent);

    const response = await fetch(`${baseUrl}/generateLinkedInPostImage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ postContent: editedPostContent })
    });

    const result = await response.json();
    if (result.success) {
      linkedinImageMessage.innerText = `Imagem gerada com sucesso!\nPrompt usado:\n${result.prompt}`;
      linkedinImagePreview.src = result.imageUrl;
      linkedinImagePreview.style.display = 'block';
      publishLinkedInButton.style.display = 'block';
    } else {
      linkedinImageMessage.innerText = 'Erro: ' + result.message;
    }
  } catch (error) {
    console.error('Erro ao gerar imagem:', error);
    linkedinImageMessage.innerText = 'Erro ao gerar imagem: ' + error.message;
  } finally {
    linkedinImageButton.disabled = false;
    spinner.style.display = 'none';
  }
}

// Função pra limpar asteriscos duplos (**)
window.clearAsterisks = function() {
  const linkedinMessage = document.getElementById('linkedin-message');
  if (linkedinMessage) {
    let text = linkedinMessage.value;
    // Remove todos os pares de **, mantendo o texto entre eles
    text = text.replace(/\*\*(.*?)\*\*/g, '$1');
    linkedinMessage.value = text;
  }
};

// Função pra publicar o post ou artigo no LinkedIn
async function publishLinkedInPost() {
  const publishLinkedInButton = document.getElementById('publish-linkedin-button');
  const spinner = document.getElementById('publish-linkedin-spinner');
  const publishLinkedInMessage = document.getElementById('publish-linkedin-message');
  const linkedinMessage = document.getElementById('linkedin-message');
  const linkedinImagePreview = document.getElementById('linkedin-image-preview');
  const contentTypeSelect = document.getElementById('content-type');
  const articleTitleInput = document.getElementById('article-title');

  if (!publishLinkedInButton || !spinner || !publishLinkedInMessage || !linkedinMessage || !linkedinImagePreview || !contentTypeSelect || !articleTitleInput) return;

  publishLinkedInButton.disabled = true;
  spinner.style.display = 'inline-block';
  publishLinkedInMessage.innerText = '';

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    // Usar o texto editado do textarea
    const postContent = linkedinMessage.value.trim();
    if (!postContent) {
      throw new Error('Nenhum conteúdo do LinkedIn disponível. Gere ou edite um conteúdo primeiro.');
    }

    // Usar a URL da imagem gerada
    const imageUrl = linkedinImagePreview.src;
    if (!imageUrl) {
      throw new Error('Nenhuma imagem disponível. Gere uma imagem primeiro.');
    }

    // Validar título para artigos
    const contentType = contentTypeSelect.value;
    const articleTitle = articleTitleInput.value.trim();
    if (contentType === 'ARTICLE' && !articleTitle) {
      throw new Error('Título do artigo é obrigatório.');
    }

    console.log('Sending postContent, imageUrl, contentType, and articleTitle to publishLinkedInPost:', postContent, imageUrl, contentType, articleTitle);

    const response = await fetch(`${baseUrl}/publishLinkedInPost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ postContent, imageUrl, contentType, articleTitle })
    });

    const result = await response.json();
    if (result.success) {
      publishLinkedInMessage.innerText = `Conteúdo publicado com sucesso no LinkedIn! ID: ${result.postId}`;
    } else {
      publishLinkedInMessage.innerText = 'Erro: ' + result.message;
    }
  } catch (error) {
    console.error('Erro ao publicar no LinkedIn:', error);
    publishLinkedInMessage.innerText = 'Erro ao publicar no LinkedIn: ' + error.message;
  } finally {
    publishLinkedInButton.disabled = false;
    spinner.style.display = 'none';
  }
}

// Expor as funções no escopo global pra os onclicks
window.postTweet = postTweet;
window.analyzeETFs = analyzeETFs;
window.generateLinkedInPost = generateLinkedInPost;
window.generateLinkedInPostImage = generateLinkedInPostImage;
window.publishLinkedInPost = publishLinkedInPost;
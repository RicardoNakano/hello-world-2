// Importar Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Determinar a URL base dependendo do ambiente
const isEmulator = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const baseUrl = isEmulator
  ? 'http://127.0.0.1:5001/hello-world-firebase-f1b5d/us-central1'
  : 'https://us-central1-hello-world-firebase-f1b5d.cloudfunctions.net';

// Variável global pra armazenar o último post gerado
let lastLinkedInPost = null;

// Variáveis globais pra Firebase
let app, auth;

// Função pra login com Google
window.signInWithGoogle = function() {
  if (!auth) {
    console.error('Firebase Auth não inicializado ainda.');
    document.getElementById('user-info').innerText = 'Por favor, aguarde a inicialização do Firebase.';
    return;
  }
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      document.getElementById('user-info').innerText = `Bem-vindo, ${user.displayName}!`;
      document.getElementById('sign-in-button').style.display = 'none';
      document.getElementById('sign-out-button').style.display = 'block';
      document.getElementById('tweet-section').style.display = 'block';
      document.getElementById('etf-section').style.display = 'block';
      document.getElementById('linkedin-section').style.display = 'block';
      fetchCloudFunction();
    })
    .catch((error) => {
      console.error('Erro ao fazer login:', error);
      document.getElementById('user-info').innerText = 'Erro ao fazer login: ' + error.message;
    });
};

// Função pra logout
window.signOut = function() {
  if (!auth) {
    console.error('Firebase Auth não inicializado ainda.');
    document.getElementById('user-info').innerText = 'Por favor, aguarde a inicialização do Firebase.';
    return;
  }
  signOut(auth)
    .then(() => {
      document.getElementById('user-info').innerText = 'Você saiu.';
      document.getElementById('sign-in-button').style.display = 'block';
      document.getElementById('sign-out-button').style.display = 'none';
      document.getElementById('tweet-section').style.display = 'none';
      document.getElementById('etf-section').style.display = 'none';
      document.getElementById('linkedin-section').style.display = 'none';
      document.getElementById('mensagem').innerText = '';
      document.getElementById('tweet-message').innerText = '';
      document.getElementById('etf-message').innerHTML = '';
      document.getElementById('linkedin-message').value = '';
      document.getElementById('linkedin-image-message').innerText = '';
      document.getElementById('linkedin-image-preview').style.display = 'none';
      document.getElementById('linkedin-image-button').style.display = 'none';
      document.getElementById('publish-linkedin-button').style.display = 'none';
      document.getElementById('publish-linkedin-message').innerText = '';
      lastLinkedInPost = null;
    })
    .catch((error) => {
      console.error('Erro ao sair:', error);
      document.getElementById('user-info').innerText = 'Erro ao sair: ' + error.message;
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
    document.getElementById('user-info').innerText = 'Erro ao carregar configuração do Firebase: ' + error.message;
    throw error;
  }
}

// Inicializar Firebase com configuração dinâmica
fetchFirebaseConfig()
  .then((firebaseConfig) => {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);

    // Configurar o Auth Emulator no ambiente local
    if (isEmulator) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }

    // Monitorar estado de autenticação
    onAuthStateChanged(auth, (user) => {
      if (user) {
        document.getElementById('user-info').innerText = `Bem-vindo, ${user.displayName}!`;
        document.getElementById('sign-in-button').style.display = 'none';
        document.getElementById('sign-out-button').style.display = 'block';
        document.getElementById('tweet-section').style.display = 'block';
        document.getElementById('etf-section').style.display = 'block';
        document.getElementById('linkedin-section').style.display = 'block';
        fetchCloudFunction();
      } else {
        document.getElementById('user-info').innerText = 'Nenhum usuário logado.';
        document.getElementById('sign-in-button').style.display = 'block';
        document.getElementById('sign-out-button').style.display = 'none';
        document.getElementById('tweet-section').style.display = 'none';
        document.getElementById('etf-section').style.display = 'none';
        document.getElementById('linkedin-section').style.display = 'none';
        document.getElementById('mensagem').innerText = '';
        document.getElementById('tweet-message').innerText = '';
        document.getElementById('etf-message').innerHTML = '';
        document.getElementById('linkedin-message').value = '';
        document.getElementById('linkedin-image-message').innerText = '';
        document.getElementById('linkedin-image-preview').style.display = 'none';
        document.getElementById('linkedin-image-button').style.display = 'none';
        document.getElementById('publish-linkedin-button').style.display = 'none';
        document.getElementById('publish-linkedin-message').innerText = '';
        lastLinkedInPost = null;
      }
    });
  })
  .catch((error) => {
    console.error('Falha na inicialização do Firebase:', error);
  });

// Inicializar MDC Ripple nos botões
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.mdc-button').forEach(button => {
    new mdc.ripple.MDCRipple(button);
  });
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
      document.getElementById('mensagem').innerText = data;
    } catch (error) {
      console.error('Erro:', error);
      document.getElementById('mensagem').innerText = 'Erro ao chamar a função: ' + error.message;
    }
  } else {
    document.getElementById('mensagem').innerText = 'Faça login para acessar a função.';
  }
}

// Função pra postar tweet
async function postTweet() {
  const tweetButton = document.getElementById('tweet-button');
  const spinner = document.getElementById('tweet-spinner');
  const tweetMessage = document.getElementById('tweet-message');

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

// Função pra gerar post no LinkedIn
async function generateLinkedInPost() {
  const linkedinButton = document.getElementById('linkedin-button');
  const spinner = document.getElementById('linkedin-spinner');
  const linkedinMessage = document.getElementById('linkedin-message');
  const linkedinImageButton = document.getElementById('linkedin-image-button');
  const linkedinImagePreview = document.getElementById('linkedin-image-preview');
  const publishLinkedInButton = document.getElementById('publish-linkedin-button');

  linkedinButton.disabled = true;
  spinner.style.display = 'inline-block';
  linkedinMessage.value = '';
  linkedinMessage.readOnly = false; // Permitir edição
  linkedinImageButton.style.display = 'none';
  linkedinImagePreview.style.display = 'none';
  publishLinkedInButton.style.display = 'none';

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    const response = await fetch(`${baseUrl}/generateLinkedInPost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (result.success) {
      lastLinkedInPost = result.postContent; // Salvar o post gerado
      console.log('Generated LinkedIn post:', lastLinkedInPost); // Log pra verificar o post gerado
      linkedinMessage.value = result.postContent; // Exibir no textarea
      linkedinImageButton.style.display = 'block'; // Mostrar o botão pra gerar a imagem
    } else {
      linkedinMessage.value = 'Erro: ' + result.message;
      linkedinMessage.readOnly = true;
    }
  } catch (error) {
    console.error('Erro ao gerar post no LinkedIn:', error);
    linkedinMessage.value = 'Erro ao gerar post no LinkedIn: ' + error.message;
    linkedinMessage.readOnly = true;
  } finally {
    linkedinButton.disabled = false;
    spinner.style.display = 'none';
  }
}

// Função pra gerar a imagem pro post do LinkedIn
async function generateLinkedInPostImage() {
  const linkedinImageButton = document.getElementById('linkedin-image-button');
  const spinner = document.getElementById('linkedin-image-spinner');
  const linkedinImageMessage = document.getElementById('linkedin-image-message');
  const linkedinImagePreview = document.getElementById('linkedin-image-preview');
  const linkedinMessage = document.getElementById('linkedin-message');
  const publishLinkedInButton = document.getElementById('publish-linkedin-button');

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
      throw new Error('Nenhum post do LinkedIn disponível. Gere ou edite um post primeiro.');
    }

    console.log('Sending postContent to generateLinkedInPostImage:', editedPostContent); // Log pra verificar o envio

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
      linkedinImagePreview.src = result.imageUrl; // Exibir a imagem
      linkedinImagePreview.style.display = 'block';
      publishLinkedInButton.style.display = 'block'; // Mostrar o botão pra publicar no LinkedIn
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
  let text = linkedinMessage.value;
  // Remove todos os pares de **, mantendo o texto entre eles
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  linkedinMessage.value = text;
};

// Função pra publicar o post no LinkedIn
async function publishLinkedInPost() {
  const publishLinkedInButton = document.getElementById('publish-linkedin-button');
  const spinner = document.getElementById('publish-linkedin-spinner');
  const publishLinkedInMessage = document.getElementById('publish-linkedin-message');
  const linkedinMessage = document.getElementById('linkedin-message');
  const linkedinImagePreview = document.getElementById('linkedin-image-preview');

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
      throw new Error('Nenhum post do LinkedIn disponível. Gere ou edite um post primeiro.');
    }

    // Usar a URL da imagem gerada
    const imageUrl = linkedinImagePreview.src;
    if (!imageUrl) {
      throw new Error('Nenhuma imagem disponível. Gere uma imagem primeiro.');
    }

    console.log('Sending postContent and imageUrl to publishLinkedInPost:', postContent, imageUrl);

    const response = await fetch(`${baseUrl}/publishLinkedInPost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ postContent, imageUrl })
    });

    const result = await response.json();
    if (result.success) {
      publishLinkedInMessage.innerText = `Post publicado com sucesso no LinkedIn! ID: ${result.postId}`;
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
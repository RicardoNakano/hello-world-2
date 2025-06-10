const functions = require('firebase-functions');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// P/E Ratios médios estáticos (Eqvista, 25/01/2025)
const industryPERatios = {
  'Bancos': 13.50,
  'Elétricas': 22.50,
  'Saneamento': 23.00,
  'Seguros': 18.60,
  'Transmissão': 22.50
};

// Mapeamento de indústrias BESST para Finnhub
const industryMapping = {
  'Bancos': ['Banks—Regional', 'Banks—Diversified'],
  'Elétricas': ['Utilities—Regulated Electric'],
  'Saneamento': ['Utilities—Regulated Water'],
  'Seguros': ['Insurance—Property & Casualty', 'Insurance—Life'],
  'Transmissão': ['Utilities—Regulated Electric'] // Filtrar por descrição para transmissão
};

const analyzeStocksByPERatio = functions.https.onRequest(async (request, response) => {
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

  try {
    if (!process.env.FINNHUB_API_KEY) {
      throw new Error('FINNHUB_API_KEY is not set in environment variables');
    }

    const db = admin.firestore();
    const cacheDoc = await db.collection('stock_cache').doc('us_stocks').get();
    let companies = cacheDoc.exists ? cacheDoc.data().companies : null;

    // Buscar lista de ações se não estiver em cache
    if (!companies) {
      companies = [];
      const exchanges = ['US']; // NYSE e NASDAQ
      for (const exchange of exchanges) {
        const symbolUrl = `https://finnhub.io/api/v1/stock/symbol?exchange=${exchange}&token=${process.env.FINNHUB_API_KEY}`;
        const symbolResponse = await axios.get(symbolUrl);
        companies.push(...symbolResponse.data);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa para limite de chamadas
      }

      // Salvar no Firestore
      await db.collection('stock_cache').doc('us_stocks').set({ companies, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    }

    // Organizar empresas por indústria BESST
    const results = {};
    for (const category in industryMapping) {
      results[category] = [];
      const finnhubIndustries = industryMapping[category];
      const industryPERatio = industryPERatios[category] || 0;

      // Filtrar empresas por indústria
      const filteredCompanies = companies.filter(company => {
        const industry = company.finnhubIndustry || '';
        if (category === 'Transmissão') {
          return finnhubIndustries.includes(industry) && company.description?.toLowerCase().includes('transmission');
        }
        return finnhubIndustries.includes(industry);
      });

      // Processar em lotes para respeitar limite de 60 chamadas/minuto
      for (let i = 0; i < filteredCompanies.length; i += 10) {
        const batch = filteredCompanies.slice(i, i + 10);
        const promises = batch.map(async company => {
          try {
            const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${company.symbol}&token=${process.env.FINNHUB_API_KEY}`;
            const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${company.symbol}&metric=valuation&token=${process.env.FINNHUB_API_KEY}`;

            const [quoteResponse, metricsResponse] = await Promise.all([
              axios.get(quoteUrl),
              axios.get(metricsUrl)
            ]);

            const quoteData = quoteResponse.data;
            const metricsData = metricsResponse.data.metric || {};

            const price = parseFloat(quoteData.c) || 0;
            const peRatio = parseFloat(metricsData.peAnnual) || 0;
            const signal = peRatio > 0 && peRatio < industryPERatio ? '✔' : '✘';

            return {
              name: company.displaySymbol || company.description || company.symbol,
              ticker: company.symbol,
              price: price.toFixed(2),
              peRatio: peRatio.toFixed(2),
              industryPERatio: industryPERatio.toFixed(2),
              signal
            };
          } catch (error) {
            console.warn(`Erro ao processar ${company.symbol}: ${error.message}`);
            return null;
          }
        });

        const batchResults = await Promise.all(promises);
        results[category].push(...batchResults.filter(result => result));
        await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa para limite de chamadas
      }
    }

    response.status(200).send({
      success: true,
      message: 'Stock analysis completed',
      data: results
    });
  } catch (error) {
    console.error('Error analyzing stocks:', error);
    response.status(500).send({
      success: false,
      message: 'Error analyzing stocks: ' + (error.response?.data?.message || error.message)
    });
  }
});

module.exports = analyzeStocksByPERatio;
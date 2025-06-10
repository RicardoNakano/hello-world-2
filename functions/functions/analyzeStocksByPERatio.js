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
  'Transmissão': ['Utilities—Regulated Electric']
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
    const cacheDoc = await db.collection('stock_cache').doc('us_stocks_besst').get();
    let companies = cacheDoc.exists ? cacheDoc.data().companies : null;

    // Buscar lista de ações se não estiver em cache
    if (!companies) {
      const symbolUrl = `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${process.env.FINNHUB_API_KEY}`;
      const symbolResponse = await axios.get(symbolUrl);
      companies = symbolResponse.data.filter(company => {
        const industry = company.finnhubIndustry || '';
        return Object.values(industryMapping).flat().includes(industry);
      });

      await db.collection('stock_cache').doc('us_stocks_besst').set({
        companies,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    const results = {};
    for (const category in industryMapping) {
      results[category] = [];
      const finnhubIndustries = industryMapping[category];
      const industryPERatio = industryPERatios[category] || 0;

      // Filtrar empresas por indústria
      let filteredCompanies = companies.filter(company => {
        const industry = company.finnhubIndustry || '';
        if (category === 'Transmissão') {
          return finnhubIndustries.includes(industry) && company.description?.toLowerCase().includes('transmission');
        }
        return finnhubIndustries.includes(industry);
      });

      // Obter market cap para ordenar
      const companiesWithMarketCap = [];
      for (let i = 0; i < filteredCompanies.length; i += 5) {
        const batch = filteredCompanies.slice(i, i + 5);
        const promises = batch.map(async company => {
          try {
            const profileUrl = `https://finnhub.io/api/v1/company/profile2?symbol=${company.symbol}&token=${process.env.FINNHUB_API_KEY}`;
            const profileResponse = await axios.get(profileUrl);
            const marketCap = parseFloat(profileResponse.data.marketCapitalization) || 0;
            return { ...company, marketCap };
          } catch (error) {
            console.warn(`Erro ao obter market cap para ${company.symbol}: ${error.message}`);
            return null;
          }
        });

        const batchResults = await Promise.all(promises);
        companiesWithMarketCap.push(...batchResults.filter(result => result && result.marketCap > 0));
        await new Promise(resolve => setTimeout(resolve, 2000)); // Pausa de 2 segundos
      }

      // Ordenar por market cap e pegar as 5 maiores
      const topCompanies = companiesWithMarketCap
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, 5);

      // Obter preço e P/E para as top 5
      for (const company of topCompanies) {
        const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${company.symbol}&token=${process.env.FINNHUB_API_KEY}`;
        const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${company.symbol}&metric=valuation&token=${process.env.FINNHUB_API_KEY}`;

        try {
          const [quoteResponse, metricsResponse] = await Promise.all([
            axios.get(quoteUrl),
            axios.get(metricsUrl)
          ]);

          const quoteData = quoteResponse.data;
          const metricsData = metricsResponse.data.metric || {};

          const price = parseFloat(quoteData.c) || 0;
          const peRatio = parseFloat(metricsData.peAnnual) || 0;
          const signal = peRatio > 0 && peRatio < industryPERatio ? '✔' : '✘';

          results[category].push({
            name: company.displaySymbol || company.description || company.symbol,
            ticker: company.symbol,
            price: price.toFixed(2),
            peRatio: peRatio.toFixed(2),
            industryPERatio: industryPERatio.toFixed(2),
            signal
          });
        } catch (error) {
          console.warn(`Erro ao processar ${company.symbol}: ${error.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000)); // Pausa de 2 segundos
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
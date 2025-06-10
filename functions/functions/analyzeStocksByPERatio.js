const functions = require('firebase-functions');
const axios = require('axios');
require('dotenv').config();

// P/E Ratios médios estáticos (Eqvista, 25/01/2025)
const industryPERatios = {
  'Bancos': 13.50,
  'Elétricas': 22.50,
  'Saneamento': 23.00,
  'Seguros': 18.60,
  'Transmissão': 22.50
};

// Empresas de exemplo por indústria
const sampleCompanies = {
  'Bancos': [
    { name: 'JPMorgan Chase & Co.', ticker: 'JPM' },
    { name: 'Wells Fargo & Company', ticker: 'WFC' },
    { name: 'Bank of America Corporation', ticker: 'BAC' }
  ],
  'Elétricas': [
    { name: 'NextEra Energy, Inc.', ticker: 'NEE' },
    { name: 'Dominion Energy, Inc.', ticker: 'D' },
    { name: 'Southern Company', ticker: 'SO' }
  ],
  'Saneamento': [
    { name: 'American Water Works Company, Inc.', ticker: 'AWK' },
    { name: 'Essential Utilities, Inc.', ticker: 'WTRG' }
  ],
  'Seguros': [
    { name: 'MetLife, Inc.', ticker: 'MET' },
    { name: 'Allstate Corporation', ticker: 'ALL' },
    { name: 'Prudential Financial, Inc.', ticker: 'PRU' }
  ],
  'Transmissão': [
    { name: 'FirstEnergy Corp.', ticker: 'FE' },
    { name: 'CenterPoint Energy, Inc.', ticker: 'CNP' },
    { name: 'American Electric Power Company, Inc.', ticker: 'AEP' }
  ]
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

    const results = {};
    for (const category in sampleCompanies) {
      results[category] = [];
      const companies = sampleCompanies[category];
      const industryPERatio = industryPERatios[category] || 0;

      for (const company of companies) {
        // Obter dados da Finnhub
        const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${company.ticker}&token=${process.env.FINNHUB_API_KEY}`;
        const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${company.ticker}&metric=valuation&token=${process.env.FINNHUB_API_KEY}`;

        const [quoteResponse, metricsResponse] = await Promise.all([
          axios.get(quoteUrl),
          axios.get(metricsUrl)
        ]);

        const quoteData = quoteResponse.data;
        const metricsData = metricsResponse.data.metric || {};

        const price = parseFloat(quoteData.c) || 0; // Preço atual
        const peRatio = parseFloat(metricsData.peAnnual) || 0; // P/E anual
        const signal = peRatio > 0 && peRatio < industryPERatio ? '✔' : '✘';

        results[category].push({
          name: company.name,
          ticker: company.ticker,
          price: price.toFixed(2),
          peRatio: peRatio.toFixed(2),
          industryPERatio: industryPERatio.toFixed(2),
          signal
        });
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
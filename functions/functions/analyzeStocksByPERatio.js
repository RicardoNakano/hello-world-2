const functions = require('firebase-functions');
const axios = require('axios');
require('dotenv').config();

// P/E Ratios médios por indústria (Eqvista, 25/01/2025)
const industryPERatios = {
  'Bancos': 13.50,
  'Elétricas': 22.50,
  'Saneamento': 23.00,
  'Seguros': 18.60,
  'Transmissão': 22.50
};

// Empresas de exemplo
const sampleCompanies = {
  'Bancos': [
    { name: 'JPMorgan Chase & Co.', ticker: 'JPM' },
    { name: 'Wells Fargo & Company', ticker: 'WFC' }
  ],
  'Elétricas': [
    { name: 'NextEra Energy, Inc.', ticker: 'NEE' },
    { name: 'Dominion Energy, Inc.', ticker: 'D' }
  ],
  'Saneamento': [
    { name: 'American Water Works Company, Inc.', ticker: 'AWK' }
  ],
  'Seguros': [
    { name: 'MetLife, Inc.', ticker: 'MET' },
    { name: 'Allstate Corporation', ticker: 'ALL' }
  ],
  'Transmissão': [
    { name: 'FirstEnergy Corp.', ticker: 'FE' },
    { name: 'CenterPoint Energy, Inc.', ticker: 'CNP' }
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
    const results = {};
    for (const category in sampleCompanies) {
      results[category] = [];
      const companies = sampleCompanies[category];
      const industryPERatio = industryPERatios[category] || 0;

      for (const company of companies) {
        // Usar Yahoo Finance API para preço e P/E (via proxy gratuito)
        const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${company.ticker}`;
        const quoteResponse = await axios.get(quoteUrl);
        const quoteData = quoteResponse.data.quoteResponse.result[0];

        if (quoteData) {
          const price = parseFloat(quoteData.regularMarketPrice) || 0;
          const peRatio = parseFloat(quoteData.trailingPE) || 0;
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
      message: 'Error analyzing stocks: ' + error.message
    });
  }
});

module.exports = analyzeStocksByPERatio;
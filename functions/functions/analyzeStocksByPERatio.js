const functions = require('firebase-functions');
const axios = require('axios');
require('dotenv').config();

// Mapeamento das indústrias BESST para as da FMP
const industryMapping = {
  'Bancos': 'Banks - Regional',
  'Elétricas': 'Utilities - Regulated Electric',
  'Saneamento': 'Utilities - Regulated Water',
  'Seguros': 'Insurance - Property & Casualty',
  'Transmissão': 'Utilities - Regulated Electric' // Foco em empresas de transmissão
};

// Empresas de exemplo por indústria (pode ser expandido)
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

// Função para analisar stocks por P/E Ratio
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
    // Passo 1: Obter P/E Ratios médios por indústria
    const industryPERatios = {};
    const industryUrl = 'https://financialmodelingprep.com/api/v4/industry/price_earnings_ratio?exchange=NYSE,NASDAQ&apikey=' + process.env.FMP_API_KEY;
    const industryResponse = await axios.get(industryUrl);
    industryResponse.data.forEach(item => {
      industryPERatios[item.industry] = parseFloat(item.peRatio) || 0;
    });

    // Passo 2: Obter dados das ações
    const results = {};
    for (const [besstCategory, fmpIndustry] of Object.entries(industryMapping)) {
      results[besstCategory] = [];
      const companies = sampleCompanies[besstCategory];
      const industryPERatio = industryPERatios[fmpIndustry] || 0;

      for (const company of companies) {
        const quoteUrl = `https://financialmodelingprep.com/api/v3/quote/${company.ticker}?apikey=${process.env.FMP_API_KEY}`;
        const quoteResponse = await axios.get(quoteUrl);
        const quoteData = quoteResponse.data[0];

        if (quoteData) {
          const price = parseFloat(quoteData.price) || 0;
          const peRatio = parseFloat(quoteData.pe) || 0;
          const signal = peRatio > 0 && peRatio < industryPERatio ? '✔' : '✘';

          results[besstCategory].push({
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

    // Passo 3: Retornar resultados
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
const yahooFinance = require('yahoo-finance2').default;

// Função para analisar ETFs (função interna, não exposta como endpoint)
const analyzeETFs = async () => {
  try {
    // Lista de ETFs
    const etfs = ['QYLD', 'JEPQ', 'JEPI', 'SCHD'];

    // --- Dados atuais (hoje) ---
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Ex.: 2025-05-24
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const formattedToday = dateFormatter.format(today); // Ex.: May 24, 2025

    const currentData = [];
    for (const symbol of etfs) {
      // Buscar o preço atual (ou último preço disponível se o mercado estiver fechado)
      const quote = await yahooFinance.quote(symbol);
      const currentPrice = quote.regularMarketPrice;

      // Buscar dados históricos pra calcular o 200-DMA atual (últimos 300 dias pra garantir 200 dias úteis)
      const endDate = new Date(todayStr);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 300); // Pegar 300 dias pra garantir 200 dias úteis

      const historicalForSmaCurrent = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: todayStr,
        interval: '1d'
      });

      if (historicalForSmaCurrent.length < 200) {
        throw new Error(`Not enough data to calculate current 200-DMA for ${symbol}`);
      }

      // Calcular o 200-DMA atual
      const last200DaysCurrent = historicalForSmaCurrent.slice(-200);
      const sma200Current = last200DaysCurrent.reduce((sum, day) => sum + day.close, 0) / 200;

      // Calcular a diferença percentual
      const percentageDiffCurrent = ((currentPrice - sma200Current) / sma200Current) * 100;

      // Formatar o resultado
      const iconCurrent = percentageDiffCurrent < 0 ? '✔' : '✘';
      const formattedDiffCurrent = percentageDiffCurrent >= 0 ? `+${percentageDiffCurrent.toFixed(2)}%` : `${percentageDiffCurrent.toFixed(2)}%`;
      const formattedPriceCurrent = currentPrice.toFixed(2);
      const formattedSma200Current = sma200Current.toFixed(2);

      currentData.push(`${iconCurrent} - ${symbol} - ${formattedDiffCurrent} - $${formattedPriceCurrent} (MA200=$${formattedSma200Current})`);
    }

    // --- Dados de duas segundas-feiras atrás ---
    const dayOfWeek = today.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
    // Voltar até a última segunda-feira
    const daysSinceLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - daysSinceLastMonday);
    // Voltar mais 7 dias pra chegar à segunda segunda-feira atrás
    const targetDate = new Date(lastMonday);
    targetDate.setDate(lastMonday.getDate() - 7);
    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setDate(targetDate.getDate() + 1); // Dia seguinte pra criar um intervalo

    // Formatar as datas no formato YYYY-MM-DD
    const targetDateStr = targetDate.toISOString().split('T')[0]; // Ex.: 2025-05-12
    const targetDateEndStr = targetDateEnd.toISOString().split('T')[0]; // Ex.: 2025-05-13

    // Formatar a data pro título do post
    const formattedDate = dateFormatter.format(targetDate); // Ex.: May 12, 2025

    // Buscar dados financeiros usando Yahoo Finance
    const etfData = [];
    for (const symbol of etfs) {
      // Buscar preços históricos do dia alvo
      const historicalData = await yahooFinance.historical(symbol, {
        period1: targetDateStr,
        period2: targetDateEndStr,
        interval: '1d'
      });

      if (!historicalData || historicalData.length === 0) {
        throw new Error(`No data found for ${symbol} on ${targetDateStr}`);
      }

      // Obter o preço mais baixo do dia
      const lowestPrice = historicalData[0].low;

      // Buscar dados históricos pra calcular o 200-DMA (últimos 300 dias pra garantir 200 dias úteis)
      const endDate = new Date(targetDateStr);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 300); // Pegar 300 dias pra garantir 200 dias úteis

      const historicalForSma = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: targetDateStr,
        interval: '1d'
      });

      if (historicalForSma.length < 200) {
        throw new Error(`Not enough data to calculate 200-DMA for ${symbol}`);
      }

      // Calcular o 200-DMA
      const last200Days = historicalForSma.slice(-200);
      const sma200 = last200Days.reduce((sum, day) => sum + day.close, 0) / 200;

      // Calcular a diferença percentual
      const percentageDiff = ((lowestPrice - sma200) / sma200) * 100;

      // Formatar o resultado
      const icon = percentageDiff < 0 ? '✔' : '✘';
      const formattedDiff = percentageDiff >= 0 ? `+${percentageDiff.toFixed(2)}%` : `${percentageDiff.toFixed(2)}%`;
      const formattedPrice = lowestPrice.toFixed(2);
      const formattedSma200 = sma200.toFixed(2);

      etfData.push(`${icon} - ${symbol} - ${formattedDiff} - $${formattedPrice} (MA200=$${formattedSma200})`);
    }

    // Construir o tweet com as duas seções
    const currentSection = `ETF Analysis today (${formattedToday}):\n${currentData.join('\n')}\n\n`;
    const historicalSection = `ETF Analysis (Two Mondays Ago - ${formattedDate})\nLowest Prices:\n${etfData.join('\n')}`;
    const tweetText = `${currentSection}${historicalSection}`;

    return { success: true, tweetText };
  } catch (error) {
    console.error('Error fetching financial data in analyzeETFs:', error);
    return { success: false, message: 'Error fetching financial data: ' + error.message };
  }
};

module.exports = analyzeETFs;
export default async function handler(request, response) {
  // Configuração de CORS para permitir chamadas do seu site
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*'); // Em produção, substitua '*' pelo seu domínio
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Trata requisição OPTIONS (preflight do browser)
  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  // Apenas aceita POST
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.BLACKCAT_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ error: 'Server misconfiguration: API Key missing' });
  }

  try {
    // Encaminha a requisição para a BlackCat
    const externalResponse = await fetch('https://api.blackcatpagamentos.online/api/sales/create-sale', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      // Repassa o corpo da requisição que veio do front-end
      body: JSON.stringify(request.body)
    });

    const data = await externalResponse.json();

    // Retorna a resposta da BlackCat para o front-end
    return response.status(externalResponse.status).json(data);

  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}

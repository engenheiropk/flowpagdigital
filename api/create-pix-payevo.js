export default async function handler(request, response) {
  // Configuração de CORS
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
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

  const secretKey = process.env.PAYEVO_SECRET_KEY;

  if (!secretKey) {
    return response.status(500).json({ error: 'Server misconfiguration: PayEvo API Key missing' });
  }

  try {
    const body = request.body;

    // Monta o payload no formato PayEvo
    const payevoPayload = {
      amount: body.amount,
      paymentMethod: 'PIX',
      description: body.items?.[0]?.title || 'Pagamento PIX',
      customer: {
        name: body.customer?.name || 'Cliente',
        email: body.customer?.email || 'cliente@pedagiodigital.com.br',
        phone: body.customer?.phone || '11999999999'
      },
      items: (body.items || []).map(item => ({
        title: item.title || 'Pagamento',
        unitPrice: item.unitPrice,
        quantity: item.quantity || 1,
        externalRef: body.externalRef || item.title || 'PIX'
      }))
    };

    // Basic Auth: base64 encode da secret key
    const authToken = Buffer.from(secretKey).toString('base64');

    const externalResponse = await fetch('https://apiv2.payevo.com.br/functions/v1/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + authToken
      },
      body: JSON.stringify(payevoPayload)
    });

    const data = await externalResponse.json();

    // Normaliza a resposta da PayEvo para o mesmo formato que a BlackCat
    // PayEvo retorna: data.pix.qrcode, data.pix.expirationDate
    if (data && data.id && data.pix) {
      return response.status(200).json({
        success: true,
        data: {
          transactionId: data.id,
          paymentData: {
            qrCodeBase64: null,
            qrCode: data.pix.qrcode || '',
            copyPaste: data.pix.qrcode || '',
            expiresAt: data.pix.expirationDate || null
          }
        }
      });
    }

    // Se a PayEvo retornou erro ou formato inesperado
    if (data && data.error) {
      return response.status(externalResponse.status).json({
        success: false,
        message: data.error.message || data.error || 'Erro ao processar pagamento via PayEvo'
      });
    }

    // Fallback: retorna o que veio da PayEvo com flag de erro
    return response.status(externalResponse.status).json({
      success: false,
      message: 'Resposta inesperada da PayEvo',
      raw: data
    });

  } catch (error) {
    console.error('Erro ao processar pagamento PayEvo:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UMBLER_TOKEN = process.env.UMBLER_TOKEN;
const ORGANIZATION_ID = process.env.ORGANIZATION_ID;
const FROM_PHONE = process.env.FROM_PHONE;

app.post('/webhook', async (req, res) => {
  try {
    const mensagem = req.body?.chat?.message;
    const numero = req.body?.contact?.number;

    if (!mensagem || !numero) {
      return res.status(400).json({ error: 'Mensagem ou número ausente' });
    }

    console.log(`[Webhook] Mensagem recebida de ${numero}: ${mensagem}`);

    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: mensagem }],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const respostaTexto = openaiResponse.data.choices[0].message.content.trim();

    await axios.post(
      'https://app-utalk.umbler.com/api/v1/messages/simplified/',
      {
        ToPhone: numero,
        FromPhone: FROM_PHONE,
        OrganizationId: ORGANIZATION_ID,
        Message: respostaTexto
      },
      {
        headers: {
          Authorization: `Bearer ${UMBLER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[Webhook] Resposta enviada para ${numero}: ${respostaTexto}`);
    res.sendStatus(200);

  } catch (err) {
    console.error('[Webhook] Erro ao processar:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

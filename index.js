const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UMBLER_TOKEN = process.env.UMBLER_TOKEN;
const ORGANIZATION_ID = process.env.ORGANIZATION_ID;
const FROM_PHONE = process.env.FROM_PHONE;
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT;

app.post('/webhook', async (req, res) => {
  try {
    console.log('[Webhook] Corpo recebido:', JSON.stringify(req.body, null, 2));

    const origemMensagem = req.body?.Payload?.Content?.LastMessage?.Source;
    const mensagem = req.body?.Payload?.Content?.LastMessage?.Content;
    const numero = req.body?.Payload?.Content?.Contact?.PhoneNumber;

    if (origemMensagem !== 'Contact') {
      console.log('[Webhook] Ignorando mensagem de origem:', origemMensagem);
      return res.status(200).json({ status: 'ignorado' });
    }

    if (!mensagem || !numero) {
      console.warn('[Webhook] Corpo inválido: mensagem ou número ausente');
      return res.status(400).json({ error: 'Mensagem ou número ausente' });
    }

    console.log(`[Webhook] Mensagem recebida de ${numero}: ${mensagem}`);

    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gtp-4o-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: mensagem
          }
        ],
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

    const comandos = [
      { tag: 'ACAO:FLUXO_TEMAS', fluxo: 'mensagens rápidas → catálogo de temas' },
      { tag: 'ACAO:FLUXO_LOCALIZACAO', fluxo: 'mensagens rápidas → localização' },
      { tag: 'ACAO:FLUXO_QUALIFICADO', fluxo: 'mensagens rápidas → inserir tag qualificado' },
      { tag: 'ACAO:FLUXO_FALAR_COM_HUMANO', fluxo: 'Fluxos de Sophia → Falar com humano' }
    ];

    for (const cmd of comandos) {
      if (respostaTexto.includes(cmd.tag)) {
        console.log(`[Webhook] Acionando fluxo: ${cmd.fluxo}`);

        await axios.post(
          'https://app-utalk.umbler.com/api/v1/flows/start',
          {
            ToPhone: numero,
            FromPhone: FROM_PHONE,
            OrganizationId: ORGANIZATION_ID,
            FlowName: cmd.fluxo
          },
          {
            headers: {
              Authorization: `Bearer ${UMBLER_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return res.status(200).json({ status: `fluxo ${cmd.fluxo} acionado` });
      }
    }

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
    res.status(200).json({ reply: respostaTexto });

  } catch (err) {
    console.error('[Webhook] Erro ao processar:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'
import express from 'express'
import QRCode from 'qrcode'

const app = express()
app.use(express.json())

let sock
let qrCodeData = null

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update

    if (qr) {
      qrCodeData = await QRCode.toDataURL(qr)
      console.log('QR GERADO')
    }

    if (connection === 'close') {
      console.log('CONEXAO FECHADA, TENTANDO NOVAMENTE...')
      startSock()
    }

    if (connection === 'open') {
      console.log('WHATSAPP CONECTADO')
    }
  })

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0]
    if (!msg.message) return

    const phone = msg.key.remoteJid.replace('@s.whatsapp.net', '')
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    if (!text) return

    // Envia mensagem recebida para o HelpSanfer
    await fetch('https://qrcodes-connect.lovable.app/api/whatsapp/incoming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message: text })
    })
  })
}

startSock()

// Endpoint para mostrar QR no navegador
app.get('/qr', (req, res) => {
  if (!qrCodeData) return res.send('QR ainda não disponível')
  res.send(`<img src="${qrCodeData}" />`)
})

// Endpoint para enviar mensagens (usado pelo HelpSanfer)
app.post('/send', async (req, res) => {
  const { phone, message } = req.body
  await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message })
  res.send({ ok: true })
})

app.listen(3000, () => console.log('NODE WHATSAPP RODANDO NA PORTA 3000'))

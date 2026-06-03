const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKUP_FILE = path.join(__dirname, 'chat_privado.json');

// 🔐 CONFIGURA TU CONTRASEÑA AQUÍ (Dísela también a tu amiga)
const CLAVE_SECRETA = "tu_clave_segura_123"; 

let chatPrivado = [];

if (fs.existsSync(BACKUP_FILE)) {
    try {
        chatPrivado = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    } catch (err) {
        console.error("❌ Error al cargar el historial privado");
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔒 Servidor Privado Protegido en puerto ${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    // No enviamos nada al conectar hasta que se verifique la clave

    ws.on('message', (data) => {
        try {
            const paquete = JSON.parse(data.toString());

            // Validar contraseña en cada acción
            if (paquete.clave !== CLAVE_SECRETA) {
                ws.send(JSON.stringify({ type: 'error', texto: 'Clave incorrecta' }));
                return;
            }

            // Si el usuario se está logueando, le mandamos el historial
            if (paquete.type === 'login') {
                ws.send(JSON.stringify({ type: 'history', data: chatPrivado }));
                return;
            }

            // Si es un mensaje nuevo
            if (paquete.type === 'msg') {
                const nuevoMensaje = {
                    remitente: paquete.nombre,
                    texto: paquete.texto,
                    fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                chatPrivado.push(nuevoMensaje);
                if (chatPrivado.length > 50) chatPrivado.shift();

                // Guardar copia de seguridad
                fs.writeFileSync(BACKUP_FILE, JSON.stringify(chatPrivado, null, 2));

                // Reenviar a todos los que estén conectados
                wss.clients.forEach(client => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ type: 'msg', data: nuevoMensaje }));
                    }
                });
            }

        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', texto: 'Formato inválido' }));
        }
    });
});

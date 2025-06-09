const fs = require('fs');
const path = require('path');
require('dotenv').config();

const rutaTareas = path.join(__dirname, 'tareas.json');



// Función para guardar las tareas en el archivo JSON
function guardarTareas() {
  fs.writeFileSync(rutaTareas, JSON.stringify(tareas, null, 2));
}

// Función para cargar las tareas al iniciar
function cargarTareas() {
  if (fs.existsSync(rutaTareas)) {
    const data = fs.readFileSync(rutaTareas);
    tareas = JSON.parse(data);
    if (tareas.length > 0) {
      id = Math.max(...tareas.map(t => t.id)) + 1; // Para continuar los IDs
    }
  }
}


const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

// Token y chatId
const token = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  console.log('Chat ID:', msg.chat.id);
});

// Estructura para almacenar tareas
let tareas = [];
let id = 1;

// Comando para agregar tarea con prioridad, tipo y fecha
bot.onText(/\/recordar (.+)/, (msg, match) => {
  const userChatId = msg.chat.id;
  const input = match[1];

  const regex = /(.*) prioridad (alta|media|baja)( tipo (personal|trabajo))?( el (\d{4}-\d{2}-\d{2} \d{2}:\d{2}))?/i;
  const resultado = input.match(regex);

  if (!resultado) {
    bot.sendMessage(userChatId, 'Usá el formato:\n/recordar [tarea] prioridad [alta/media/baja] tipo [personal/trabajo] el [AAAA-MM-DD HH:MM]');
    return;
  }

  const tarea = resultado[1].trim();
  const prioridad = resultado[2].toLowerCase();
  const tipo = resultado[4] || 'general';
  const fechaTexto = resultado[6];
  const fecha = fechaTexto ? new Date(fechaTexto) : null;

  tareas.push({ id: id++, tarea, prioridad, tipo, hecha: false, fecha });

  function enviarListaPendientes(chatId) {
  const pendientes = tareas
    .filter(t => !t.hecha)
    .sort((a, b) => {
      const orden = { alta: 1, media: 2, baja: 3 };
      return orden[a.prioridad] - orden[b.prioridad];
    });

  if (pendientes.length === 0) {
    bot.sendMessage(chatId, 'No tenés tareas pendientes. ¡Buen trabajo!');
    return;
  }

  let lista = '📋 Tareas pendientes:\n';
  pendientes.forEach(t => {
    lista += `${t.id}. [${t.prioridad.toUpperCase()}] ${t.tarea} (${t.tipo})\n`;
  });

  bot.sendMessage(chatId, lista);
}


  guardarTareas();



  bot.sendMessage(userChatId, `✅ Tarea agregada: "${tarea}" [${prioridad}] tipo: ${tipo}${fecha ? ` (te recordará el ${fechaTexto})` : ''}`);

  if (fecha && fecha > new Date()) {
    const delay = fecha.getTime() - Date.now();

    setTimeout(() => {
      bot.sendMessage(userChatId, `⏰ Recordatorio: "${tarea}" [${prioridad.toUpperCase()}]`);
    }, delay);
  }
});

// Comando para listar tareas pendientes
bot.onText(/\/pendientes/, (msg) => {
  const userChatId = msg.chat.id;

  const pendientes = tareas
    .filter(t => !t.hecha)
    .sort((a, b) => {
      const orden = { alta: 1, media: 2, baja: 3 };
      return orden[a.prioridad] - orden[b.prioridad];
    });

  if (pendientes.length === 0) {
    bot.sendMessage(userChatId, 'No tenés tareas pendientes. ¡Buen trabajo!');
    return;
  }

  let lista = '📋 Tareas pendientes:\n';
  pendientes.forEach(t => {
    lista += `${t.id}. [${t.prioridad.toUpperCase()}] ${t.tarea} (${t.tipo})\n`;
  });

  bot.sendMessage(userChatId, lista);
});

// Comando para marcar como hecha
bot.onText(/\/hecho (\d+)/, (msg, match) => {
  const userChatId = msg.chat.id;
  const idTarea = parseInt(match[1]);

  const tarea = tareas.find(t => t.id === idTarea);

  if (!tarea) {
    bot.sendMessage(userChatId, `No encontré tarea con id ${idTarea}`);
    return;
  }

  tarea.hecha = true;
  guardarTareas();

  bot.sendMessage(userChatId, `✔️ Marcaste la tarea "${tarea.tarea}" como hecha.`);
});


// Comando para limpiar tareas hechas
bot.onText(/^\/limpiar_hechas$/, (msg) => {
  const userChatId = msg.chat.id;

  const inicialCount = tareas.length;
  tareas = tareas.filter(t => !t.hecha);
  const eliminadas = inicialCount - tareas.length;

  guardarTareas();

  bot.sendMessage(userChatId, `🧹 Se eliminaron ${eliminadas} tareas hechas del historial.`);

    console.log('Comando /limpiar_hechas recibido');

});


// Recordatorio general todos los días a las 9 am
cron.schedule('0 9 * * *', () => {
  const pendientes = tareas.filter(t => !t.hecha);

  if (pendientes.length === 0) return;

  let mensaje = '⏰ Recordatorio diario - Tareas pendientes:\n';
  pendientes.forEach(t => {
    mensaje += `- [${t.prioridad.toUpperCase()}] ${t.tarea} (${t.tipo})\n`;
  });

  bot.sendMessage(chatId, mensaje);
});

cargarTareas();


bot.onText(/\/ayuda|\/help/, (msg) => {
  const userChatId = msg.chat.id;
  const textoAyuda =
    `<b>🤖 Comandos disponibles:</b>\n\n` +
    `<code>/recordar [tarea] prioridad [alta/media/baja] tipo [personal/trabajo] el [AAAA-MM-DD HH:MM]</code>\n` +
    `Agrega una nueva tarea.\n` +
    `Ejemplo:\n` +
    `<code>/recordar Comprar pan prioridad alta tipo personal el 2025-06-06 09:00</code>\n\n` +
    `<code>/pendientes</code>\n` +
    `Muestra la lista de tareas pendientes.\n\n` +
    `<code>/hecho [id]</code>\n` +
    `Marca una tarea como hecha.\n` +
    `Ejemplo:\n` +
    `<code>/hecho 2</code>\n\n` +
    `<code>/limpiar_hechas</code>\n` +
    `Elimina todas las tareas marcadas como hechas.\n\n` +
    `<code>/ayuda</code> o <code>/help</code>\n` +
    `Muestra este mensaje de ayuda.`;
  bot.sendMessage(userChatId, textoAyuda, { parse_mode: 'HTML' });
});

console.log('Bot funcionando...');

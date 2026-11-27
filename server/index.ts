import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../src/game/types';
import { RoomManager } from './room';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const MAX_PAYLOAD_BYTES = 4096;
const MAX_MSGS_PER_SEC = 120;

const rooms = new RoomManager();

function sendJson(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ status: 'ok', service: 'mobile-piston-ws', rooms: rooms.roomCount }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  let activePlayerId = randomUUID().slice(0, 8);
  let windowStart = Date.now();
  let msgCount = 0;
  const send = (msg: ServerMessage) => sendJson(socket, msg);

  send({ type: 'welcome', playerId: activePlayerId });

  socket.on('message', (rawData) => {
    const rawStr = rawData.toString();
    if (rawStr.length > MAX_PAYLOAD_BYTES) {
      send({ type: 'error', message: 'Ukuran paket terlalu besar.' });
      return;
    }

    const now = Date.now();
    if (now - windowStart >= 1000) {
      windowStart = now;
      msgCount = 0;
    }
    msgCount += 1;
    if (msgCount > MAX_MSGS_PER_SEC) {
      return;
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(rawStr) as ClientMessage;
    } catch {
      send({ type: 'error', message: 'Format pesan tidak valid.' });
      return;
    }

    switch (msg.type) {
      case 'ping':
        send({ type: 'pong', sentAt: msg.sentAt, serverTime: Date.now() });
        break;
      case 'create_room':
        rooms.createRoom(activePlayerId, msg.name, msg.carId, msg.colorIndex, msg.trackId, send);
        break;
      case 'join_room': {
        const res = rooms.joinRoom(msg.roomCode, activePlayerId, msg.name, msg.carId, msg.colorIndex, send);
        if (!res.ok) {
          send({ type: 'error', message: res.error });
        }
        break;
      }
      case 'rejoin_room': {
        const res = rooms.rejoinRoom(msg.roomCode, msg.playerId, send);
        if (res.ok) {
          activePlayerId = msg.playerId;
          send({ type: 'welcome', playerId: activePlayerId });
        } else {
          send({ type: 'error', message: res.error });
        }
        break;
      }
      case 'update_loadout':
        rooms.getRoomForPlayer(activePlayerId)?.updateLoadout(activePlayerId, msg.carId, msg.colorIndex, msg.name);
        break;
      case 'set_track':
        rooms.getRoomForPlayer(activePlayerId)?.setTrack(activePlayerId, msg.trackId);
        break;
      case 'set_laps':
        rooms.getRoomForPlayer(activePlayerId)?.setLaps(activePlayerId, msg.totalLaps);
        break;
      case 'set_weather':
        rooms.getRoomForPlayer(activePlayerId)?.setWeather(activePlayerId, msg.weather);
        break;
      case 'set_ready':
        rooms.getRoomForPlayer(activePlayerId)?.setReady(activePlayerId, msg.ready);
        break;
      case 'start_race': {
        const room = rooms.getRoomForPlayer(activePlayerId);
        if (room) {
          const started = room.startRace(activePlayerId, true);
          if (!started) {
            send({ type: 'error', message: 'Hanya host yang dapat memulai balapan dari lobby.' });
          }
        }
        break;
      }
      case 'input':
        rooms.getRoomForPlayer(activePlayerId)?.handleInput(activePlayerId, msg.seq, msg.input, msg.inputs);
        break;
      default:
        send({ type: 'error', message: 'Tipe pesan tidak dikenali.' });
    }
  });

  socket.on('close', () => {
    rooms.handleDisconnect(activePlayerId);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Mobile Piston WebSocket server listening on http://${HOST}:${PORT}`);
});

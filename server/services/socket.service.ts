import { Server as HttpServer } from 'http';
import { Socket, Server as SocketServer } from 'socket.io';
import { DataService } from './data.service';

export class SocketService {
  public static io: SocketServer;

  public static async init(server: HttpServer): Promise<void> {
    this.io = new SocketServer(server, {
      cors: { origin: process.env.clientOrigin || '*' },
    });

    this.io.sockets.on('connection', (socket: Socket) => {
      // ================================
      // ==== CLIENT-SERVER EXCHANGE ====
      // ================================
      socket.data.ip = ((socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0] || socket.handshake.address)?.replace(
        '::ffff:',
        ''
      );
      console.log('═╦═ IP ' + socket.data.ip + ' has connected to the server');

      socket.on('SocketStarted', () => {
        socket.emit('ClientInit');
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });

      // ================================
      // ==== APPLICATIONS ====
      // ================================
      socket.on('getAllApplis', () => {
        socket.emit('GetAllApplis', DataService.getAllApplis());
      });
    });
  }
}

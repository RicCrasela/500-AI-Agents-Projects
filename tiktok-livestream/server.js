const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store active livestreams
const activeStreams = new Map();
const streamViewers = new Map();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Start livestream
    socket.on('start-stream', (data) => {
      const { streamId, userId, username, title } = data;
      activeStreams.set(streamId, {
        streamId,
        userId,
        username,
        title,
        startTime: Date.now(),
        viewers: 0,
        likes: 0,
        hostSocketId: socket.id
      });
      streamViewers.set(streamId, new Set());
      socket.join(`stream-${streamId}`);
      io.emit('stream-started', activeStreams.get(streamId));
      console.log('Stream started:', streamId);
    });

    // Join livestream
    socket.on('join-stream', (data) => {
      const { streamId, userId, username } = data;
      socket.join(`stream-${streamId}`);
      
      if (streamViewers.has(streamId)) {
        streamViewers.get(streamId).add(socket.id);
        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.viewers = streamViewers.get(streamId).size;
          io.to(`stream-${streamId}`).emit('viewer-count', stream.viewers);
        }
      }
      
      socket.to(`stream-${streamId}`).emit('user-joined', { userId, username });
      console.log(`User ${username} joined stream ${streamId}`);
    });

    // Leave livestream
    socket.on('leave-stream', (data) => {
      const { streamId } = data;
      socket.leave(`stream-${streamId}`);
      
      if (streamViewers.has(streamId)) {
        streamViewers.get(streamId).delete(socket.id);
        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.viewers = streamViewers.get(streamId).size;
          io.to(`stream-${streamId}`).emit('viewer-count', stream.viewers);
        }
      }
    });

    // End livestream
    socket.on('end-stream', (data) => {
      const { streamId } = data;
      io.to(`stream-${streamId}`).emit('stream-ended');
      activeStreams.delete(streamId);
      streamViewers.delete(streamId);
      io.emit('stream-list-updated', Array.from(activeStreams.values()));
      console.log('Stream ended:', streamId);
    });

    // Send comment
    socket.on('send-comment', (data) => {
      const { streamId, userId, username, comment, timestamp } = data;
      io.to(`stream-${streamId}`).emit('new-comment', {
        userId,
        username,
        comment,
        timestamp
      });
    });

    // Send like
    socket.on('send-like', (data) => {
      const { streamId, userId, username } = data;
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.likes += 1;
        io.to(`stream-${streamId}`).emit('new-like', {
          userId,
          username,
          totalLikes: stream.likes
        });
      }
    });

    // Send gift
    socket.on('send-gift', (data) => {
      const { streamId, userId, username, giftType, giftValue } = data;
      io.to(`stream-${streamId}`).emit('new-gift', {
        userId,
        username,
        giftType,
        giftValue,
        timestamp: Date.now()
      });
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
      const { streamId, offer } = data;
      socket.to(`stream-${streamId}`).emit('offer', { offer, from: socket.id });
    });

    socket.on('answer', (data) => {
      const { streamId, answer, to } = data;
      io.to(to).emit('answer', { answer, from: socket.id });
    });

    socket.on('ice-candidate', (data) => {
      const { streamId, candidate, to } = data;
      if (to) {
        io.to(to).emit('ice-candidate', { candidate, from: socket.id });
      } else {
        socket.to(`stream-${streamId}`).emit('ice-candidate', { candidate, from: socket.id });
      }
    });

    // Get active streams
    socket.on('get-streams', () => {
      socket.emit('stream-list', Array.from(activeStreams.values()));
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      // Check if user was hosting a stream
      for (const [streamId, stream] of activeStreams.entries()) {
        if (stream.hostSocketId === socket.id) {
          io.to(`stream-${streamId}`).emit('stream-ended');
          activeStreams.delete(streamId);
          streamViewers.delete(streamId);
          io.emit('stream-list-updated', Array.from(activeStreams.values()));
        } else if (streamViewers.has(streamId)) {
          streamViewers.get(streamId).delete(socket.id);
          stream.viewers = streamViewers.get(streamId).size;
          io.to(`stream-${streamId}`).emit('viewer-count', stream.viewers);
        }
      }
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});

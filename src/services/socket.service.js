const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");

let socketIO;

const createSocketInstance = (http) => {
    const pubClient = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => console.error("Redis pub error:", err.message));
    subClient.on("error", (err) => console.error("Redis sub error:", err.message));

    socketIO = new Server(http, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Set adapter AFTER socketIO is initialized
    socketIO.adapter(createAdapter(pubClient, subClient));

    socketIO.on("connection", (socket) => {
        const uid = socket.handshake.query['uid'];
        if (!uid) {
            console.warn("Client connected without UID");
            return;
        }

        console.log("Client connected:", uid);
        socket.join(uid);

        socket.on("disconnect", () => {
            console.log("Client disconnected:", uid);
        });
    });

    return socketIO;
};

const emit = (uid, event, data) => {
    if (!socketIO) {
        console.log("No socketIO initialized");
        return;
    }
    socketIO.to(uid).emit(event, data);
};

module.exports = {
    createSocketInstance,
    emit
};

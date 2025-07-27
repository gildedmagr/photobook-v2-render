const {Server} = require("socket.io");
const {createAdapter} = require('@socket.io/redis-adapter');
const Redis = require("ioredis");


let socketIO;
const clients = {};
const createSocketInstance = (http) => {
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => {
        console.log(err.message);
    });

    subClient.on("error", (err) => {
        console.log(err.message);
    });

    socketIO = new Server(http,
        {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            adapter: createAdapter(pubClient, subClient)
        });
    socketIO.on('connection', (socket) => {
        const uid = socket.handshake.query['uid'];
        console.log('a user connected, uid: ', uid);
        clients[uid] = socket;
        socket.join(uid);
        socket.on('disconnect', (socket) => {
            delete clients[uid];
        })
    });
    return socketIO;
}

const getSocket = () => {
    return socketIO;
}

const getClient = (uid) => {
    return clients[uid];
}

const emit = (uid, event, data) => {
    if (socketIO) {
        socketIO.to(uid).emit(event, data);
    } else {
        console.log('No socketIO');
    }
}

module.exports = {
    createSocketInstance,
    getSocket,
    getClient,
    emit
}
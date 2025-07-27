const {Server} = require("socket.io");
const {createAdapter} = require('@socket.io/redis-adapter');
const Redis = require("ioredis");


let socketIO;
const clients = {};
const createSocketInstance = (http) => {
    const pubClient = new Redis();
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => {
        console.log(err.message);
    });

    subClient.on("error", (err) => {
        console.log(err.message);
    });

    socketIO = new Server({ adapter: createAdapter(pubClient, subClient)});
    socketIO.on('connection', (socket) => {
        const uid = socket.handshake.query['uid'];
        console.log('a user connected, uid: ', uid);
        clients[uid] = socket;
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
    if (clients[uid]) {
        clients[uid].emit(event, data);
    } else {
        console.log('No client with uid ', uid);
    }
}

module.exports = {
    createSocketInstance,
    getSocket,
    getClient,
    emit
}
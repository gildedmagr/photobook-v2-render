const {Server} = require("socket.io");
let socketIO;
const clients = {};
const createSocketInstance = (http) => {
    socketIO = new Server(http, {cors: {origin: "*"}});
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
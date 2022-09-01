const {renderPolaroid, testRender} = require('./polaroid.service');
const socketService = require('./socket.service');

module.exports = {
    renderPolaroid,
    testRender,
    ...socketService
}
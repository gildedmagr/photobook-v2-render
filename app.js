const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const http = require('http').createServer(app);
const route = require('./src/routes');
const {socketService} = require('./src/services');
const {createAdapter} = require('@socket.io/redis-adapter');
const {createClient} = require('redis');

const io = socketService.createSocketInstance(http);
const pubClient = createClient({url: 'redis://redis:6379'});
const subClient = pubClient.duplicate();

pubClient.connect();
subClient.connect();
io.adapter(createAdapter(pubClient, subClient));

const port = process.env.PORT || 3000;

app.use(cors({
    origin: '*'
}));


app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

app.use(route);
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname);


http.listen(port, '0.0.0.0', () => {
    console.log(`Render is running at http://localhost:${port}`)
});
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const http = require('http').createServer(app);
const route = require('./src/routes');
const {createSocketInstance} = require('./src/services');

const io = createSocketInstance(http);

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

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

http.listen(port, '0.0.0.0', () => {
    console.log(`Render is running at http://localhost:${port}`)
});
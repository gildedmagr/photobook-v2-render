const renderService = require('../services/polaroid.service');

const healthStatus = (req, res, next) => {
    res.json({'healthy': true});
}

const createPreview = async (req, res, next) => {
    try {
        const domain = req.query.domain;
        const uid = req.query.uid;
        const pages = req.query.pages;
        const isUserPreview = Boolean(req.query.userPreview);
        const width = req.query.width;
        const height = req.query.height;
        console.log(isUserPreview);
        if(isUserPreview){
            renderService.createPreview(domain, uid, pages, width, height);
            return res.json({'status': 'launched'});
        }
        const result = await renderService.createPreview(domain, uid, pages, width, height);
        res.json(result);
    } catch (err) {
        console.error(`Error while getting programming languages`, err.message);
        next(err);
    }
}

const renderBook = async (req, res, next) => {
    try {
        const domain = req.query.domain;
        const uid = req.query.uid;
        const pages = req.query.pages;
        const isUserPreview = Boolean(req.query.userPreview);
        const width = req.query.width;
        const height = req.query.height;
        console.log(isUserPreview);
        if(!isUserPreview){
            const result = await renderService.startRender(domain, uid, pages, width, height);
            res.json(result);
        }else{
            res.json([]);
        }
    } catch (err) {
        console.error(`Error while getting programming languages`, err.message);
        next(err);
    }
}

module.exports = {
    healthStatus,
    createPreview,
    renderBook
}
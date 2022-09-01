const {renderService} = require('../services');

const healthStatus = (req, res, next) => {
    res.json({'healthy': true});
}

const createPreview = async (req, res, next) => {
    try {
        const domain = req.query.domain;
        const uid = req.query.uid;
        const pages = req.query.pages;
        const isUserPreview = (req.query.userPreview || '').toLowerCase() === 'true';
        const width = req.query.width;
        const height = req.query.height;

        if (isUserPreview) {
            renderService.createPreview(domain, uid, pages, width, height).then(r => {
                console.log('Preview has been created');
            }).catch(e => {
                console.log(e);
            });
            return res.json({'status': 'launched'});
        }

        const result = await renderService.create3DPreviewPages(domain, uid, pages, width, height);
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
        const width = req.query.width;
        const height = req.query.height;
        const redirectUrl = req.query.redirectUrl;
        if(redirectUrl){
            console.log(`Start rendering in background mode, uid: ${uid}, domain: ${domain}`);
            renderService.startRender(domain, uid, pages, width, height).then(() => {});
            return res.render('public/redirect', {redirectUrl});
        }
        console.log(`Start rendering, uid: ${uid}, domain: ${domain}`);
        const result = await renderService.startRender(domain, uid, pages, width, height);
        res.json(result);
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
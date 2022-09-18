const puppeteer = require("puppeteer");
const placeholdify = require('placeholdify');
const fs = require('fs');
const {Image} = require('image-js');
const socketService = require("./socket.service");
const {minimal_args} = require("../utils");

const renderPage = 'https://{0}/index.php?route=photobook/photobook/renderPage&uid={1}&page={2}&width={3}&height={4}&isFullRender={5}';
const domains = fs.readFileSync(process.env.DOMAINS_DICT_PATH || 'domains.json');
const domainsMap = JSON.parse(domains);
const isProd = process.env.NODE_ENV === 'production';
const BROWSER_TIMEOUT = 5 * 60 * 1000;

/**
 * Render full pages
 *
 * @param domain
 * @param uid
 * @param totalPages
 * @param width
 * @param height
 * @param withBorder
 * @returns {Promise<{images: *[], pages, time: string, status: string}>}
 */
const startRender = async (domain, uid, totalPages, width, height, withBorder) => {
    const start = Date.now();
    const relativePath = `image/photobook/renders/${uid}`;
    const destinationPath = `${domainsMap[domain]}/${relativePath}`;
    const links = [];
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, {recursive: true});
    }
    const additionalBorderWidth = 100;
    const bookWidth = parseInt(width);
    const bookHeight = parseInt(height);
    const browserWidth = bookWidth + (withBorder ? additionalBorderWidth * 2 : 0);
    const browserHeight = bookHeight + (withBorder ? additionalBorderWidth : 0);
    console.log(browserWidth, browserHeight);
    const browser = await puppeteer.launch(
        {
            executablePath: isProd ? '/usr/bin/google-chrome' : '',
            headless: true,
            ignoreHTTPSErrors: true,
            args: [...minimal_args, `--window-size=${browserWidth},${browserHeight}`],
            dumpio: false,
            userDataDir: '/tmp',
            defaultViewport: {
                width: browserWidth,
                height: browserHeight
            }
        }
    );

    let copies = 1;

    const page = await browser.newPage();
    let coverExtraWidth = 0;
    page.on('console', msg => {
        const message = msg.text();
        if (message.startsWith('COVER_EXTRA:')) {
            coverExtraWidth = parseInt(msg.text().replace('COVER_EXTRA:', '') || 0);
        }
    });


    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {

        const url = placeholdify(renderPage, domain, uid, currentPage - 1, bookWidth, bookHeight, true);
        console.log(`Going to create snapshot from: ${url}`);


        const destFile = `${destinationPath}/${currentPage}.jpg`;
        await page.goto(url);

        await page.setViewport({
            width: browserWidth + coverExtraWidth,
            height: browserHeight
        });

        await page.screenshot({
            path: destFile,
            type: 'jpeg',
            quality: 100
        });
        console.log('Snapshot has been created');
        links.push(`https://${domain}/${relativePath}/${uid}/${currentPage}.jpg`);
    }
    await page.close();
    await browser.close();

    const end = Date.now();
    console.log(`Time Taken to execute = ${(end - start) / 1000} seconds`);

    return {'status': 'completed', 'pages': totalPages, 'images': links, 'time': `${(end - start) / 1000}`};
}

/**
 * Generate page renders for 3D preview
 *
 * @param domain
 * @param uid
 * @param totalPages
 * @param width
 * @param height
 * @returns {Promise<{data: *[]}>}
 */
const create3DPreviewPages = async (domain, uid, totalPages, width, height) => {
    const multiplier = 1;
    const browserWidth = parseInt(width);
    const browserHeight = parseInt(height);
    const relativePath = `image/photobook/snapshots/${uid}`;
    const destinationPath = `${domainsMap[domain]}/${relativePath}`;
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, {recursive: true});
    }else {
        fs.readdirSync(destinationPath).forEach(f => {
            const lstat = fs.lstatSync(`${destinationPath}/${f}`);
            if (lstat.isFile()) {
                fs.rmSync(`${destinationPath}/${f}`);
            }
        });
    }
    return ['ok'];

    const browser = await puppeteer.launch(
        {
            executablePath: isProd ? '/usr/bin/google-chrome' : '',
            headless: true,
            ignoreHTTPSErrors: true,
            args: [...minimal_args, `--window-size=${browserWidth},${browserHeight}`],
            dumpio: false,
            userDataDir: '/tmp',
            defaultViewport: {
                width: browserWidth,
                height: browserHeight
            }
        }
    );

    const page = await browser.newPage();
    let viewPortWidth = browserWidth;
    let coverExtraWidth = 0;
    page.on('console', msg => {
        const message = msg.text();
        if (message.startsWith('COVER_EXTRA:')) {
            coverExtraWidth = parseInt(msg.text().replace('COVER_EXTRA:', '') || 0);
        }
    });

    const resultLinks = [];
    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {

        const url = placeholdify(renderPage, domain, uid, currentPage - 1, browserWidth, browserHeight, false);
        console.log(`Going to create snapshot from: ${url}`);

        const destFile = `${destinationPath}/full-${currentPage}.jpg`;
        //await page.waitForNavigation({waitUntil: 'networkidle2'})
        await page.goto(url, {
            timeout: BROWSER_TIMEOUT,
            waitUntil: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2']
        });
        console.log('page loaded')
        await page.setViewport({
            width: viewPortWidth + coverExtraWidth,
            height: browserHeight
        });

        const b64string = await page.screenshot({
            path: destFile,
            // encoding: "base64",
            type: 'jpeg',
            quality: 100
        });
        console.log('Snapshot has been created');
        let image = await Image.load(destFile);
        //let image = await Image.fromCanvas(imageData);
        let borderSize = currentPage === 1 ? Math.round((viewPortWidth + coverExtraWidth) / 100 * 3) : Math.round(image.height - image.height / 1.02040);
        let number = currentPage - 2 + currentPage;

        // if cover is rendering
        if (currentPage === 1) {
            await createCoverPages(image, viewPortWidth, browserHeight, destinationPath, borderSize, totalPages, coverExtraWidth);
        } else {
            await createPages(number, totalPages, image, borderSize, viewPortWidth, browserHeight, destinationPath);
        }


        resultLinks.push(`/${relativePath}/${number + 1}.jpg`);
        resultLinks.push(`/${relativePath}/${number + 2}.jpg`);
        // calculate progress
        const progress =  Math.round(100 / totalPages * currentPage);
        // send progress to connected socket
        socketService.emit(uid, 'progress', progress);
    }
    await page.close();

    await browser.close();

    console.time("bend")
    await bendFirstPageValve(destinationPath);
    await bendSecondLastPageValve(totalPages, destinationPath);
    console.log('Border created');
    console.timeEnd("bend")
    deleteTmpFiles(destinationPath, totalPages);
    return {data: resultLinks}
}



// slice and save cover pages
const createCoverPages = async (image, width, height, destinationPath, borderSize, totalPages, coverExtraWidth) => {
    // create left part of cover
    let coverLeft = image.clone().crop({
        x: 0,
        y: 0,
        width: width / 2,
        height: height
    })


    // create right part of cover
    let coverRight = image.clone();
    // if there is no extra cover width crop it as regular
    if(!coverExtraWidth){
        coverRight = coverRight.crop({
            x: width / 2,
            y: 0,
            width: width / 2,
            height: height
        });
    }
    // if there is extra width - crop it eliminating central part of cover
    if(coverExtraWidth){
        coverRight = coverRight.crop({
            x: (coverExtraWidth + width) - Math.round(width / 2),
            y: 0,
            width: width / 2,
            height: height
        });
    }

    await coverRight.save(`${destinationPath}/cover-right.jpg`);
    await coverLeft.save(`${destinationPath}/cover-left.jpg`);

    // remove borders(part of the cover which will be bent inside)
    coverLeft = coverLeft.crop({
        x: borderSize,
        y: borderSize,
        width: width / 2 - borderSize,
        height: height - borderSize * 2
    });
    // remove borders(part of the cover which will be bent inside)
    coverRight = coverRight.crop({
        x: 0,
        y: borderSize,
        width: width / 2 - borderSize,
        height: height - borderSize * 2
    });

    await coverRight.save(`${destinationPath}/1.jpg`);
    await coverLeft.save(`${destinationPath}/${totalPages * 2}.jpg`);
}

// slice and save regular pages
const createPages = async (number, totalPages, image, borderSize, viewPortWidth, browserHeight, destinationPath) => {
    const isSecondPage = number === 2;
    const isSecondLastPage = number + 1 === totalPages * 2 - 1;
    let leftImage = image.clone().crop({
        x: isSecondPage ? 0 : borderSize,
        y: isSecondPage ? 0 : borderSize,
        width: viewPortWidth / 2 - (isSecondPage ? 0 : borderSize),
        height: browserHeight - (isSecondPage ? 0 : borderSize * 2)
    })

    let rightImage = image.clone().crop({
        x: viewPortWidth / 2,
        y: isSecondLastPage ? 0 : borderSize,
        width: viewPortWidth / 2 - (isSecondLastPage ? 0 : borderSize),
        height: browserHeight - (isSecondLastPage ? 0 : borderSize * 2)
    });

    await leftImage.save(`${destinationPath}/${number}.jpg`);
    await rightImage.save(`${destinationPath}/${number + 1}.jpg`);
}

const deleteTmpFiles = (destinationPath, totalPages) => {
    fs.rmSync(`${destinationPath}/cover-left.jpg`);
    fs.rmSync(`${destinationPath}/cover-right.jpg`);
    for(let i = 1; i <= totalPages; i++){
        fs.rmSync(`${destinationPath}/full-${i}.jpg`);
    }
}

/**
 * Generate 2-page preview for customer's book
 *
 * @param domain
 * @param uid
 * @param totalPages
 * @param width
 * @param height
 * @returns {Promise<void>}
 */
const createPreview = async (domain, uid, totalPages, width, height) => {
    const multiplier = 1;
    const browserWidth = width * multiplier;
    const browserHeight = height * multiplier;
    const relativePath = `image/photobook/snapshots/${uid}/preview`;
    const destinationPath = `${domainsMap[domain]}/${relativePath}`;
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, {recursive: true});
    }

    const browser = await puppeteer.launch(
        {
            executablePath: isProd ? '/usr/bin/google-chrome' : '',
            headless: true,
            ignoreHTTPSErrors: true,
            args: [...minimal_args, `--window-size=${browserWidth},${browserHeight}`],
            dumpio: false,
            userDataDir: '/tmp',
            defaultViewport: {
                width: browserWidth,
                height: browserHeight
            }
        }
    );

    const page = await browser.newPage();
    let viewPortWidth = browserWidth;
    let coverExtraWidth = 0;
    page.on('console', msg => {
        const message = msg.text();
        if (message.startsWith('COVER_EXTRA:')) {
            coverExtraWidth = parseInt(msg.text().replace('COVER_EXTRA:', '') || 0);
        }
    });

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {

        const url = placeholdify(renderPage, domain, uid, currentPage - 1, browserWidth, browserHeight, false);
        console.log(`Going to create snapshot from: ${url}`);

        const destFile = `${destinationPath}/${currentPage}.jpg`;
        //await page.waitForNavigation({waitUntil: 'networkidle2'})
        await page.goto(url, {
            timeout: BROWSER_TIMEOUT,
            waitUntil: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2']
        });
        console.log('page loaded')
        await page.setViewport({
            width: viewPortWidth + coverExtraWidth,
            height: browserHeight
        });
        await page.screenshot({
            path: destFile,
            type: 'jpeg',
            quality: 100
        });

        console.log('Snapshot has been created');

    }
    await page.close();
    await browser.close();
}

const bendFirstPageValve = async (destinationPath) => {
    let firstPage = await Image.load(`${destinationPath}/2.jpg`);
    let cover = (await Image.load(`${destinationPath}/cover-right.jpg`)).resize({
        width: firstPage.width,
        height: firstPage.height
    });

    const coverWidth = cover.width;
    const coverHeight = cover.height;
    const borderSize = Math.round(coverHeight - coverHeight / 1.02040);

    const topBorder = cover.clone().crop({x: 0, y: 0, width: coverWidth, height: borderSize}).flipY();
    const leftBorder = cover.clone().crop({x: coverWidth - borderSize, y: 0, width: borderSize, height: coverHeight});
    const bottomBorder = cover.clone().crop({
        x: 0,
        y: coverHeight - borderSize,
        width: coverWidth,
        height: borderSize
    }).flipY();
    firstPage
        .insert(leftBorder)
        .insert(topBorder)
        .insert(bottomBorder, {x: 0, y: coverHeight - borderSize})
        .save(`${destinationPath}/2.jpg`)
}

const bendSecondLastPageValve = async (pagesNumber, destinationPath) => {
    let secondLastPage = await Image.load(`${destinationPath}/${pagesNumber * 2 - 1}.jpg`);
    let cover = (await Image.load(`${destinationPath}/cover-left.jpg`)).resize({
        width: secondLastPage.width,
        height: secondLastPage.height
    });
    const coverWidth = cover.width;
    const coverHeight = cover.height;
    const borderSize = Math.round(coverHeight - coverHeight / 1.02040);

    const topBorder = cover.clone().crop({x: 0, y: 0, width: coverWidth, height: borderSize}).flipY();
    const rightBorder = cover.clone().crop({x: 0, y: 0, width: borderSize, height: coverHeight});
    const bottomBorder = cover.clone().crop({
        x: 0,
        y: coverHeight - borderSize,
        width: coverWidth,
        height: borderSize
    }).flipY();

    //const image = new Image({ width: 2, height: 3, data, kind: 'RGB'});
    secondLastPage
        .insert(rightBorder, {x: coverWidth - borderSize, y: 0})
        .insert(topBorder)
        .insert(bottomBorder, {x: 0, y: coverHeight - borderSize})
        .save(`${destinationPath}/${pagesNumber * 2 - 1}.jpg`)
}

module.exports = {
    startRender,
    create3DPreviewPages,
    createPreview
}
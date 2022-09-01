const puppeteer = require("puppeteer");
const placeholdify = require('placeholdify');
const fs = require('fs');
const {Image} = require('image-js');
const { emit } = require("./index");
const {minimal_args} = require("../utils");

const renderPage = 'https://{0}/index.php?route=photobook/photobook/renderPage&uid={1}&page={2}&width={3}&height={4}';
const domains = fs.readFileSync(process.env.DOMAINS_DICT_PATH || 'domains.json');
const domainsMap = JSON.parse(domains);
const isProd = process.env.NODE_ENV === 'production';

const startRender = async (domain, uid, totalPages, width, height) => {
    const start = Date.now();
    const relativePath = `image/photobook/renders/${uid}`;
    const destinationPath = `${domainsMap[domain]}/${relativePath}`;
    const links = [];
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, {recursive: true});
    }
    const browserWidth = width;
    const browserHeight = height ;
    await (async () => {
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
        page.on('console', msg => {
            const message = msg.text();
            if (message.startsWith('copies:')) {
                copies = parseInt(msg.text().replace('copies:', ''));
            }
        });


        for (let currentPage = 1; currentPage <= totalPages; currentPage++) {

            const url = placeholdify(renderPage, domain, uid, currentPage - 1, browserWidth, browserHeight);
            console.log(`Going to create snapshot from: ${url}`);


            const destFile = `${destinationPath}/${currentPage}.jpg`;
            await page.goto(url);
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

    })();
    const end = Date.now();
    console.log(`Time Taken to execute = ${(end - start) / 1000} seconds`);

    return {'status': 'completed', 'pages': totalPages, 'images': links, 'time': `${(end - start) / 1000}`};
}

const createPreview = async (domain, uid, totalPages, width, height) => {
    const multiplier = 1;
    const browserWidth = width * multiplier;
    const browserHeight = height * multiplier;
    const relativePath = `image/photobook/snapshots/${uid}`;
    const destinationPath = `${domainsMap[domain]}/${relativePath}`;
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, {recursive: true});
    }else{
        fs.readdirSync(destinationPath).forEach(f => {
            const lstat = fs.lstatSync(`${destinationPath}/${f}`);
            if(lstat.isFile()){
                fs.rmSync(`${destinationPath}/${f}`);
            }
        });
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
    page.on('console', msg => {
        const message = msg.text();

        if (message.startsWith('width:')) {
            viewPortWidth = parseInt(msg.text().replace('width:', ''));
            console.log(viewPortWidth);
        }
    });

    const resultLinks = [];
    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {

        const url = placeholdify(renderPage, domain, uid, currentPage - 1, browserWidth, browserHeight);
        console.log(`Going to create snapshot from: ${url}`);

        const destFile = `${destinationPath}/full-${currentPage}.jpg`;
        //await page.waitForNavigation({waitUntil: 'networkidle2'})
        await page.goto(url, {
            timeout: 60000,
            waitUntil: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2']
        });
        console.log('page loaded')
        await page.setViewport({
            width: viewPortWidth,
            height: browserHeight
        });
        console.time('screenshot')
        const b64string = await page.screenshot({
            path: destFile,
           // encoding: "base64",
            type: 'jpeg',
            quality: 100
        });

        //const buffer = Buffer.from(b64string, "base64");
        console.log('Snapshot has been created');
        let image = await Image.load(destFile);
        console.timeEnd('screenshot')
        //let image = await Image.fromCanvas(imageData);
        let borderSize = currentPage === 1 ? Math.round(viewPortWidth / 100 * 3) : Math.round(image.height - image.height / 1.02040);
        //console.log(borderSize);
        let number = currentPage - 2 + currentPage;
        // crop image only if it's not second page
        // crop image if it's not second last page

        if (currentPage === 2 || number + 1 === totalPages * 2 - 1) {
            //borderSize = 0;
        }

        // if cover is rendering
        if (currentPage === 1) {
            console.time("cover")
            // create left part of cover
            let coverLeft = image.clone().crop({
                x: 0,
                y: 0,
                width: viewPortWidth / 2,
                height: browserHeight
            })


            // create right part of cover
            let coverRight = image.clone().crop({
                x: viewPortWidth / 2,
                y: 0,
                width: viewPortWidth / 2,
                height: browserHeight
            });

            await coverRight.save(`${destinationPath}/cover-right.jpg`);
            await coverLeft.save(`${destinationPath}/cover-left.jpg`);

            coverLeft = coverLeft.crop({
                x: borderSize,
                y: borderSize,
                width: viewPortWidth / 2 - borderSize,
                height: browserHeight - borderSize * 2
            });

            coverRight = coverRight.crop({
                x: 0,
                y: borderSize,
                width: viewPortWidth / 2 - borderSize,
                height: browserHeight - borderSize * 2
            });

            await coverRight.save(`${destinationPath}/1.jpg`);
            await coverLeft.save(`${destinationPath}/${totalPages * 2}.jpg`);
            console.timeEnd('cover')
        } else {
            const isSecondPage = number === 2;
            const isSecondLastPage = number + 1 === totalPages * 2 - 1;
            let leftImage = image.clone().crop({
                x: isSecondPage ? 0 : borderSize,
                y: isSecondPage ? 0 : borderSize,
                width: viewPortWidth / 2 - (isSecondPage ? 0 : borderSize ),
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

        //fs.rmSync(destFile);
        viewPortWidth = browserWidth;
        resultLinks.push(`/${relativePath}/${number + 1}.jpg`);
        resultLinks.push(`/${relativePath}/${number + 2}.jpg`);
        emit(uid, 'progress', Math.round(100 / totalPages * currentPage));
    }
    await page.close();

    await browser.close();

    console.time("bend")
    await bendFirstPageValve(destinationPath);
    await bendSecondLastPageValve(totalPages, destinationPath);
    console.log('Border created');
    console.timeEnd("bend")
    return {data: resultLinks}
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
    createPreview
}
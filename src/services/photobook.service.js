const puppeteer = require("puppeteer");
const placeholdify = require('placeholdify');
const fs = require('fs');
const {Image} = require('image-js');

const polaroidRenderPage = 'https://{0}/index.php?route=polaroid/polaroid/renderPolaroid&uid={1}&page={2}&type={3}';
const domains = fs.readFileSync(process.env.DOMAINS_DICT_PATH || 'domains.json');
const domainsMap = JSON.parse(domains);
const relativeDestinationPath = 'image/polaroid';
const isProd = process.env.NODE_ENV === 'production';

const startRender = async (domain, uid, pages, type) => {
    const start = Date.now();
    const destinationPath = `${domainsMap[domain]}/${relativeDestinationPath}/${uid}`;
    const links = [];
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, {recursive: true});
    }
    const browserWidth = type === 'polaroid' ? 2040 : 1520;
    const browserHeight = type === 'polaroid' ? 3040 : 1870;
    await (async () => {
        const browser = await puppeteer.launch(
            {
                executablePath: isProd ? '/usr/bin/google-chrome' : '',
                headless: true,
                ignoreHTTPSErrors: true,
                args: [
                    `--window-size=${browserWidth},${browserHeight}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ],
                dumpio: false,
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


        //const copies =3;
        for (let i = 0; i < pages; i++) {
            const url = placeholdify(polaroidRenderPage, domain, uid, i, type);
            console.log(`Going to create snapshot from: ${url}`);


            const destFile = `${destinationPath}/${i}.jpg`;
            await page.goto(url);
            await page.screenshot({
                path: destFile,
                type: 'jpeg',
                quality: 100
            });
            console.log('Snapshot has been created');
            if (copies > 1) {
                console.log(`Polaroid has ${copies} copies. Going to duplicate final image`);
                for (let copy = 1; copy < copies; copy++) {
                    const copyFile = `${destinationPath}/${i}_copy_${copy}.jpg`
                    fs.copyFileSync(destFile, copyFile);
                }
            }
            links.push(`https://${domain}/${relativeDestinationPath}/${uid}/${i}.jpg`);
        }
        await page.close();
        await browser.close();

    })();
    const end = Date.now();
    console.log(`Time Taken to execute = ${(end - start) / 1000} seconds`);

    return {'status': 'completed', 'pages': pages, 'images': links, 'time': `${(end - start) / 1000}`};
}

const testRender = async () => {
    const browserWidth = 1360;
    const browserHeight = 690;
    await (async () => {
        const browser = await puppeteer.launch(
            {
                executablePath: isProd ? '/usr/bin/google-chrome' : '',
                headless: true,
                ignoreHTTPSErrors: true,
                args: [
                    `--window-size=${browserWidth},${browserHeight}`,
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ],
                dumpio: false,
                defaultViewport: {
                    width: browserWidth,
                    height: browserHeight
                }
            }
        );

        const page = await browser.newPage();

        for (let i = 0; i < 11; i++) {

            const pageUrl = 'https://foto124.ru/index.php?route=photobook/photobook/renderPage&uid=xnyrdYtpuUv5hTWy&page={0}&isFullRender=true&width={1}&height={2}';
            const url = placeholdify(pageUrl, i, browserWidth, browserHeight);
            console.log(`Going to create snapshot from: ${url}`);

            const destFile = `./public/full-${i}.jpg`;
            //await page.waitForNavigation({waitUntil: 'networkidle2'})
            await page.goto(url, {
                timeout: 60000,
                waitUntil: ['load', 'domcontentloaded', 'networkidle0', 'networkidle2']
            });
            console.log('page loaded')
               await page.screenshot({
                   path: destFile,
                   type: 'jpeg',
                   quality: 100
               });
            console.log('Snapshot has been created');
            let image = await Image.load(destFile);
            let leftImage = image.clone().crop({x: 0, y: 0, width: browserWidth / 2, height: browserHeight})
            let rightImage = image.clone().crop({x: browserWidth / 2, y: 0, width: browserWidth / 2, height: browserHeight})
            await leftImage.save(`./public/${i}-left.jpg`);
            await rightImage.save(`./public/${i}-right.jpg`);
            fs.rmSync(destFile);

        }
        await page.close();

        await browser.close();

        await bendFirstPageValve();
        await bendSecondLastPageValve();
        console.log('Border created');

    })();
}

const bendFirstPageValve = async () => {
    let cover = await Image.load('./public/0-right.jpg');
    let firstPage = await Image.load('./public/1-left.jpg');

    const coverWidth = cover.width;
    const coverHeight = cover.height;
    const borderSize = (coverWidth - coverWidth / 1.02040);

    const topBorder = cover.clone().crop({x: 0, y: 0, width: coverWidth, height: borderSize}).flipY();
    const leftBorder = cover.clone().crop({x: coverWidth - borderSize, y: 0, width: borderSize, height: coverHeight});
    const bottomBorder = cover.clone().crop({x: 0, y: coverHeight - borderSize, width: coverWidth, height: borderSize}).flipY();
    firstPage
        .insert(leftBorder)
        .insert(topBorder)
        .insert(bottomBorder, {x: 0, y: coverHeight - borderSize})
        .save('./public/1-left-mod.jpg')
}

const bendSecondLastPageValve = async (pagesNumber) => {
    let cover = await Image.load('./public/0-left.jpg');
    let firstPage = await Image.load('./public/1-right.jpg');

    const coverWidth = cover.width;
    const coverHeight = cover.height;
    const borderSize = Math.round(coverWidth - coverWidth / 1.02040);

    const topBorder = cover.clone().crop({x: 0, y: 0, width: coverWidth, height: borderSize}).flipY();
    const rightBorder = cover.clone().crop({x: 0, y: 0, width: borderSize, height: coverHeight});
    const bottomBorder = cover.clone().crop({x: 0, y: coverHeight - borderSize, width: coverWidth, height: borderSize}).flipY();
    firstPage
        .insert(rightBorder, {x:  coverWidth - borderSize, y: 0})
        .insert(topBorder)
        .insert(bottomBorder, {x: 0, y: coverHeight - borderSize})
        .save('./public/1-right-mod.jpg')
}

module.exports = {
    startRender,
    testRender
}
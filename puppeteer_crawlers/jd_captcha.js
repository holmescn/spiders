const puppeteer = require('puppeteer');
const url = "https://mall.jd.com/showLicence-682675.html"

const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"',
];
puppeteer.launch({
    args,
    ignoreDefaultArgs: ["--enable-automation"],
    ignoreHTTPSErrors: true,
    headless: true,
    defaultViewport: {
        width: 1366,
        height: 768,
        deviceScaleFactor: 1.0
    }
}).then(async (browser) => {
    const page = await browser.newPage();

    await page.goto(url);

    for (let i = 0; i < 10000; i++) {
        const vc = await page.$("#verifyCodeImg");

        await vc.screenshot({
            path: `images/captcha-${i+1}.png`
        });

        if (i % 100 === 0) {
            console.log(`Captured ${i+1} images`)
            await page.reload();
        } else {
            vc.click();
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 100000) * 0.01))
        }
    }

    await browser.close();
})
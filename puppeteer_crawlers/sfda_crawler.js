const fs = require("fs");
const puppeteer = require('puppeteer');


(async (productKeyword) => {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"',
  ];

  const browser = await (puppeteer.launch({
    args,
    ignoreDefaultArgs: ["--enable-automation"],
    // 若是手动下载的chromium需要指定chromium地址, 默认引用地址为 /项目目录/node_modules/puppeteer/.local-chromium/
    //executablePath: '/Users/huqiyang/Documents/project/z/chromium/Chromium.app/Contents/MacOS/Chromium',
    // 设置超时时间
    timeout: 15000,
    // 如果是访问https页面 此属性会忽略https错误
    ignoreHTTPSErrors: true,
    // 打开开发者工具, 当此值为true时, headless总为false
    devtools: false,
    // 关闭headless模式, 不会打开浏览器
    headless: true,
    defaultViewport: {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1.0
    }
  }));

  const url = "http://app1.sfda.gov.cn/datasearchcnda/face3/dir.html?type=ylqx";
  const page = await browser.newPage();
  // const preloadFile = fs.readFileSync('./preload.js', 'utf8');
  // await page.evaluateOnNewDocument(preloadFile);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined
    })
  })

  // page.on('console', m => console.log('PAGE LOG:', m.text()));
  await page.goto(url);

  await page.waitForFunction("(document.documentElement.textContent || document.documentElement.innerText).indexOf('数据查询')")
  await page.waitForFunction("document.readyState ==='complete'")

  await page.$$eval("td > a", anchors => {
    anchors.forEach(a => {
      var t = a.text;
      if (t.indexOf("国产") >= 0 && t.indexOf("器械") >= 0 && t.indexOf("注册") >= 0) {
        console.log(t);
        a.click();
      }
    })
  });

  await page.waitFor("input[value='查询']")

  const inputElement = await page.$("input[name='COLUMN184']");
  await inputElement.type(productKeyword);
  await inputElement.press('Enter');

  await page.waitFor("#goInt")

  // Find total records number
  const total = await page.$$eval("td", tds => {
    let total = 0;
      for (let td of tds) {
        const re = /共(\d+)条$/
        if (re.test(td.textContent)) {
          total = parseInt(td.textContent.match(re)[1]);
          break;
        }
      }
      return Promise.resolve(total);
  });

  const licences = [];
  for (let i = 1; i <= total; i++) {
    // Click item
    const links = await page.$x(`//td/p/a[contains(text(),'${i}.')]`);
    for (const link of links) {
      const text = (await link.evaluate(node => node.innerText)).trim();
      if ((new RegExp(`^${i}[.]`)).test(text)) {
        console.log("CLICK: ", text);
        link.click();
        break;
      }
    }
    await page.waitForXPath("//td/div/img[@src='images/data_fanhui.gif']");

    const name2key = {
      "注册人名称": "company_name",
      "注册证编号": "licence_number",
      "产品名称": "product_name",
      "型号规格": "product_model",
      "适用范围/预期用途": "application",
      "结构及组成/主要组成成分": "composition",
      "产品储存条件及有效期": "validity",
      "注册人住所": "office_address",
      "生产地址": "production_address",
      "生产地址": "product_category",
      "产品类别": "product_category",
      "管理类别": "management_category",
      "批准日期": "approval_date",
      "有效期至": "valid_until",
      "审批部门": "approval_department",
      "其他内容": "others_remark",
      "变更情况": "charge_message",
      "备注": "remark",
    };

    // Extract info
    const licence = {};
    const trs = await page.$x("//div[@id='content']/div[@class='listmain']//tr");
    for (const tr of trs) {
      const numOfChildren = await tr.evaluate(node => node.children.length);
      if (numOfChildren === 2) {
        const name = (await tr.evaluate(node => node.children[0].textContent)).trim();
        const value = (await tr.evaluate(node => node.children[1].textContent)).trim();
        if (name2key[name]) {
          licence[name2key[name]] = value;
        }
      }
    }
    licences.push(licence);

    const backButton = await page.$x("//td/div/img[@src='images/data_fanhui.gif']");
    backButton[0].click();

    await page.waitFor("#goInt")

    if (i % 15 === 0) {
      const nextButton = await page.$x("//td/img[@src='images/dataanniu_07.gif']");
      if (nextButton.length > 0) {
        nextButton[0].click();  

        // 等 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  fs.writeFileSync(`${productKeyword}.json`, JSON.stringify(licences, null, 2));

  browser.close();
})("额温枪");
// 口罩
// 防护服
// 额温枪
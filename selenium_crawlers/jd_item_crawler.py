from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoSuchElementException
from selenium.common.exceptions import StaleElementReferenceException

from time import sleep, time
from pprint import pprint
from random import uniform


class JDItemCrawler:
    """京东商品列表爬虫
    """
    url = "https://www.jd.com"

    def __init__(self, browser="firefox", maximize=False):
        if browser == "firefox":
            self.browser = webdriver.Firefox()
        elif browser == "chrome":
            self.browser = webdriver.Chrome()
        else:
            raise ValueError(f"invalid browser {browser}")

        if maximize:
            self.browser.maximize_window()
        
        self.browser.get(self.url)
        self.viewport_height = self.browser.execute_script("return window.innerHeight || document.documentElement.clientHeight")
        self.viewport_width = self.browser.execute_script("return window.innerWidth || document.documentElement.clientWidth")

    def find_element_by_css_selector(self, selector):
        ignored_exceptions=(NoSuchElementException, StaleElementReferenceException,)
        element = WebDriverWait(self.browser, 10, ignored_exceptions=ignored_exceptions).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, selector)
        ))
        return element

    def element_offset(self, selector_or_element):
        element = selector_or_element
        if isinstance(selector_or_element, str):
            element = self.find_element_by_css_selector(selector_or_element)

        scroll_y = self.browser.execute_script("return document.documentElement.scrollTop")
        return element.rect['y'] - scroll_y

    def element_in_viewport(self, selector_or_element):
        offset = self.element_offset(selector_or_element)
        return 0 <= offset <= self.viewport_height

    def to_next_page(self):
        # Check SKU to confirm page changed.
        elem = self.browser.find_element_by_css_selector("li.gl-item")
        old_sku = elem.get_attribute("data-sku")
        self.browser.execute_script("document.querySelector('a.pn-next').click()")

        # I don't like forever loop
        for _ in range(100):
            elem = WebDriverWait(self.browser, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "li.gl-item"))
            )
            new_sku = elem.get_attribute("data-sku")
            if new_sku == old_sku:
                print("Waiting for change page.")
                sleep(0.5)
            else:
                return

        raise RuntimeError("Failed to next page.")

    def no_more_pages(self):
        return self.browser.execute_script("return document.querySelector('a.pn-next').classList.contains('disabled')")

    def scroll_into_view(self, element):
        self.browser.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'start'})", element)

    def extract_product_info(self, element):
        product_pic_el = element.find_element_by_css_selector(".p-img img")
        product_picture = product_pic_el.get_attribute("src")
        if product_picture is None:
            product_picture = product_pic_el.get_attribute("data-lazy-img")

        shop_el = element.find_element_by_css_selector(".p-shop")
        seller_address = ""
        try:
            anchor_el = shop_el.find_element_by_tag_name("a")
            seller_address = anchor_el.get_attribute("href")
        except NoSuchElementException:
            with open("shop-error.html", "w", encoding="utf-8") as f:
                f.write(shop_el.get_attribute("innerHTML"))

        seller_name = shop_el.text

        product_name_el = element.find_element_by_css_selector(".p-name > a > em")
        anchor_el = element.find_element_by_css_selector(".p-name a")
        product_address = anchor_el.get_attribute("href")

        product_remark_el = element.find_element_by_css_selector(".p-name .promo-words")
        product_remark = product_remark_el.text
        if product_remark == "":
            product_remark = anchor_el.get_attribute("title")

        return {
            "seller_name": seller_name,
            "seller_address": seller_address,
            "seller_company": "x",
            "product_name": product_name_el.text,
            "product_picture": product_picture,
            "product_remark": product_remark,
            "product_address": product_address,
        }

    def search(self, keyword):
        searchBox = self.find_element_by_css_selector(".form input.text")
        searchBox.send_keys(keyword)
        searchBox.send_keys(Keys.RETURN)

        # 等待结果出现
        WebDriverWait(self.browser, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "a.pn-next"))
        )

    def run(self):
        self.search("牛肉干")

        item_height = 1
        n_items = 0
        timeout_timer = time()
        while True:
            items = self.find_elements_by_css_selector("li.gl-item")
            if len(items) > n_items:
                for i, item in enumerate(items):
                    if i < n_items:
                        continue

                    while not self.element_in_viewport(item):
                        item_height = item.rect['height']
                        self.scroll_into_view(item)
                        sleep(uniform(0.1, 0.5))

                    product = self.extract_product_info(item)
                    print('\n>>>>>>>>>> %3d <<<<<<<<<<' % n_items)
                    pprint(product)

                    n_items += 1

                timeout_timer = time()
                products = []

            if self.element_in_viewport("a.pn-next"):
                if time() - timeout_timer > 5:
                    if self.no_more_pages():
                        break
                    self.to_next_page()
                    n_items = 0

    def exit(self):
        self.browser.close()


if __name__ == "__main__":
    crawler = JDItemCrawler()
    crawler.run()
    crawler.exit()

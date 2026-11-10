// Playwright browser_run_code snippet. Run against the local preview on port 4173.
async (page) => {
  const passed=[];
  function check(name,value){if(!value)throw Error(name);passed.push(name)}
  const sample=Array.from({length:6},(_,i)=>({name:'Пример '+i,text:i===0?'Длинный текст\nОдин\nДва\nТри\nЧетыре\nПять\nШесть':'Короткий отзыв',demo:true,featured:i===0}));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(()=>{localStorage.removeItem('rt-reviews');localStorage.removeItem('rt-basket')});
  for(const count of [0,1,4,5,6]){
    await page.route('**/reviews.json*',r=>r.fulfill({json:sample.slice(0,count)}));
    await page.reload();
    await page.waitForFunction(n=>document.querySelectorAll('.review-card').length===n,count);
    check('review count '+count,await page.locator('.review-card').count()===count);
    check('arrows visibility '+count,await page.locator('.review-actions').isVisible()===(count>4));
    if(count===0)check('empty state',await page.locator('.review-status').innerText()==='Пока нет отзывов');
    await page.unroute('**/reviews.json*');
  }
  await page.locator('.tab-link[href="#reviews"]').click();
  await page.waitForFunction(()=>Math.abs(document.querySelector('#reviews').getBoundingClientRect().top-88)<3);
  check('hash navigation',new URL(page.url()).hash==='#reviews');
  check('all five sections visible',await page.locator('.detail-descr>.tab:visible').count()===5);
  check('all headings have anchors',await page.evaluate(()=>[...document.querySelectorAll('h1,h2,h3')].every(h=>h.querySelector('a[href^="#"]'))));
  await page.locator('.review-next').click();
  await page.waitForFunction(()=>{const t=document.querySelector('.review-track'),c=t.firstElementChild;return Math.abs(new DOMMatrix(getComputedStyle(t).transform).m41+c.getBoundingClientRect().width+parseFloat(getComputedStyle(t).gap))<1});
  check('one-card step',await page.locator('.review-status').innerText()==='2–5 из 6');
  await page.locator('.review-prev').click();
  await page.waitForFunction(()=>Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.review-track')).transform).m41)<1);
  const more=page.locator('.review-more').first();await more.click();check('expand',await more.getAttribute('aria-expanded')==='true');await more.click();check('collapse',await more.getAttribute('aria-expanded')==='false');
  for(const width of [768,390]){
    await page.setViewportSize({width,height:844});
    check('no horizontal overflow '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    check('visible cards '+width,await page.locator('.review-card[aria-hidden="false"]').count()===(width===390?1:2));
  }
  await page.unroute('**/reviews.json*');await page.goto('http://127.0.0.1:4173/');await page.waitForSelector('.review-card');
  return passed;
}

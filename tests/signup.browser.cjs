// Run with Playwright installed, or set FRISBEE_PLAYWRIGHT_PATH to its module directory.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.FRISBEE_PLAYWRIGHT_PATH || 'playwright');
const root = path.join(__dirname, '..');
const savedProfile = {name:'Test Player', gender:'Male', throwing:'3', catch:'3', fitness:'3', experience:'3', preference:'Cutter', practice:'< 3 months'};

async function completeForm(page) {
  await page.locator('#name').fill(savedProfile.name);
  for (const key of ['gender','throwing','catch','fitness','experience']) await page.locator('#'+key).selectOption(savedProfile[key]);
  await page.locator('#pref').selectOption(savedProfile.preference);
  await page.locator('#pd').selectOption(savedProfile.practice);
}

test('signup works in a real browser without Google login', async t => {
  const server = http.createServer((req,res) => {
    const file = req.url.split('?')[0] === '/config.js' ? 'config.js' : 'index.html';
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(fs.readFileSync(path.join(root,file)));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({channel:process.env.FRISBEE_BROWSER_CHANNEL || 'msedge', headless:true});
    async function session(options={}) {
      const context = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
      const errors = [], posts = [], urls = [];
      let status = {ok:true, open:true, count:4, max:32, cutoffIso:'2099-01-01T00:00:00Z'};
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', err => errors.push(err.message));
      await context.route('**/*', async route => {
        const req = route.request(), url = req.url();
        urls.push(url);
        if (url.startsWith(origin + '/api/signup')) {
          let data;
          if (req.method() === 'POST') {
            const body = req.postDataJSON();
            posts.push(body);
            if (options.delayPost) await new Promise(resolve => setTimeout(resolve,100));
            if (options.htmlResponse) return route.fulfill({status:502,contentType:'text/html',body:'<!doctype html><html><div>云端硬盘</div><p>Unable to open file</p></html>'});
            if (options.unconfirmed) return route.fulfill({status:502,json:{ok:false,uncertain:true,error:'The request may have been saved, but confirmation could not be retrieved.'}});
            data = body.action === 'register' ? {ok:true, regId:'TEST-123', ...(options.ratingReview ? {ratingReview:{status:options.ratingReview}} : {})} : {ok:true};
          } else {
            const action = new URL(url).searchParams.get('action');
            data = action === 'status' ? status : action === 'players' ? {ok:true, players:[]} : {ok:false};
          }
          return route.fulfill({json:data}).catch(() => {});
        }
        if (url.startsWith(origin)) return route.continue();
        if (req.resourceType() === 'script') return route.fulfill({contentType:'text/javascript',body:''});
        return route.fulfill({json:{}});
      });
      if (options.noStorage) await context.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage disabled');}}));
      if (options.delayPost) await context.addInitScript(() => {
        const nativeSetTimeout = window.setTimeout.bind(window);
        window.setTimeout = (fn,ms,...args) => nativeSetTimeout(fn,ms===30000 && document.getElementById("btn")?.textContent === "Submitting…" ? 20 : ms,...args);
      });
      await page.goto(origin);
      await page.waitForFunction(() => !document.getElementById('btn').disabled);
      return {context,page,errors,posts,urls,setStatus:value=>status=value};
    }

    await t.test('signup, local restore, opt-out, clear and cancellation', async () => {
      const h=await session();
      try {
        assert.equal(await h.page.locator('#googleSignInButton, #profileEmail').count(),0);
        assert.equal(h.urls.some(url=>url.includes('accounts.google.com') || url.includes('script.google.com')),false);
        await completeForm(h.page);
        await h.page.locator('#btn').click();
        await h.page.waitForFunction(()=>document.getElementById('status').textContent.includes('TEST-123'));
        assert.equal(await h.page.locator('#cancelName').inputValue(),savedProfile.name);
        assert.equal(await h.page.locator('#cancelId').inputValue(),'TEST-123');
        assert.equal(await h.page.locator('#name').inputValue(),savedProfile.name);
        assert.equal(h.posts.length,1);
        assert.equal(h.posts[0].action,'register');
        assert.match(await h.page.locator('#profileStatus').textContent(),/Profile saved/);
        await h.page.reload();
        await h.page.waitForFunction(()=>!document.getElementById('btn').disabled);
        assert.equal(await h.page.locator('#name').inputValue(),savedProfile.name);
        assert.equal(await h.page.locator('#throwing').inputValue(),'3');
        await h.page.locator('#saveProfileOpt').uncheck();
        await h.page.reload();
        await h.page.waitForFunction(()=>!document.getElementById('btn').disabled);
        assert.equal(await h.page.locator('#name').inputValue(),'');
        assert.equal(await h.page.locator('#saveProfileOpt').isChecked(),false);
        await h.page.locator('#loadProfileBtn').click();
        assert.equal(await h.page.locator('#name').inputValue(),savedProfile.name);
        await h.page.locator('#clearProfileBtn').click();
        assert.equal(await h.page.evaluate(()=>localStorage.getItem('frisbee_profile_auto_v2')),null);
        await h.page.locator('#cancelOpenBtn').click();
        h.page.on('dialog',dialog=>dialog.accept());
        await h.page.locator('#cancelBtn').click();
        await h.page.waitForFunction(()=>document.getElementById('cancelStatus').textContent.includes('Cancelled'));
        assert.equal(h.posts[1].action,'cancel');
        assert.equal(h.posts[1].regId,'TEST-123');
        assert.equal(await h.page.locator('#cancelId').inputValue(),'');
        assert.deepEqual(h.errors,[]);
      } finally {await h.context.close();}
    });

    await t.test('storage blocked: successful registration and RegID remain usable', async () => {
      const h=await session({noStorage:true});
      try {
        await completeForm(h.page);
        await h.page.locator('#btn').click();
        await h.page.waitForFunction(()=>document.getElementById('status').textContent.includes('TEST-123'));
        assert.match(await h.page.locator('#profileStatus').textContent(),/could not save/);
        await h.page.evaluate(() => Object.defineProperty(navigator,'clipboard',{
          configurable:true, value:{writeText:async text => {window.copiedRegId = text;}}
        }));
        await h.page.locator('#copyRegBtn').click();
        assert.equal(await h.page.evaluate(()=>window.copiedRegId),'TEST-123');
        assert.equal(await h.page.locator('#cancelId').inputValue(),'TEST-123');
        assert.equal(await h.page.locator('#name').inputValue(),savedProfile.name);
        assert.equal(await h.page.locator('#btn').isDisabled(),false);
        assert.deepEqual(h.errors,[]);
      } finally {await h.context.close();}
    });

    await t.test('real fetch abort recovers without duplicate POST or raw AbortError', async () => {
      const h=await session({delayPost:true});
      try {
        await completeForm(h.page);
        await h.page.locator('#btn').click();
        await h.page.waitForFunction(()=>document.getElementById('status').textContent.includes('Confirmation timed out'));
        assert.equal(await h.page.locator('#btn').isDisabled(),false);
        assert.equal(await h.page.locator('#overlay').isVisible(),false);
        assert.equal(await h.page.locator('#scrollHint').isVisible(),false);
        assert.equal(h.posts.length,1);
        assert.equal(await h.page.locator('#cancelId').inputValue(),'');
        assert.deepEqual(h.errors,[]);
      } finally {await h.context.close();}
    });

    for (const failure of ['htmlResponse','unconfirmed']) {
      await t.test(failure + ': profile is saved/restored without claiming success or repeating signup', async () => {
        const h=await session({[failure]:true});
        try {
          await completeForm(h.page);
          await h.page.locator('#btn').click();
          await h.page.waitForFunction(()=>document.getElementById('status').classList.contains('warnText'));
          const message=await h.page.locator('#status').textContent();
          assert.doesNotMatch(message,/云端硬盘|Submitted!/);
          assert.match(await h.page.locator('#profileStatus').textContent(),/Profile saved/);
          assert.equal(h.posts.length,1);
          assert.equal(await h.page.locator('#cancelId').inputValue(),'');
          await h.page.reload();
          await h.page.waitForFunction(()=>!document.getElementById('btn').disabled);
          assert.equal(await h.page.locator('#name').inputValue(),savedProfile.name);
          assert.equal(await h.page.locator('#throwing').inputValue(),'3');
          assert.equal(h.posts.length,1);
          assert.deepEqual(h.errors,[]);
        } finally {await h.context.close();}
      });
    }

    for (const reviewStatus of ['pending','insufficient_history','unavailable']) {
      await t.test('rating review ' + reviewStatus + ' preserves signup success, profile and cancellation receipt', async () => {
        const h=await session({ratingReview:reviewStatus});
        try {
          await completeForm(h.page);
          await h.page.locator('#btn').click();
          await h.page.waitForFunction(()=>document.getElementById('status').textContent.includes('TEST-123'));
          const note=h.page.locator('#status .ratingReviewNote');
          assert.equal(await note.count(),1);
          const message=await note.textContent();
          assert.match(message, reviewStatus==='pending' ? /organizer.*review/i : reviewStatus==='unavailable' ? /could not be completed/i : /not enough recent history/i);
          assert.match(await h.page.locator('#status').getAttribute('class'),/okText/);
          assert.equal(await h.page.locator('#cancelId').inputValue(),'TEST-123');
          assert.equal(await h.page.locator('#throwing').inputValue(),'3');
          assert.equal(await h.page.locator('#btn').isDisabled(),false);
          assert.equal(h.posts.length,1);
          const profile=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('frisbee_profile_auto_v2')));
          assert.equal(profile.throwing,'3');
          assert.deepEqual(h.errors,[]);
        } finally {await h.context.close();}
      });
    }

    await t.test('malformed saved profiles do not break startup or set invalid options', async () => {
      const h=await session();
      try {
        for (const raw of ['not json','null','[]',JSON.stringify({name:'Saved Player',gender:'invalid',throwing:'999'})]) {
          await h.page.evaluate(value=>localStorage.setItem('frisbee_profile_auto_v2',value),raw);
          await h.page.reload();
          await h.page.waitForFunction(()=>!document.getElementById('btn').disabled);
          assert.equal(await h.page.locator('#gender').inputValue(),'');
          assert.equal(await h.page.locator('#throwing').inputValue(),'');
        }
        assert.deepEqual(h.errors,[]);
      } finally {await h.context.close();}
    });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});

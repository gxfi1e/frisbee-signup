# frisbee-signup

KAUST Frisbee signup, with local browser profiles and a Google Apps Script backend.

## Deployment

Deploy the whole repository to Vercel, including `api/signup.js`, `config.js`, and
`vercel.json`. Copying only `index.html` is no longer sufficient. The frontend calls
`/api/signup`; Vercel runs this Node.js function and it forwards requests to the
fixed Apps Script deployment configured in `config.js`.

Google ContentService returns data through a one-time redirect, as described in
[Google's ContentService documentation](https://developers.google.com/apps-script/guides/content#redirects).
The proxy follows that redirect on the server and returns JSON to the browser on
the site's own origin. It does not forward browser cookies or retry registration
POSTs. HTML, timeouts, and missing RegIDs are reported as unconfirmed outcomes,
not proof that the registration failed. Do not resubmit solely because a response
was lost; check the registered players list first.

Profiles save locally when a valid form is submitted, independently of server
confirmation. Only a confirmed response with a RegID displays registration
success. Local profile persistence is not proof of successful registration.

The proxy deadline is 25 seconds, the browser deadline is 30 seconds, and the
Vercel function limit is set to 30 seconds. The Google Sheets backend and Google
Maps link remain; Google login and cloud profile sync have been removed.

## Verification

Run the request/state and proxy tests with Node.js:

```sh
node --test tests/signup.test.cjs tests/signup-proxy.test.cjs
```

Browser checks require Playwright and Microsoft Edge (the default browser
channel). Run `node --test tests/signup.browser.cjs`; set
`FRISBEE_PLAYWRIGHT_PATH` if Playwright is not in the normal module search path,
and `FRISBEE_BROWSER_CHANNEL` to use a different installed Playwright channel.
All automated registration requests are mocked; tests do not create live signups.

# GramJS

A Telegram client written in JavaScript for Node.js and browsers, with its core being based on
[Telethon](https://github.com/LonamiWebs/Telethon).

## How to get started

Here you'll learn how to obtain necessary information to create telegram application, authorize into your account and send yourself a message.

> **Note** that if you want to use a GramJS inside of a browser, refer to [this instructions](https://gram.js.org/introduction/advanced-installation).

Install GramJS:

```bash
$ npm i telegram
```

After installation, you'll need to obtain an API ID and hash:

1. Login into your [telegram account](https://my.telegram.org/)
2. Then click "API development tools" and fill your application details (only app title and short name required)
3. Finally, click "Create application"

> **Never** share any API/authorization details, that will compromise your application and account.

When you've successfully created the application, change `apiId` and `apiHash` on what you got from telegram.

Then run this code to send a message to yourself.

```javascript
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import readline from "readline";

const apiId = 123456;
const apiHash = "123456abcdfg";
const stringSession = new StringSession(""); // fill this later with the value from session.save()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

(async () => {
  console.log("Loading interactive example...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () =>
      new Promise((resolve) =>
        rl.question("Please enter your number: ", resolve)
      ),
    password: async () =>
      new Promise((resolve) =>
        rl.question("Please enter your password: ", resolve)
      ),
    phoneCode: async () =>
      new Promise((resolve) =>
        rl.question("Please enter the code you received: ", resolve)
      ),
    onError: (err) => console.log(err),
  });
  console.log("You should now be connected.");
  console.log(client.session.save()); // Save this string to avoid logging in again
  await client.sendMessage("me", { message: "Hello!" });
})();
```

> **Note** that you can also save auth key to a folder instead of a string, change `stringSession` into this:
>
> ```javascript
> const storeSession = new StoreSession("folder_name");
> ```

Be sure to save output of `client.session.save()` into `stringSession` or `storeSession` variable to avoid logging in again.

## Building from source

This fork is consumed straight from git, so the compiled `dist/` is committed
alongside the sources. **Always run the build before committing** — the check
below refuses anything that is out of sync.

```bash
npm ci
npm run build          # codegen -> clean -> tsc -> assets -> smoke test
```

| Command | What it does |
| --- | --- |
| `npm run build` | Full build into `dist/`. The only command you need before a commit. |
| `npm run build:check` | Builds into a temp dir and diffs it against `dist/`. Fails if `dist/` is stale. Nothing is written. |
| `npm run codegen` | Only regenerates the derived sources (see below). |
| `npm run codegen:check` | Fails if any derived source is stale. |
| `npm run typecheck` | `tsc --noEmit`, no output written. |
| `npm test` | Jest. |
| `npm run verify` | `build:check` + tests. Run this in CI. |
| `npm run build:browser` | Browser bundle, see below. |

### Updating the TL layer

Replace `gramjs/tl/static/api.tl` (and `schema.tl` if it changed), then run
`npm run build`. Everything else is derived and must never be edited by hand:

| Derived file | Generated from |
| --- | --- |
| `gramjs/tl/apiTl.js`, `gramjs/tl/schemaTl.js` | the `.tl` schemas — this is what the runtime actually parses |
| `gramjs/tl/api.d.ts` | the `.tl` schemas, via `gramjs/tl/types-generator` |
| `LAYER` in `gramjs/tl/AllTLObjects.ts` | the `// LAYER <n>` marker at the end of `api.tl` |
| `gramjs/Version.ts` | `version` in `package.json` |

A layer bump usually breaks a few call sites where Telegram widened a boxed
type — `tsc` will point at them and the build stops rather than emitting a
half-updated `dist/`.

## Running GramJS inside browsers

GramJS works great in combination with frontend libraries such as React, Vue and others.

While working within browsers, GramJS is using `localStorage` to cache the layers.

To get a browser bundle of GramJS (`browser/telegram.js`, UMD), run:

```bash
npm run build:browser        # add --dev for an unminified bundle
```

It builds from a throwaway `tempBrowser/` copy in which every `*-BROWSER.ts`
file replaces its node counterpart, so it never touches `dist/`, `tsconfig.json`
or `package.json`.

## Calling the raw API

To use raw telegram API methods use [invoke function](https://gram.js.org/beta/classes/TelegramClient.html#invoke).

```javascript
await client.invoke(new RequestClass(args));
```

## Documentation

General documentation, use cases, quick start, refer to [gram.js.org](https://gram.js.org), or [older version of documentation](https://painor.gitbook.io/gramjs) (will be removed in the future).

For more advanced documentation refer to [gram.js.org/beta](https://gram.js.org/beta) (work in progress).

If your ISP is blocking Telegram, you can check [My ISP blocks Telegram. How can I still use GramJS?](https://gist.github.com/SecurityAndStuff/7cd04b28216c49b73b30a64d56d630ab)

## Ask a question

If you have any questions about GramJS, feel free to open an issue or ask directly in our telegram group - [@GramJSChat](https://t.me/gramjschat).

https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/mtproto/scheme/api.tl

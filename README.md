# Scroll Reader

A web app that scrolls a web page by itself. Use it to read manga and long pages hands-free. Made for iPad first.

## Features

1. Auto-scroll with speed control (5 to 400 pixels per second).
2. Size control (40% to 300%).
3. A bookmark version that runs on any site, including sites that block embedding.
4. The screen stays on while the page scrolls.
5. Install it on the iPad Home Screen. It opens full screen, like an app.
6. Light and dark mode.
7. Remembers your last address, speed, and size.

## Put it online (one time)

1. In this repository on GitHub, go to **Settings**, then **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Select the branch that has these files, and the `/ (root)` folder. Tap **Save**.
4. Wait one or two minutes. GitHub shows the address, for example `https://caligarn.github.io/Scroller/`.

Note: on a free GitHub plan, the repository must be public to use Pages.

## Install it on iPad

1. Open the Pages address in **Safari**.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.
4. Open **Scroller** from the Home Screen.

## Two modes

**App mode.** Paste a web address and tap **Open**. Tap the round button to start or stop. Some sites block other pages from showing them. Most manga sites do this. If the page stays blank, use the bookmark.

**Bookmark mode.** This works on every site. It runs in Safari, not in the Home Screen app. It shows a control bar on the page with play, speed, and size buttons.

### Add the bookmark on iPad

1. In the app, tap **Copy code**.
2. In Safari, open any page. Tap **Share**, then **Add to Favorites**.
3. Open your bookmarks. Tap **Edit**, then tap the new bookmark.
4. Name it **Auto-Scroll**. Delete the address and paste the code. Tap **Done**.
5. On a manga page, tap the address bar. Your Favorites show. Tap **Auto-Scroll**.
6. Tap **Auto-Scroll** again, or tap **✕**, to remove the bar.

## Files

- `index.html`: the full app. HTML, CSS, and JavaScript in one file. The bookmark code is the `bm()` function in the script.
- `manifest.webmanifest`: the app name and icons for the Home Screen.
- `sw.js`: lets the app open with no internet after the first visit.
- `icons/`: the app icons.

## Run it on a computer

Open `index.html` in a browser. No build step. No dependencies.

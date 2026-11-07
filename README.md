# Scroller

A simple web app for iPad. It scrolls a web page by itself, so you can read manga and long pages hands-free.

## Use it

1. Paste a web address and tap **Open**.
2. Tap **▶** to start. Tap **❚❚** to stop.
3. Use **− +** to change the speed. Use **A− A+** to change the size.
4. Tap **✕** to go back to the start screen.

The buttons fade away after 3 seconds. Tap the page to show them again. Links on the page stay inside the app.

To check the app, tap **Open the test page** on the start screen.

## How it works

Many sites do not let other pages show them in a frame. So the app gets each page on its own server (`api/read.js`). Then it sends the page back with the small buttons added (`reader.js`). Images and other files still load from the real site.

Some sites still do not work:
- Sites that need you to log in.
- Sites that block servers (for example, with a "check you are human" page).
- Sites that build the whole page with scripts.

If a site does not open, the app shows a link to open it in Safari.

## Put it online

The app needs **Vercel**, because `api/read.js` runs on the server. GitHub Pages cannot run it.

1. On vercel.com, import the `caligarn/Scroller` repository. No settings are needed.
2. Set the production branch to the branch that has these files.
3. Vercel gives you an address, for example `https://scroller.vercel.app`.

## Save it to the iPad Home Screen

1. Open the Vercel address in **Safari**.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.
4. Open **Scroller** from the Home Screen. It opens full screen.

## Files

- `index.html`: the start screen.
- `api/read.js`: gets a page and adds the buttons.
- `reader.js`: the buttons and the scrolling.
- `test.html`: a test page.
- `manifest.webmanifest` and `icons/`: the Home Screen name and icon.
- `sw.js`: lets the start screen open with no internet.

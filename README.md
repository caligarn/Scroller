# Scroller

A simple web app for iPad. It scrolls a web page by itself, so you can read manga and long pages hands-free.

## Use it

1. Paste a web address and tap **Open**.
2. Tap **▶** to start. Tap **❚❚** to stop.
3. Use **− +** to change the speed. Use **A− A+** to change the size.
4. Tap **✕** to close the page.

The buttons fade out while the page scrolls. Tap the page to show them again. When the page is stopped, the buttons stay, and you can tap links on the page.

Some sites do not let other apps show them. Those pages stay blank.

## Put it online (one time)

1. In this repository on GitHub, go to **Settings**, then **Pages**.
2. Set **Source** to **Deploy from a branch**.
3. Select the branch with these files, and the `/ (root)` folder. Tap **Save**.
4. Wait one or two minutes. GitHub shows the address, for example `https://caligarn.github.io/Scroller/`.

On a free GitHub plan, the repository must be public to use Pages.

## Save it to the iPad Home Screen

1. Open the address in **Safari**.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.
4. Open **Scroller** from the Home Screen. It opens full screen.

## Files

- `index.html`: the full app.
- `manifest.webmanifest` and `icons/`: the Home Screen name and icon.
- `sw.js`: lets the app open with no internet.

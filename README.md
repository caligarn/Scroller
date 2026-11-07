# Scroller

Small buttons that scroll any web page in Safari, so you can read manga and long pages hands-free. Made for iPad.

The buttons come from a Safari bookmark. The bookmark runs on the real page in your own Safari, so it works on sites that block other apps.

## Set it up (one time)

1. Open the Scroller address in Safari, for example `https://scroller-hw96.vercel.app`.
2. Tap **Copy bookmark**.
3. In Safari, tap **Share**, then **Add to Favorites**.
4. Touch and hold the new bookmark in the Favorites bar. Tap **Edit**. Name it **Scroller**. Delete the address and paste.

No Favorites bar? Open **Settings**, then **Apps**, then **Safari**. Turn on **Show Favorites Bar**.

You can also add the Scroller page to your Home Screen (**Share**, then **Add to Home Screen**). It keeps the setup steps close.

## Use it

1. Open a manga page in Safari.
2. Tap **Scroller** in the Favorites bar. A small bar shows on the left side.
3. Tap **▶** to start. Tap **❚❚** to stop.
4. Use **+ −** to change the speed, from 20 to 100,000 points per second (shown as 100k). Use **A+ A−** to change the size.
5. Tap **✕**, or tap **Scroller** again, to remove the bar.

The buttons fade away after 3 seconds. Tap the page to show them again. The page stops at the end.

To check your bookmark, open `test.html` (for example `https://scroller-hw96.vercel.app/test.html`) and tap **Scroller**.

## Put it online

Any static host works. No build step.

- **Vercel:** import the `caligarn/Scroller` repository. No settings are needed.
- **GitHub Pages:** go to **Settings**, then **Pages**. Deploy from the branch, `/ (root)` folder.

## Files

- `reader.js`: the buttons and the scrolling. The start page makes the bookmark from this file.
- `index.html`: the start page, with the **Copy bookmark** button and the steps.
- `test.html`: a long page to test the bookmark.
- `manifest.webmanifest` and `icons/`: the Home Screen name and icon.
- `sw.js`: lets the start page open with no internet.

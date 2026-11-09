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
4. Use **+ −** to change the speed, from 20 to 100,000 points per second (shown as 100k). Use **A+ A−** to change the size, from 10% to 400%.
5. Tap **▲** or **▼** to jump one screen up or down at once. These work while playing or stopped.
6. Tap the arrow button (**↓** or **↑**) to move down or up. This works in both modes.
7. Tap **✕**, or tap **Scroller** again, to remove the bar.

### Two modes

Tap the mode button (**Scroll** or **Page**) to change the mode.

- **Scroll:** the page moves smoothly. **+ −** change the speed.
- **Page:** the page jumps down one screen, then waits. **+ −** change the wait, from 0.25 to 60 seconds. The steps are 0.25 seconds up to 3 seconds, 0.5 seconds up to 6 seconds, and 1 second up to 12 seconds. Each jump is 90% of the screen, so the bottom line stays in view at the top.

Scroller remembers your mode, direction, speed, wait, and size on each site.

The page stops at the end (or at the top, when it moves up).

### Next chapter

When the page reaches the bottom, Scroller waits until the images there have loaded (up to 10 seconds), then 1.5 seconds more. Then it goes to the next chapter by itself. It finds next chapter links, arrow icons, and buttons, including words in some other languages. It skips "Previous" and "Back" links. If it finds no link, it adds 1 to the chapter number in the page address (for example `chapter-02` becomes `chapter-03`, and `113` becomes `114`). It uses the number after a word like "chapter" or "ep", or else the last number. If that address does not exist, or the site sends you to another page, it stops and shows "No next chapter".

Tap **▼** at the bottom of a page to go to the next chapter at once. Tap **Next** on the bar to turn this off (the button then shows a line through it). It works only when the page moves down.

On most sites, the next chapter loads into the same page, and Scroller keeps running. Some sites add their images with their own code. On those sites, Scroller opens the next chapter as a new page. Tap **Scroller** once, and it starts playing. Scroller also opens a new page if the site does not answer in 15 seconds.

Scroller does not go to the next chapter when something holds the page in place (for example a popup), or when image slider buttons say "next".

If a site picks the wrong link, turn **Next** off on that site.

### New page or refresh

A bookmark runs only on the page that is open. When Safari opens a new page, or you refresh, the bar goes away. Tap **Scroller** again. It starts playing at once, with the same mode, speed, direction, and size. Tap **❚❚** if you want to read without scrolling.

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

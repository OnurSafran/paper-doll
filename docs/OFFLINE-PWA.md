# Offline iPad App

Paper Doll Studio is an installable Progressive Web App (PWA). It does not need an Apple Developer account, Xcode, App Store review, or code signing.

## Recommended family setup

Host the project as a static site over HTTPS. GitHub Pages, Netlify, and Vercel are suitable hosting options. Do not open `index.html` directly from the Files app: service workers require a web origin, and HTTPS is required for normal hosted use.

On the iPad:

1. Open the hosted URL in Safari while online.
2. Wait for the first page load to finish. This downloads the app shell, JavaScript modules, styles, icon, and cataloged SVG artwork.
3. Use Safari's **Share → Add to Home Screen** action.
4. Open **Paper Doll** from the Home Screen. After the first successful load, the game can run without internet.

Saved dolls, scenes, settings, and backups remain in that iPad's browser storage. They are not uploaded to the host and are not shared between devices. Use the in-app Project export if a backup needs to be moved to another device.

## Custom paint and IndexedDB

The hosted PWA can use IndexedDB for a future Custom Paint Studio. IndexedDB is origin-scoped browser storage, so custom artwork can remain available offline on the iPad after the first load. It does not synchronize between devices. The feature is not implemented yet; when it is added, the project-portability export/import flow must include custom artwork metadata and bytes so paintings can be backed up and moved safely.

## Updating the hosted app

The Home Screen icon and URL remain unchanged. To publish an update:

1. Upload the changed project files to the same host.
2. Change `CACHE_NAME` in `sw.js`, for example from `paper-doll-studio-v1` to `paper-doll-studio-v2`.
3. Open the app on the iPad while online. Safari checks the service worker, downloads the new cache, and removes the old cache.
4. Close and reopen the app if the old screen remains visible during the first update.

An update needs one online launch on the iPad. It is then available offline again. Existing saved data is kept because the app's local-storage keys are unchanged.

## Limits and troubleshooting

- If the app was never opened online, it cannot install its offline cache.
- Clearing Safari website data removes the cached app and local saved data.
- A normal web update cannot repair a device that has been offline since before the update; it must connect once.
- Native App Store packaging is unnecessary for this use case. It would add Apple signing and distribution steps without improving offline play.

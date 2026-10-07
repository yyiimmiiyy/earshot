# Earshot

Sorts your app store reviews into themes and drafts a reply to each one, using Claude.

Earshot is a small Windows app for people who publish apps. Paste in your reviews, or open an export from Google Play Console or App Store Connect. Claude tells you what people are saying, grouped by topic, and writes a reply to every review for you to edit and post.

Earshot is free and open source, from [Goodhope Technologies](https://goodhopetechnologies.com).

## What it does

- **Finds the themes.** Reviews are grouped by topic, such as a bug, a missing feature or the price, with a count, a summary of what people said and a suggestion for the team.
- **Drafts a reply to every review.** Each one answers what that reviewer wrote, in the language they wrote it in, and fits the store's length limit: 350 characters on Google Play, 5,970 on the App Store.
- **Keeps you out of trouble.** Claude does not know your plans, so drafts never promise a fix, a date or a refund. They never ask anyone to change a rating or offer anything for doing so, which the stores prohibit.
- **Leaves posting to you.** Edit each reply, watch the character count, then copy it into your store console. You can also save everything as a spreadsheet. Earshot does not connect to your store account and never posts anything.

## Install

Download the latest `.msi` from the [Releases](../../releases) page and run it. Windows 10 or later, 64-bit.

The installer is not code-signed yet, so Windows SmartScreen will warn that the publisher is unknown. Choose **More info**, then **Run anyway**.

## Set up

Earshot needs one key, entered on the Settings screen: **an Anthropic API key**, from <https://console.anthropic.com/settings/keys>. Each run is billed to this key. It is encrypted on your computer using Windows' own credential protection.

## Getting your reviews in

- **Paste them.** One review per paragraph, with a blank line between. Start a review with its rating if you have it: `2 stars: Keeps logging me out.` or `★★★★★ Love the offline mode.`
- **Open a CSV.** Earshot looks for a column named "Review Text", "Review", "Body" or "Text", and uses "Star Rating" or "Rating", a title column and a date column when they are present. Google Play's UTF-16 exports are read correctly. Rows with a rating but no text are skipped.

## Privacy

Earshot has no server. It sends the reviews you give it, the app name and your support address to **Anthropic** so Claude can analyse them, and talks to nothing else. Store reviews are public, but check an export for anything private before you load it.

## Limits

- Up to 80 reviews per run, each trimmed to 1,500 characters. It tells you when a file has more.
- It does not fetch reviews from the stores or post replies to them.
- Claude can be wrong, and a reply is published under your name. Read every draft.

## Build from source

```
npm install
npm test
npm start        # run the app
npm run dist     # build the MSI (Windows only)
```

Running the "Build installer" workflow on GitHub Actions builds the MSI and attaches it to a release named after the version in `package.json`.

## Licence

MIT. See [LICENSE](LICENSE).

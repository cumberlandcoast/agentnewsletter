# Gmail Insight Pipeline (Apps Script)

This repository contains a Google Apps Script that turns inbound Gmail messages into editorial-ready insights. Emails containing required hashtags are analyzed with a large language model, stored in Airtable, and surfaced in Notion for newsletter staging.

## What it produces

Each processed email results in a single Airtable record with these exact fields:

- Headline
- Summary
- Strategic Implications
- Bottom Line
- Experience Insight
- Primary Source URL
- Citation

The same insight is also added to the top of a designated Notion database used to stage monthly newsletter content.

## Setup

1. Create an Airtable base and table with columns matching the fields above.
2. Create a Notion database with properties matching the fields above (Name, Summary, Strategic Implications, Bottom Line, Experience Insight, Primary Source URL, Citation).
3. Create a Google Apps Script project.
4. Copy the contents of `Code.gs` into the script editor.
5. (Optional) Copy `appsscript.json` to set the runtime and timezone.
6. Update the configuration constants at the top of `Code.gs`:
   - `AIRTABLE_API_KEY`
   - `AIRTABLE_BASE_ID`
   - `AIRTABLE_TABLE_NAME`
   - `NOTION_API_KEY`
   - `NOTION_DATABASE_ID`
   - `OPENAI_API_KEY`
   - `LABEL_NAME`
   - `GMAIL_QUERY`
   - `REQUIRED_HASHTAGS`
7. Run `processInsightEmails()` once to authorize the script.
8. (Optional) Add a time-based trigger to run `processInsightEmails()` on a schedule.

## Behavior

- Emails matching `GMAIL_QUERY` are only processed when they include all `REQUIRED_HASHTAGS`.
- The LLM generates structured insight fields, including explicit mention of sponsored content if detected.
- Each insight is written to Airtable and appended as a new Notion page in the target database.
- Processed emails are labeled with `Archived by Automation` for idempotency and auditability.
- On the 28th day of each month, a new Notion page is created for the upcoming month staging area.

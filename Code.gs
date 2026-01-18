const LABEL_NAME = 'Archived by Automation';
const GMAIL_QUERY = 'in:inbox -label:"Archived by Automation" #insight';
const REQUIRED_HASHTAGS = ['#insight'];

const AIRTABLE_API_KEY = 'PASTE_AIRTABLE_API_KEY';
const AIRTABLE_BASE_ID = 'PASTE_AIRTABLE_BASE_ID';
const AIRTABLE_TABLE_NAME = 'Insights';

const NOTION_API_KEY = 'PASTE_NOTION_API_KEY';
const NOTION_DATABASE_ID = 'PASTE_NOTION_DATABASE_ID';

const OPENAI_API_KEY = 'PASTE_OPENAI_API_KEY';
const OPENAI_MODEL = 'gpt-4o';

const INSIGHT_FIELDS = [
  'Headline',
  'Summary',
  'Strategic Implications',
  'Bottom Line',
  'Experience Insight',
  'Primary Source URL',
  'Citation',
];

function processInsightEmails() {
  const label = getOrCreateLabel_();
  const threads = GmailApp.search(GMAIL_QUERY);

  threads.forEach((thread) => {
    const messages = thread.getMessages();
    let threadProcessed = false;

    messages.forEach((message) => {
      if (!hasRequiredHashtags_(message, REQUIRED_HASHTAGS)) {
        return;
      }

      const insight = buildInsightFromMessage_(message);
      const airtableId = createAirtableRecord_(insight);
      const notionPageId = appendInsightToNotion_(insight);
      threadProcessed = true;

      Logger.log('Created Airtable record %s and Notion page %s', airtableId, notionPageId);
    });

    if (threadProcessed) {
      thread.addLabel(label);
    }
  });

  ensureNextMonthNotionPage_();
}

function hasRequiredHashtags_(message, hashtags) {
  const body = message.getPlainBody() || '';
  return hashtags.every((tag) => body.includes(tag));
}

function buildInsightFromMessage_(message) {
  const subject = message.getSubject();
  const body = message.getPlainBody();
  const urls = extractUrls_(body);
  const attachments = message.getAttachments({ includeInlineImages: true, includeAttachments: true });
  const attachmentNames = attachments.map((attachment) => attachment.getName());

  const prompt = buildInsightPrompt_(subject, body, urls, attachmentNames);
  const response = callOpenAi_(prompt);
  const insight = parseInsightResponse_(response);

  return {
    headline: insight.headline,
    summary: insight.summary,
    strategicImplications: insight.strategicImplications,
    bottomLine: insight.bottomLine,
    experienceInsight: insight.experienceInsight,
    primarySourceUrl: insight.primarySourceUrl,
    citation: insight.citation,
  };
}

function buildInsightPrompt_(subject, body, urls, attachmentNames) {
  return [
    'You are an editorial analyst creating a newsletter-ready insight based on an email submission.',
    'Analyze the subject, full body, URLs, and attachment names. Detect any sponsored content and include it explicitly.',
    'Return JSON with keys: headline, summary, strategicImplications, bottomLine, experienceInsight, primarySourceUrl, citation.',
    'Guidelines:',
    '- Headline: compelling, non-generic, 6-14 words.',
    '- Summary: factual, concise, who/what/where.',
    '- StrategicImplications: forward-looking, why it matters.',
    '- BottomLine: single sentence, memorable and quotable.',
    '- ExperienceInsight: optional stat or pull quote, empty string if none.',
    '- PrimarySourceUrl: best URL from the message or empty string.',
    '- Citation: casual source footer, e.g., "Source: Company blog".',
    'Subject: ' + subject,
    'Body: ' + body,
    'URLs: ' + (urls.length ? urls.join(', ') : 'None'),
    'Attachment Names: ' + (attachmentNames.length ? attachmentNames.join(', ') : 'None'),
  ].join('\n');
}

function callOpenAi_(prompt) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'PASTE_OPENAI_API_KEY') {
    throw new Error('Please set OPENAI_API_KEY.');
  }

  const payload = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'You generate editorial insights from emails.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + OPENAI_API_KEY,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  if (!data.choices || !data.choices.length) {
    throw new Error('OpenAI response missing choices: ' + response.getContentText());
  }

  return data.choices[0].message.content;
}

function parseInsightResponse_(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    return {
      headline: parsed.headline || '',
      summary: parsed.summary || '',
      strategicImplications: parsed.strategicImplications || '',
      bottomLine: parsed.bottomLine || '',
      experienceInsight: parsed.experienceInsight || '',
      primarySourceUrl: parsed.primarySourceUrl || '',
      citation: parsed.citation || '',
    };
  } catch (error) {
    throw new Error('Failed to parse insight JSON: ' + error.message + '\nResponse: ' + responseText);
  }
}

function createAirtableRecord_(insight) {
  if (!AIRTABLE_API_KEY || AIRTABLE_API_KEY === 'PASTE_AIRTABLE_API_KEY') {
    throw new Error('Please set AIRTABLE_API_KEY.');
  }

  const url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + encodeURIComponent(AIRTABLE_TABLE_NAME);
  const payload = {
    records: [
      {
        fields: {
          'Headline': insight.headline,
          'Summary': insight.summary,
          'Strategic Implications': insight.strategicImplications,
          'Bottom Line': insight.bottomLine,
          'Experience Insight': insight.experienceInsight,
          'Primary Source URL': insight.primarySourceUrl,
          'Citation': insight.citation,
        },
      },
    ],
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + AIRTABLE_API_KEY,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  if (!data.records || !data.records.length) {
    throw new Error('Airtable error: ' + response.getContentText());
  }

  return data.records[0].id;
}

function appendInsightToNotion_(insight) {
  if (!NOTION_API_KEY || NOTION_API_KEY === 'PASTE_NOTION_API_KEY') {
    throw new Error('Please set NOTION_API_KEY.');
  }

  const payload = {
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      Name: {
        title: [{ text: { content: insight.headline || 'Untitled Insight' } }],
      },
      'Summary': {
        rich_text: [{ text: { content: insight.summary } }],
      },
      'Strategic Implications': {
        rich_text: [{ text: { content: insight.strategicImplications } }],
      },
      'Bottom Line': {
        rich_text: [{ text: { content: insight.bottomLine } }],
      },
      'Experience Insight': {
        rich_text: [{ text: { content: insight.experienceInsight } }],
      },
      'Primary Source URL': {
        url: insight.primarySourceUrl,
      },
      'Citation': {
        rich_text: [{ text: { content: insight.citation } }],
      },
    },
  };

  const response = UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + NOTION_API_KEY,
      'Notion-Version': '2022-06-28',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  if (!data.id) {
    throw new Error('Notion error: ' + response.getContentText());
  }

  return data.id;
}

function ensureNextMonthNotionPage_() {
  const today = new Date();
  if (today.getDate() !== 28) {
    return;
  }

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const title = Utilities.formatDate(nextMonth, Session.getScriptTimeZone(), 'MMMM yyyy') + ' Newsletter Staging';

  const payload = {
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      Name: {
        title: [{ text: { content: title } }],
      },
    },
  };

  UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + NOTION_API_KEY,
      'Notion-Version': '2022-06-28',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function extractUrls_(text) {
  if (!text) {
    return [];
  }
  const urlPattern = /https?:\/\/[^\s<>()]+/gi;
  return Array.from(new Set(text.match(urlPattern) || []));
}

function getOrCreateLabel_() {
  return GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
}

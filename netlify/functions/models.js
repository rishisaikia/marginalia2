/**
 * Netlify Function: models.js
 *
 * Fetches all .md files from the private GitHub repo's mental models folder,
 * parses them, and returns a JSON array of model objects.
 *
 * Environment variable required:
 *   GITHUB_TOKEN — a GitHub Personal Access Token with `repo` (read) scope
 *
 * Local dev: place GITHUB_TOKEN=xxx in a .env file (see .env.example)
 * Production: set GITHUB_TOKEN in Netlify dashboard → Site settings → Environment variables
 */

const GITHUB_OWNER = 'rishisaikia';
const GITHUB_REPO = 'quartz';
const CONTENT_PATH = 'content/01 Mental Models';

// Parse YAML-style frontmatter block
function parseFrontmatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { body: text, frontmatter: {} };

    const raw = match[1];
    const body = text.slice(match[0].length).trim();
    const frontmatter = {};

    // Parse `type: value`
    const typeMatch = raw.match(/^type:\s*(.+)$/m);
    if (typeMatch) frontmatter.type = typeMatch[1].trim();

    // Parse `category:` list
    const catBlock = raw.match(/^category:\s*\n((?:\s+-\s*.+\n?)*)/m);
    if (catBlock) {
        frontmatter.category = catBlock[1]
            .split('\n')
            .map(l => l.replace(/^\s+-\s*/, '').trim())
            .filter(Boolean);
    }

    // Parse `related_models:` list
    const relBlock = raw.match(/^related_models:\s*\n((?:\s+-\s*.+\n?)*)/m);
    if (relBlock) {
        frontmatter.related_models = relBlock[1]
            .split('\n')
            .map(l => {
                const value = l.replace(/^\s+-\s*/, '').trim().replace(/^["']|["']$/g, '');
                // Strip [[...]] Obsidian link syntax
                return value.replace(/\[\[(.+?)\]\]/g, '$1').trim();
            })
            .filter(Boolean);
    }

    return { frontmatter, body };
}

// Slugify a string: "Margin of Safety" → "margin-of-safety"
function slugify(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

// Extract a section body following a given heading
function extractSection(body, heading) {
    // Match ## Heading (case-insensitive) and capture until next ## heading or end
    const regex = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
    const match = body.match(regex);
    return match ? match[1].trim() : null;
}

// Parse an individual .md file into a model object
function parseModel(filename, content) {
    const { frontmatter, body } = parseFrontmatter(content);
    const title = filename.replace(/\.md$/, '');
    const id = slugify(title);

    return {
        id,
        title,
        categories: frontmatter.category || [],
        related: (frontmatter.related_models || []).map(slugify),
        definition: extractSection(body, 'Definition') || '',
        insight: extractSection(body, 'Key Insight') || '',
        application: extractSection(body, 'How to Apply') || '',
        example: extractSection(body, 'Real-World Example') || '',
        pitfalls: extractSection(body, 'Common Pitfalls') || '',
    };
}

export const handler = async () => {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'GITHUB_TOKEN environment variable is not set.' }),
        };
    }

    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'knowledge-garden-app',
        'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
        // Step 1: List all files in the mental models folder
        const encodedPath = encodeURIComponent(CONTENT_PATH).replace(/%2F/g, '/');
        const listUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodedPath}`;
        const listRes = await fetch(listUrl, { headers });

        if (!listRes.ok) {
            const err = await listRes.text();
            console.error('GitHub list error:', listRes.status, err);
            return {
                statusCode: listRes.status,
                body: JSON.stringify({ error: `Failed to list files: ${listRes.statusText}` }),
            };
        }

        const files = await listRes.json();
        const mdFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.md'));

        // Step 2: Fetch each file's content in parallel
        const models = await Promise.all(
            mdFiles.map(async file => {
                const contentRes = await fetch(file.download_url, { headers });
                if (!contentRes.ok) {
                    console.warn(`Skipping ${file.name} — fetch failed (${contentRes.status})`);
                    return null;
                }
                const content = await contentRes.text();
                return parseModel(file.name, content);
            })
        );

        const validModels = models
            .filter(Boolean)
            // Only return files typed as mental-model (or all if type is absent)
            .filter(m => true); // already filtered by folder, so include all

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, s-maxage=300', // cache 5 min at CDN
            },
            body: JSON.stringify(validModels),
        };
    } catch (err) {
        console.error('Unhandled error in models function:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error', detail: err.message }),
        };
    }
};

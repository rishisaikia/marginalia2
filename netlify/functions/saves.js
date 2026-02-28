/**
 * Netlify Function: saves.js
 *
 * Stores and retrieves a user's saved mental model IDs using Netlify Blobs.
 * Auth is provided by Netlify Identity — the JWT in the Authorization header
 * is verified by Netlify automatically when deployed; we just read the user
 * context from the `clientContext` field injected by the Netlify runtime.
 *
 * GET  /.netlify/functions/saves         → { saves: ["id1", ...] }
 * POST /.netlify/functions/saves         → body: { saves: [...] }  → 200 OK
 */

import { getStore } from '@netlify/blobs';

export const handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: '',
        };
    }

    // Require authentication
    const { identity, user } = context.clientContext || {};

    if (!user) {
        return json(401, { error: 'Unauthorized. Please sign in.' });
    }

    const userId = user.sub; // stable unique ID from the JWT
    const store = getStore('user-saves');

    if (event.httpMethod === 'GET') {
        try {
            const raw = await store.get(userId);
            const saves = raw ? JSON.parse(raw) : [];
            return json(200, { saves });
        } catch (err) {
            console.error('GET saves error:', err);
            return json(500, { error: 'Failed to read saves.' });
        }
    }

    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const saves = Array.isArray(body.saves) ? body.saves : [];
            await store.set(userId, JSON.stringify(saves));
            return json(200, { ok: true });
        } catch (err) {
            console.error('POST saves error:', err);
            return json(500, { error: 'Failed to write saves.' });
        }
    }

    return json(405, { error: 'Method not allowed.' });
};

function json(statusCode, body) {
    return {
        statusCode,
        headers: corsHeaders(),
        body: JSON.stringify(body),
    };
}

function corsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
}

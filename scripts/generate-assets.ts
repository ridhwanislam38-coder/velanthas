#!/usr/bin/env tsx
// ── AI Asset Generation Pipeline ───────────────────────────────────────────
// Usage: npx tsx scripts/generate-assets.ts <retrodiffusion|freesound|elevenlabs>
//
// Reads API keys from .env, generates/downloads assets into assets/generated/.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';

// ── Load .env manually (no external dep required at runtime) ─────────────
function loadEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, '..', '.env');
  const env: Record<string, string> = {};
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env file not found at', envPath);
    console.error('See scripts/ai-tools-setup.md for setup instructions.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIdx = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function requireKey(env: Record<string, string>, key: string): string {
  const value = env[key];
  if (!value || value.includes('your_') || value.includes('_here')) {
    console.error(`ERROR: ${key} is not set in .env`);
    console.error('See scripts/ai-tools-setup.md for setup instructions.');
    process.exit(1);
  }
  return value;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────
function fetchJson(url: string, options: https.RequestOptions = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Invalid JSON from ${url}: ${body.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function postJson(url: string, data: Record<string, unknown>, headers: Record<string, string> = {}): Promise<unknown> {
  const payload = JSON.stringify(data);
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload).toString(),
        ...headers,
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] ?? '';
        if (contentType.includes('application/json')) {
          try { resolve(JSON.parse(buf.toString())); }
          catch { reject(new Error(`Invalid JSON: ${buf.toString().slice(0, 200)}`)); }
        } else {
          resolve(buf);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers['location'];
        if (location) {
          file.close();
          fs.unlinkSync(dest);
          downloadFile(location, dest).then(resolve).catch(reject);
          return;
        }
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

// ── Project paths ─────────────────────────────────────────────────────────
const ROOT       = path.resolve(__dirname, '..');
const SPRITES_DIR  = path.join(ROOT, 'assets', 'generated', 'sprites');
const AMBIENT_DIR  = path.join(ROOT, 'assets', 'generated', 'audio', 'ambient');
const DIALOGUE_DIR = path.join(ROOT, 'assets', 'generated', 'audio', 'dialogue');

// ── RetroDiffusion: Ashfields tileset ────────────────────────────────────
async function generateRetrodiffusion(): Promise<void> {
  const env = loadEnv();
  const apiKey = requireKey(env, 'RETRODIFFUSION_API_KEY');
  ensureDir(SPRITES_DIR);

  const TILE_COUNT = 16;
  const TILE_SIZE  = 32;

  console.log(`Requesting ${TILE_COUNT} Ashfields tileset sprites (${TILE_SIZE}x${TILE_SIZE})...`);

  const prompt = [
    `${TILE_SIZE}x${TILE_SIZE} pixel art tileset for a desolate ashfield region.`,
    `${TILE_COUNT} tiles: cracked earth, ash-covered stone path, dead tree stump,`,
    'collapsed wall ruins, ember ground, scorched grass, broken cobblestone,',
    'ash pile, charred wooden beam, rusted iron gate, fog ground overlay,',
    'bone fragments in dirt, shattered shield on ground, torch sconce (unlit),',
    'crumbled pillar base, dark water puddle.',
    'Style: dark fantasy, muted palette (grays, browns, deep reds).',
    'No human figures. No suggestive content. Game-appropriate.',
  ].join(' ');

  const result = await postJson('https://api.retrodiffusion.ai/v1/generate', {
    prompt,
    width: TILE_SIZE * 4,   // 4×4 grid = 16 tiles
    height: TILE_SIZE * 4,
    num_images: 1,
  }, {
    'Authorization': `Bearer ${apiKey}`,
  });

  const response = result as Record<string, unknown>;
  if (response['error']) {
    console.error('RetroDiffusion error:', response['error']);
    return;
  }

  console.log('RetroDiffusion response received.');
  console.log('Output:', JSON.stringify(response).slice(0, 300));

  // If base64 image data is returned, save it
  const images = response['images'] as Array<{ base64?: string }> | undefined;
  if (images?.[0]?.base64) {
    const outPath = path.join(SPRITES_DIR, 'ashfields_tileset.png');
    fs.writeFileSync(outPath, Buffer.from(images[0].base64, 'base64'));
    console.log(`Saved: ${outPath}`);
  } else {
    const outPath = path.join(SPRITES_DIR, 'ashfields_tileset_response.json');
    fs.writeFileSync(outPath, JSON.stringify(response, null, 2));
    console.log(`Response saved to: ${outPath} (check for download URL)`);
  }
}

// ── FreeSound: Ashfields ambient sounds ──────────────────────────────────
async function generateFreesound(): Promise<void> {
  const env = loadEnv();
  const apiKey = requireKey(env, 'FREESOUND_API_KEY');
  ensureDir(AMBIENT_DIR);

  const SOUNDS = [
    { query: 'wind desolate howling ambient', filename: 'wind_ashfields.wav' },
    { query: 'distant bell tolling dark', filename: 'distant_bell.wav' },
    { query: 'footstep stone cobblestone walk', filename: 'footstep_stone.wav' },
  ] as const;

  for (const sound of SOUNDS) {
    console.log(`Searching FreeSound for: "${sound.query}"...`);

    const searchUrl = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(sound.query)}&fields=id,name,previews&page_size=1&token=${apiKey}`;
    const searchResult = await fetchJson(searchUrl) as {
      results?: Array<{
        id: number;
        name: string;
        previews?: Record<string, string>;
      }>;
    };

    const first = searchResult.results?.[0];
    if (!first) {
      console.warn(`  No results found for "${sound.query}"`);
      continue;
    }

    console.log(`  Found: "${first.name}" (id: ${first.id})`);

    // Download the HQ preview (no OAuth needed for previews)
    const previewUrl = first.previews?.['preview-hq-mp3']
      ?? first.previews?.['preview-lq-mp3'];

    if (!previewUrl) {
      console.warn(`  No preview URL available for "${first.name}"`);
      continue;
    }

    const outPath = path.join(AMBIENT_DIR, sound.filename);
    console.log(`  Downloading to ${outPath}...`);
    await downloadFile(previewUrl, outPath);
    console.log(`  Saved: ${outPath}`);
  }
}

// ── ElevenLabs: Magistra Eon dialogue ────────────────────────────────────
async function generateElevenlabs(): Promise<void> {
  const env = loadEnv();
  const apiKey = requireKey(env, 'ELEVENLABS_API_KEY');
  ensureDir(DIALOGUE_DIR);

  const LINES = [
    { id: 'magistra_eon_01', text: 'The Accord did not fall. It was unmade, piece by piece, by those who swore to protect it.' },
    { id: 'magistra_eon_02', text: 'You carry something that does not belong to you. But then, it never belonged to anyone.' },
    { id: 'magistra_eon_03', text: 'Edric believed he was saving us. He was wrong. But so were we, for letting him try alone.' },
  ] as const;

  // Use a default voice — "Rachel" is a good fit for a wise elder character
  // List voices first to find a suitable one
  console.log('Fetching available ElevenLabs voices...');
  const voicesResult = await fetchJson('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey } as Record<string, string>,
  }) as { voices?: Array<{ voice_id: string; name: string }> };

  const voices = voicesResult.voices ?? [];
  // Prefer "Rachel" or first available voice
  const voice = voices.find((v) => v.name === 'Rachel')
    ?? voices[0];

  if (!voice) {
    console.error('No voices available on this ElevenLabs account.');
    return;
  }

  console.log(`Using voice: "${voice.name}" (${voice.voice_id})`);

  for (const line of LINES) {
    console.log(`Generating: ${line.id}...`);

    const result = await postJson(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}`,
      {
        text: line.text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
        },
      },
      { 'xi-api-key': apiKey },
    );

    if (Buffer.isBuffer(result)) {
      const outPath = path.join(DIALOGUE_DIR, `${line.id}.mp3`);
      fs.writeFileSync(outPath, result);
      console.log(`  Saved: ${outPath}`);
    } else {
      const resp = result as Record<string, unknown>;
      console.error(`  ElevenLabs error for ${line.id}:`, resp['detail'] ?? resp);
    }
  }
}

// ── CLI entry point ──────────────────────────────────────────────────────
const COMMANDS: Record<string, () => Promise<void>> = {
  retrodiffusion: generateRetrodiffusion,
  freesound:      generateFreesound,
  elevenlabs:     generateElevenlabs,
};

async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command || !COMMANDS[command]) {
    console.log('Usage: npx tsx scripts/generate-assets.ts <command>');
    console.log('');
    console.log('Commands:');
    console.log('  retrodiffusion  Generate Ashfields tileset sprites');
    console.log('  freesound       Download Ashfields ambient sounds');
    console.log('  elevenlabs      Generate Magistra Eon dialogue lines');
    process.exit(1);
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  await handler();
  console.log('Done.');
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

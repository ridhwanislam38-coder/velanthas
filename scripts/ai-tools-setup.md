# AI Asset Generation Tools — Setup Guide

## 1. Get API Keys

### RetroDiffusion (pixel-art sprite generation)
1. Go to https://retrodiffusion.ai
2. Create an account and subscribe to a plan
3. Navigate to Dashboard > API Keys
4. Copy your API key

### FreeSound (ambient sound effects)
1. Go to https://freesound.org
2. Create an account
3. Go to https://freesound.org/apiv2/apply
4. Create a new API application (name: "Velanthas Asset Pipeline")
5. Copy the Client Secret (API key)

### ElevenLabs (NPC dialogue voice synthesis)
1. Go to https://elevenlabs.io
2. Create an account (free tier has 10k characters/month)
3. Go to Profile > API Keys
4. Copy your API key

## 2. Configure .env File

Create or edit `.env` in the project root (`C:\Users\nawfi\StudyQuestV3\.env`):

```env
# AI Asset Generation Keys
RETRODIFFUSION_API_KEY=rd_your_key_here
FREESOUND_API_KEY=your_freesound_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
```

**Do NOT commit .env to git.** Verify `.gitignore` includes `.env`.

## 3. Install Dependencies

```bash
npm install dotenv
npm install -D tsx
```

## 4. Generate Assets

Run one command per tool:

```bash
# Generate Ashfields tileset sprites (16 tiles, 32x32)
npm run generate retrodiffusion

# Download Ashfields ambient sounds (wind, distant bell, footstep_stone)
npm run generate freesound

# Generate Magistra Eon's first 3 dialogue lines as .mp3
npm run generate elevenlabs
```

Each command will create files in `assets/generated/` with subdirectories per tool.

## Output Locations

| Tool           | Output Directory                        |
|----------------|-----------------------------------------|
| RetroDiffusion | `assets/generated/sprites/`             |
| FreeSound      | `assets/generated/audio/ambient/`       |
| ElevenLabs     | `assets/generated/audio/dialogue/`      |

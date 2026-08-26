import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

async function remuxFaststart(filePath) {
  if (!/\.mp4$/i.test(filePath) || !existsSync(filePath)) return false;
  const tempPath = `${filePath}.faststart.mp4`;
  try {
    await runCommand('ffmpeg', [
      '-y',
      '-i', filePath,
      '-c', 'copy',
      '-movflags', '+faststart',
      tempPath,
    ]);
    unlinkSync(filePath);
    renameSync(tempPath, filePath);
    return true;
  } catch {
    try { if (existsSync(tempPath)) unlinkSync(tempPath); } catch { /* ignore */ }
    return false;
  }
}

function readRequestBody(request) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolveBody(body));
    request.on('error', reject);
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(stderr || stdout || `${command} failed with code ${code}`));
    });
  });
}

function findYtDlpCommand() {
  return [
    ['yt-dlp', []],
    ['py', ['-m', 'yt_dlp']],
    ['python', ['-m', 'yt_dlp']],
  ];
}

async function runYtDlp(args) {
  let lastError = null;
  for (const [command, prefix] of findYtDlpCommand()) {
    try {
      return await runCommand(command, [...prefix, ...args]);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('yt-dlp is not available. Install it with: pip install yt-dlp');
}

function spawnYtDlp(args, { onStdout, onStderr } = {}) {
  const attempts = findYtDlpCommand();
  return new Promise((resolvePromise, reject) => {
    let index = 0;
    const tryNext = () => {
      if (index >= attempts.length) {
        reject(new Error('yt-dlp is not available. Install it with: pip install yt-dlp'));
        return;
      }
      const [command, prefix] = attempts[index];
      index += 1;
      const child = spawn(command, [...prefix, ...args], { shell: false });
      let stdout = '';
      let stderr = '';
      let started = false;
      child.stdout?.on('data', (chunk) => {
        started = true;
        const text = chunk.toString();
        stdout += text;
        onStdout?.(text);
      });
      child.stderr?.on('data', (chunk) => {
        started = true;
        const text = chunk.toString();
        stderr += text;
        onStderr?.(text);
      });
      child.on('error', (error) => {
        if (error.code === 'ENOENT') tryNext();
        else reject(error);
      });
      child.on('close', (code) => {
        if (code === 0) resolvePromise({ stdout, stderr });
        else if (!started && index < attempts.length) tryNext();
        else reject(new Error(stderr || stdout || `${command} failed with code ${code}`));
      });
    };
    tryNext();
  });
}

function parseYtDlpProgress(chunk, job) {
  const lines = String(chunk).split(/\r?\n|\r/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const percentMatch = trimmed.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);
    if (percentMatch) {
      const percent = Math.min(99, Math.max(0, Number(percentMatch[1])));
      job.percent = percent;
      job.stage = 'downloading';
      job.message = `Downloading... ${percent.toFixed(0)}%`;
      const etaMatch = trimmed.match(/ETA\s+(\d+:\d+)/i);
      if (etaMatch) job.message = `Downloading... ${percent.toFixed(0)}% (ETA ${etaMatch[1]})`;
      continue;
    }
    if (/\[download\]\s+Destination:/i.test(trimmed) || /\[download\]\s+Downloading/i.test(trimmed)) {
      job.stage = 'downloading';
      if (job.percent < 1) job.message = 'Downloading video...';
      continue;
    }
    if (/Merging|\[Merger\]|\[Fixup/i.test(trimmed)) {
      job.stage = 'processing';
      job.percent = Math.max(job.percent, 95);
      job.message = 'Merging video and audio...';
      continue;
    }
    if (/Extracting URL|Downloading webpage|Downloading android/i.test(trimmed)) {
      if (job.stage !== 'downloading' && job.stage !== 'processing' && job.stage !== 'ready') {
        job.stage = 'resolving';
        job.message = 'Contacting YouTube...';
      }
    }
  }
}

function isYouTubeUrl(value) {
  try {
    const url = new URL(value);
    return /(^|\.)youtube\.com$/i.test(url.hostname) || /(^|\.)youtu\.be$/i.test(url.hostname) || /(^|\.)youtube-nocookie\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function renderPlugin() {
  const root = resolve(__dirname);
  const outputDir = join(root, 'output');
  const uploadDir = join(outputDir, 'uploaded-assets');
  const tempClipDir = join(outputDir, 'temp-clips');
  const youtubeJobs = new Map();
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(uploadDir, { recursive: true });
  mkdirSync(tempClipDir, { recursive: true });

  function publicJob(job) {
    return {
      jobId: job.id,
      stage: job.stage,
      percent: job.percent,
      message: job.message,
      done: job.done,
      error: job.error || null,
      result: job.result || null,
    };
  }

  function cleanYtError(message) {
    const lines = String(message || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const errors = lines.filter((line) => /^ERROR:/i.test(line));
    const picked = errors.at(-1) || lines.find((line) => !/^WARNING:/i.test(line)) || message;
    return String(picked).replace(/^ERROR:\s*/i, '').trim();
  }

  async function runYoutubeJob(job, url) {
    const clipId = randomBytes(8).toString('hex');
    const outTemplate = join(tempClipDir, `clip-${clipId}.%(ext)s`);
    try {
      job.stage = 'resolving';
      job.percent = 2;
      job.message = 'Reading video info...';

      let title = `clip-${clipId}`;
      let duration = null;
      try {
        const meta = await runYtDlp(['--no-playlist', '--no-warnings', '--no-update', '-j', url]);
        const info = JSON.parse(meta.stdout.split('\n').find((line) => line.trim().startsWith('{')) || '{}');
        title = info.title || title;
        duration = Number.isFinite(info.duration) ? Number(info.duration) : null;
        job.title = title;
        job.message = `Found "${title.slice(0, 48)}${title.length > 48 ? '...' : ''}"`;
        job.percent = 8;
      } catch {
        job.message = 'Starting download...';
      }

      job.stage = 'downloading';
      job.message = 'Downloading video...';
      // Prefer a single mp4 when possible to avoid Windows merge/rename locks.
      await spawnYtDlp([
        '--no-playlist',
        '--no-warnings',
        '--no-update',
        '--no-part',
        '--retries', '5',
        '--newline',
        '-f', 'b[ext=mp4]/best[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/b',
        '--merge-output-format', 'mp4',
        '-o', outTemplate,
        url,
      ], {
        onStderr: (text) => parseYtDlpProgress(text, job),
        onStdout: (text) => parseYtDlpProgress(text, job),
      });

      job.stage = 'processing';
      job.percent = 97;
      job.message = 'Preparing temporary clip...';

      const files = readdirSync(tempClipDir).filter((name) => name.startsWith(`clip-${clipId}.`));
      if (!files.length) throw new Error('Download finished but no video file was found.');
      const fileName = files[0];
      const absolutePath = join(tempClipDir, fileName);

      job.message = 'Making clip seekable in the editor...';
      job.percent = 98;
      await remuxFaststart(absolutePath);

      job.stage = 'ready';
      job.percent = 100;
      job.message = 'Ready';
      job.done = true;
      job.result = {
        path: `output/temp-clips/${fileName}`,
        title,
        duration,
        temporary: true,
      };
    } catch (error) {
      job.done = true;
      job.stage = 'error';
      job.error = cleanYtError(error.message) || 'Failed to fetch YouTube video. Install yt-dlp (pip install yt-dlp) and try again.';
      job.message = job.error;
    } finally {
      // Drop finished jobs after 30 minutes
      setTimeout(() => youtubeJobs.delete(job.id), 30 * 60 * 1000);
    }
  }

  return {
    name: 'muvidb-render-api',
    configureServer(server) {
      server.middlewares.use('/api/fetch-youtube', async (request, response) => {
        if (request.method === 'GET') {
          const raw = request.originalUrl || request.url || '';
          const parsed = new URL(raw, 'http://127.0.0.1');
          const jobId = parsed.searchParams.get('jobId');
          const job = jobId ? youtubeJobs.get(jobId) : null;
          if (!job) {
            response.statusCode = 404;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Job not found.' }));
            return;
          }
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(publicJob(job)));
          return;
        }

        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end('Method not allowed');
          return;
        }

        try {
          const body = await readRequestBody(request);
          const { url } = JSON.parse(body || '{}');
          if (!url || !isYouTubeUrl(url)) {
            response.statusCode = 400;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Provide a valid YouTube URL.' }));
            return;
          }

          const jobId = randomBytes(8).toString('hex');
          const job = {
            id: jobId,
            stage: 'queued',
            percent: 0,
            message: 'Queued…',
            done: false,
            error: null,
            result: null,
            title: null,
          };
          youtubeJobs.set(jobId, job);
          runYoutubeJob(job, url);

          response.statusCode = 202;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(publicJob(job)));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({
            error: error.message || 'Failed to start YouTube fetch.',
          }));
        }
      });

      server.middlewares.use('/api/clear-temp-clip', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end('Method not allowed');
          return;
        }
        try {
          const body = await readRequestBody(request);
          const { path: relativePath } = JSON.parse(body || '{}');
          if (!relativePath || !String(relativePath).startsWith('output/temp-clips/')) {
            response.statusCode = 400;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Only temp-clips paths can be cleared.' }));
            return;
          }
          const filePath = join(root, relativePath);
          if (existsSync(filePath)) unlinkSync(filePath);
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ ok: true }));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: error.message }));
        }
      });

      // Serve temp clips + uploads from /output/* during development
      server.middlewares.use((request, response, next) => {
        const urlPath = (request.url || '').split('?')[0];
        if (!urlPath.startsWith('/output/')) {
          next();
          return;
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          next();
          return;
        }
        const relative = decodeURIComponent(urlPath.replace(/^\/output\//, ''));
        if (!relative || relative.includes('..')) {
          response.statusCode = 400;
          response.end('Invalid path');
          return;
        }
        const filePath = join(outputDir, relative);
        if (!existsSync(filePath) || !filePath.startsWith(outputDir)) {
          response.statusCode = 404;
          response.end('Not found');
          return;
        }
        const lower = filePath.toLowerCase();
        const type = lower.endsWith('.mp4') ? 'video/mp4'
          : lower.endsWith('.webm') ? 'video/webm'
          : lower.endsWith('.mov') ? 'video/quicktime'
          : lower.endsWith('.m4v') ? 'video/x-m4v'
          : lower.endsWith('.png') ? 'image/png'
          : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg'
          : 'application/octet-stream';
        response.statusCode = 200;
        response.setHeader('Content-Type', type);
        createReadStream(filePath).pipe(response);
      });

      server.middlewares.use('/api/list-assets', (request, response) => {
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.end('Method not allowed');
          return;
        }
        const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm'];
        const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac'];
        const files = existsSync(uploadDir) ? readdirSync(uploadDir) : [];
        const items = files.map((name) => {
          const lower = name.toLowerCase();
          let kind = 'image';
          if (videoExtensions.some((ext) => lower.endsWith(ext))) kind = 'video';
          else if (audioExtensions.some((ext) => lower.endsWith(ext))) kind = 'audio';
          return { name, path: `output/uploaded-assets/${name}`, kind };
        });
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(items));
      });

      server.middlewares.use('/api/save-asset', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end('Method not allowed');
          return;
        }

        try {
          const body = await readRequestBody(request);
          const { dataUrl, filename } = JSON.parse(body || '{}');
          if (!dataUrl || !dataUrl.startsWith('data:')) {
            response.statusCode = 400;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Missing or invalid dataUrl' }));
            return;
          }

          const commaIndex = dataUrl.indexOf(',');
          if (commaIndex < 0) {
            response.statusCode = 400;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Malformed data URL' }));
            return;
          }

          const metadata = dataUrl.substring(0, commaIndex);
          const payload = dataUrl.substring(commaIndex + 1);
          const isBase64 = metadata.includes(';base64');
          const buffer = isBase64
            ? Buffer.from(payload, 'base64')
            : Buffer.from(decodeURIComponent(payload), 'utf-8');

          // Determine extension from MIME type or filename
          let ext = '.bin';
          const mimeMatch = metadata.match(/data:([^;,]+)/);
          if (mimeMatch) {
            const mime = mimeMatch[1];
            const mimeExtMap = {
              'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
              'image/webp': '.webp', 'video/mp4': '.mp4', 'video/quicktime': '.mov',
              'video/webm': '.webm', 'video/x-m4v': '.m4v',
              'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav',
              'audio/mp4': '.m4a', 'audio/ogg': '.ogg', 'audio/aac': '.aac', 'audio/flac': '.flac',
            };
            ext = mimeExtMap[mime] || ext;
          }
          if (filename) {
            const dotIndex = filename.lastIndexOf('.');
            if (dotIndex > 0) ext = filename.substring(dotIndex);
          }

          const { createHash } = await import('node:crypto');
          const hash = createHash('md5').update(buffer).digest('hex').substring(0, 12);
          const safeName = `uploaded-${hash}${ext}`;
          const filePath = join(uploadDir, safeName);

          const { writeFileSync: writeSync } = await import('node:fs');
          writeSync(filePath, buffer);

          const relativePath = `output/uploaded-assets/${safeName}`;
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ path: relativePath }));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: error.message }));
        }
      });

      server.middlewares.use('/api/render', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end('Method not allowed');
          return;
        }

        try {
          const body = await readRequestBody(request);
          const config = JSON.parse(body || '{}');
          const safeOutputName = basename(config.outputName || 'muvidb-reel.mp4');
          config.outputName = safeOutputName;
          config.coverName = basename(config.coverName || 'cover.png');
          const configPath = join(outputDir, 'render-request-' + Date.now() + '.json');
          writeFileSync(configPath, JSON.stringify(config, null, 2));

          const child = spawn('swift', ['render.swift', configPath], { cwd: root });
          let stderr = '';
          child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
          });
          child.on('error', (error) => {
            response.statusCode = 500;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: error.message }));
          });
          child.on('close', (code) => {
            if (code !== 0) {
              response.statusCode = 500;
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ error: stderr || ('Swift render failed with code ' + code) }));
              return;
            }

            const videoPath = join(outputDir, safeOutputName);
            if (!existsSync(videoPath)) {
              response.statusCode = 500;
              response.setHeader('Content-Type', 'application/json');
              response.end(JSON.stringify({ error: 'Rendered MP4 was not found.' }));
              return;
            }

            response.statusCode = 200;
            response.setHeader('Content-Type', 'video/mp4');
            response.setHeader('Content-Disposition', 'attachment; filename="' + safeOutputName + '"');
            createReadStream(videoPath).pipe(response);
          });
        } catch (error) {
          response.statusCode = 500;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), renderPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
  },
});

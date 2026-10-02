import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import dotenv from 'dotenv';
import express from 'express';
import { GridFSBucket, MongoClient, ObjectId } from 'mongodb';
import multer from 'multer';

dotenv.config({ path: fileURLToPath(new URL('../anish.env', import.meta.url)) });

const {
  MONGODB_URI,
  MONGODB_DB_NAME = 'birthday_wish',
  LOGIN_USERNAME = 'love',
  LOGIN_PASSWORD = 'love',
} = process.env;
const PORT = Number(process.env.PORT || 3001);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const SESSION_COOKIE = 'birthday_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const sessions = new Map();
const loginAttempts = new Map();
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

if (!MONGODB_URI) {
  console.error('MONGODB_URI must be set in anish.env.');
  process.exit(1);
}

if (!/^mongodb(?:\+srv)?:\/\//.test(MONGODB_URI)) {
  console.error(
    'MONGODB_URI must be the Atlas Drivers connection string starting with mongodb+srv://, not the Atlas dashboard URL.',
  );
  process.exit(1);
}

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/gif') {
    return ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6));
  }
  if (mimeType === 'image/webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  if (mimeType === 'image/avif') {
    return buffer.toString('ascii', 4, 8) === 'ftyp'
      && ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12));
  }
  return false;
}

function constantTimeStringMatch(suppliedValue, expectedValue) {
  if (typeof suppliedValue !== 'string' || typeof expectedValue !== 'string') {
    return false;
  }

  const supplied = Buffer.from(suppliedValue);
  const expected = Buffer.from(expectedValue);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function getSession(request) {
  const token = request.cookies?.[SESSION_COOKIE];
  const expiresAt = sessions.get(token);
  if (!expiresAt) {
    return null;
  }
  if (expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return token;
}

function requireSession(request, response, next) {
  if (!getSession(request)) {
    response.status(401).json({ error: 'Please log in to continue.' });
    return;
  }
  next();
}

function parseCookies(request, _response, next) {
  const cookieHeader = request.headers.cookie || '';
  request.cookies = Object.fromEntries(
    cookieHeader.split(';').map((part) => {
      const separator = part.indexOf('=');
      if (separator < 0) {
        return ['', ''];
      }
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        return [name, decodeURIComponent(value)];
      } catch {
        return [name, ''];
      }
    }).filter(([name]) => name),
  );
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter(_request, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(new Error('Choose a JPEG, PNG, WebP, GIF, or AVIF image.'));
      return;
    }
    callback(null, true);
  },
});

async function startServer() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log(`Connected to MongoDB database "${MONGODB_DB_NAME}".`);

  const database = client.db(MONGODB_DB_NAME);
  const bucket = new GridFSBucket(database, { bucketName: 'birthdayImages' });
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.use(parseCookies);

  app.get('/api/auth/session', (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json({ authenticated: Boolean(getSession(request)) });
  });

  app.post('/api/auth/login', (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const now = Date.now();
    const attempts = (loginAttempts.get(request.ip) || []).filter(
      (timestamp) => timestamp > now - LOGIN_ATTEMPT_WINDOW_MS,
    );
    if (attempts.length >= MAX_LOGIN_ATTEMPTS) {
      loginAttempts.set(request.ip, attempts);
      response.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
      return;
    }

    const { username, password } = request.body || {};
    if (
      !constantTimeStringMatch(username, LOGIN_USERNAME)
      || !constantTimeStringMatch(password, LOGIN_PASSWORD)
    ) {
      attempts.push(now);
      loginAttempts.set(request.ip, attempts);
      response.status(401).json({ error: 'That username and password do not match.' });
      return;
    }

    loginAttempts.delete(request.ip);
    const token = randomBytes(32).toString('hex');
    for (const [existingToken, expiresAt] of sessions) {
      if (expiresAt <= now) {
        sessions.delete(existingToken);
      }
    }
    sessions.set(token, now + SESSION_TTL_MS);
    response.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    );
    response.json({ authenticated: true });
  });

  app.post('/api/auth/logout', (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const token = request.cookies?.[SESSION_COOKIE];
    if (token) {
      sessions.delete(token);
    }
    response.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    );
    response.json({ authenticated: false });
  });

  app.get('/api/images', requireSession, async (_request, response, next) => {
    try {
      const files = await bucket.find({}).sort({ uploadDate: -1 }).limit(100).toArray();
      response.json({
        images: files.map((file) => ({
          id: file._id.toString(),
          filename: file.filename,
          uploadDate: file.uploadDate.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/images', requireSession, (request, response, next) => {
    upload.single('image')(request, response, (error) => {
      if (error) {
        next(error);
        return;
      }

      saveImage(request, response, next);
    });
  });

  async function saveImage(request, response, next) {
    try {
      const file = request.file;
      if (!file) {
        response.status(400).json({ error: 'Choose an image to upload.' });
        return;
      }
      if (!hasValidImageSignature(file.buffer, file.mimetype)) {
        response.status(400).json({ error: 'The selected file is not a supported image.' });
        return;
      }

      const filename = file.originalname.replace(/[\\/]/g, '_').slice(0, 200) || 'birthday-image';
      const uploadStream = bucket.openUploadStream(filename, {
        metadata: { contentType: file.mimetype },
      });
      await pipeline(Readable.from([file.buffer]), uploadStream);
      response.status(201).json({ id: uploadStream.id.toString(), filename });
    } catch (error) {
      next(error);
    }
  }

  app.get('/api/images/:id', requireSession, async (request, response, next) => {
    if (!/^[a-f\d]{24}$/i.test(request.params.id)) {
      response.status(400).json({ error: 'Invalid image id.' });
      return;
    }

    try {
      const id = new ObjectId(request.params.id);
      const [file] = await bucket.find({ _id: id }).limit(1).toArray();
      if (!file) {
        response.status(404).json({ error: 'Image not found.' });
        return;
      }

      const contentType = file.metadata?.contentType;
      if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
        response.status(415).json({ error: 'Unsupported image type.' });
        return;
      }

      response.set({
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=3600',
      });
      await pipeline(bucket.openDownloadStream(id), response);
    } catch (error) {
      if (!response.headersSent) {
        next(error);
      } else {
        response.destroy(error);
      }
    }
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Each image must be 8 MB or smaller.'
        : 'The image upload could not be processed.';
      response.status(400).json({ error: message });
      return;
    }
    if (error.message.startsWith('Choose a JPEG')) {
      response.status(400).json({ error: error.message });
      return;
    }

    console.error('API request failed:', error);
    response.status(500).json({ error: 'The request failed. Check the server logs and try again.' });
  });

  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`Birthday image API listening on http://127.0.0.1:${PORT}`);
  });

  async function shutDown() {
    server.close(async () => {
      await client.close();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutDown);
  process.on('SIGTERM', shutDown);
}

startServer().catch((error) => {
  console.error('Could not start the image API:', error);
  process.exit(1);
});

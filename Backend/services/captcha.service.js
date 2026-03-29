const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { poolPromise } = require('../config/db');
const { logger: defaultLogger } = require('../utils/logger');

const LOG_PREFIX = '[CaptchaService]';
const VALID_TYPES = new Set(['self-hosted', 'captcha-google']);
const TOLERANCE_PX = 18;
const CHALLENGE_TTL_MS = 120_000;
const VERIFICATION_TTL_MS = 120_000;
const CLEANUP_INTERVAL_MS = 60_000;
const PIECE_SIZE = 50;
const BG_WIDTH = 340;
const BG_HEIGHT = 190;

// In-memory stores
const challengeStore = new Map();
const verificationStore = new Map();

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of challengeStore) {
    if (now - val.createdAt > CHALLENGE_TTL_MS) challengeStore.delete(key);
  }
  for (const [key, val] of verificationStore) {
    if (now - val.createdAt > VERIFICATION_TTL_MS) verificationStore.delete(key);
  }
}, CLEANUP_INTERVAL_MS);

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

const createCaptchaService = ({
  mysqlPoolPromise = poolPromise,
  logger = defaultLogger,
} = {}) => {

  async function resolvePortalCaptchaConfig(portal) {
    try {
      const pool = await mysqlPoolPromise;
      const [rows] = await pool.query(
        "SELECT params FROM param_config WHERE name = 'setRecapchaLogin'"
      );
      if (!rows.length) return { active: 0 };

      let params = rows[0].params;
      if (typeof params === 'string') params = JSON.parse(params);
      if (Buffer.isBuffer(params)) params = JSON.parse(params.toString('utf8'));

      if (params.enable !== 1) return { active: 0 };

      const portalConfig = params.portal?.[portal];
      if (!portalConfig) return { active: 0 };
      if (portalConfig.active !== 1) return { active: 0 };
      if (!VALID_TYPES.has(portalConfig.type)) return { active: 0 };

      return { active: 1, type: portalConfig.type };
    } catch (err) {
      logger.error(`${LOG_PREFIX} Error resolving config for portal=${portal}: ${err.message}`);
      return { active: 0 };
    }
  }

  // ---------------------------------------------------------------------------
  // Puzzle challenge generation
  // ---------------------------------------------------------------------------

  async function generateChallenge() {
    const bgDir = path.join(__dirname, '../public/captcha-backgrounds');
    let files = [];
    try {
      files = fs.readdirSync(bgDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    } catch (_) { /* dir may not exist */ }

    if (!files.length) {
      throw Object.assign(new Error('No captcha background images found'), { status: 503 });
    }

    const bgFile = files[Math.floor(Math.random() * files.length)];
    const bgPath = path.join(bgDir, bgFile);

    const bgBuffer = await sharp(bgPath).resize(BG_WIDTH, BG_HEIGHT).png().toBuffer();

    // Random position (keep margin from edges)
    const margin = PIECE_SIZE + 30;
    const x = Math.floor(Math.random() * (BG_WIDTH - margin - margin)) + margin;
    const y = Math.floor(Math.random() * (BG_HEIGHT - PIECE_SIZE - 20)) + 10;

    // Create puzzle piece shape SVG mask (jigsaw-like with random tabs)
    const s = PIECE_SIZE;
    const tab = 10;

    // Randomly decide tab direction for each side: 1=outward, -1=inward
    const topTab = Math.random() > 0.5 ? -1 : 1;
    const rightTab = Math.random() > 0.5 ? 1 : -1;
    const bottomTab = Math.random() > 0.5 ? 1 : -1;
    const leftTab = Math.random() > 0.5 ? -1 : 1;

    const puzzlePath = [
      `M0,0`,
      // Top edge
      `L${s * 0.35},0`,
      `C${s * 0.35},${topTab * tab} ${s * 0.65},${topTab * tab} ${s * 0.65},0`,
      `L${s},0`,
      // Right edge
      `L${s},${s * 0.35}`,
      `C${s + rightTab * tab},${s * 0.35} ${s + rightTab * tab},${s * 0.65} ${s},${s * 0.65}`,
      `L${s},${s}`,
      // Bottom edge
      `L${s * 0.65},${s}`,
      `C${s * 0.65},${s + bottomTab * tab} ${s * 0.35},${s + bottomTab * tab} ${s * 0.35},${s}`,
      `L0,${s}`,
      // Left edge
      `L0,${s * 0.65}`,
      `C${leftTab * tab},${s * 0.65} ${leftTab * tab},${s * 0.35} 0,${s * 0.35}`,
      `Z`
    ].join(' ');

    // Piece mask with white border for visibility
    const maskSvg = `<svg width="${s + tab * 2}" height="${s + tab * 2}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${tab},${tab})">
        <path d="${puzzlePath}" fill="white"/>
      </g>
    </svg>`;

    const borderSvg = `<svg width="${s + tab * 2}" height="${s + tab * 2}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${tab},${tab})">
        <path d="${puzzlePath}" fill="none" stroke="white" stroke-width="1.8"/>
      </g>
    </svg>`;

    // Extract region larger than piece to account for tabs
    const extractLeft = Math.max(0, x - tab);
    const extractTop = Math.max(0, y - tab);
    const extractW = Math.min(s + tab * 2, BG_WIDTH - extractLeft);
    const extractH = Math.min(s + tab * 2, BG_HEIGHT - extractTop);

    const regionBuffer = await sharp(bgBuffer)
      .extract({ left: extractLeft, top: extractTop, width: extractW, height: extractH })
      .resize(s + tab * 2, s + tab * 2, { fit: 'fill' })
      .png()
      .toBuffer();

    // Apply puzzle mask to get the piece, then add white border
    const maskBuffer = await sharp(Buffer.from(maskSvg)).resize(s + tab * 2, s + tab * 2).png().toBuffer();
    const borderBuffer = await sharp(Buffer.from(borderSvg)).resize(s + tab * 2, s + tab * 2).png().toBuffer();
    const pieceBuffer = await sharp(regionBuffer)
      .composite([
        { input: maskBuffer, blend: 'dest-in' },
      ])
      .png()
      .toBuffer();
    // Add border on top of masked piece
    const pieceWithBorder = await sharp(pieceBuffer)
      .composite([{ input: borderBuffer, blend: 'over' }])
      .png()
      .toBuffer();

    // Create hole overlay on background (darker fill + thick white border)
    const holeSvg = `<svg width="${s + tab * 2}" height="${s + tab * 2}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${tab},${tab})">
        <path d="${puzzlePath}" fill="rgba(0,0,0,0.55)"/>
        <path d="${puzzlePath}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.8"/>
      </g>
    </svg>`;
    const holeBuffer = await sharp(Buffer.from(holeSvg)).resize(s + tab * 2, s + tab * 2).png().toBuffer();

    const bgWithHole = await sharp(bgBuffer)
      .composite([{ input: holeBuffer, left: extractLeft, top: extractTop }])
      .png()
      .toBuffer();

    const token = crypto.randomUUID();
    challengeStore.set(token, { expectedX: x, createdAt: Date.now() });

    return {
      background: bgWithHole.toString('base64'),
      piece: pieceWithBorder.toString('base64'),
      token,
      pieceY: extractTop,
      pieceSize: s + tab * 2,
    };
  }

  // ---------------------------------------------------------------------------
  // Puzzle verification
  // ---------------------------------------------------------------------------

  function verifyChallenge(token, submittedX) {
    const challenge = challengeStore.get(token);
    challengeStore.delete(token); // single-use

    if (!challenge) return { success: false };
    if (Date.now() - challenge.createdAt > CHALLENGE_TTL_MS) return { success: false };

    const diff = Math.abs(challenge.expectedX - submittedX);
    if (diff > TOLERANCE_PX) return { success: false };

    const verificationToken = crypto.randomUUID();
    verificationStore.set(verificationToken, { createdAt: Date.now() });

    return { success: true, verificationToken };
  }

  function validateVerificationToken(verificationToken) {
    if (!verificationToken) return false;
    const entry = verificationStore.get(verificationToken);
    verificationStore.delete(verificationToken); // single-use
    if (!entry) return false;
    if (Date.now() - entry.createdAt > VERIFICATION_TTL_MS) return false;
    return true;
  }

  return {
    resolvePortalCaptchaConfig,
    generateChallenge,
    verifyChallenge,
    validateVerificationToken,
  };
};

module.exports = { createCaptchaService };

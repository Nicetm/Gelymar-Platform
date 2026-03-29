/**
 * Self-hosted puzzle slider captcha — modal version.
 * Shows a modal with puzzle image + slider when triggered.
 * 
 * initPuzzleCaptcha(triggerEl, { apiUrl, portal, onVerified })
 *   triggerEl: the form submit button — captcha modal opens on click
 *   onVerified(token): called when puzzle is solved, token is the verification token
 */
export function initPuzzleCaptcha(containerEl, { apiUrl, portal, onVerified }) {
  const BG_W = 340;
  const BG_H = 190;

  let token = null;
  let pieceY = 0;
  let pieceSize = 70;
  let bgImg = null;
  let pieceImg = null;
  let isDragging = false;
  let sliderX = 0;
  let verified = false;

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#fff;border-radius:12px;padding:20px;width:380px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative;';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;';
  const title = document.createElement('span');
  title.textContent = 'Verification';
  title.style.cssText = 'font-size:16px;font-weight:600;color:#1f2937;';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="#6b7280" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
  closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;';
  closeBtn.addEventListener('click', () => hide());
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Canvas area
  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'position:relative;width:340px;height:190px;border-radius:8px;overflow:hidden;background:#e5e7eb;margin:0 auto;';
  const canvas = document.createElement('canvas');
  canvas.width = BG_W;
  canvas.height = BG_H;
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  canvasWrap.appendChild(canvas);

  const statusEl = document.createElement('div');
  statusEl.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:28px;font-weight:700;border-radius:8px;';
  canvasWrap.appendChild(statusEl);
  modal.appendChild(canvasWrap);

  // Slider
  const sliderArea = document.createElement('div');
  sliderArea.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:14px;padding:0 2px;';

  const track = document.createElement('div');
  track.style.cssText = 'position:relative;flex:1;height:44px;background:#f3f4f6;border-radius:22px;border:1px solid #e5e7eb;overflow:visible;';

  const fill = document.createElement('div');
  fill.style.cssText = 'position:absolute;left:0;top:0;height:100%;width:22px;background:#00538C;border-radius:22px;opacity:0.12;pointer-events:none;';
  track.appendChild(fill);

  const hint = document.createElement('span');
  hint.textContent = 'Drag the slider to fit the puzzle piece';
  hint.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:12px;color:#9ca3af;pointer-events:none;white-space:nowrap;';
  track.appendChild(hint);

  const knob = document.createElement('div');
  knob.style.cssText = 'position:absolute;left:0;top:2px;width:40px;height:40px;background:#00538C;border-radius:50%;cursor:grab;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:2;';
  knob.innerHTML = '<svg width="18" height="18" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>';
  track.appendChild(knob);
  sliderArea.appendChild(track);

  // Refresh
  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.title = 'Refresh';
  refreshBtn.style.cssText = 'width:40px;height:40px;border-radius:50%;border:1px solid #e5e7eb;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
  refreshBtn.innerHTML = '<svg width="16" height="16" fill="none" stroke="#00538C" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15"/></svg>';
  refreshBtn.addEventListener('click', () => { if (!verified) loadChallenge(); });
  sliderArea.appendChild(refreshBtn);

  modal.appendChild(sliderArea);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const ctx = canvas.getContext('2d');

  function show() {
    overlay.style.display = 'flex';
    if (!verified) loadChallenge();
  }

  function hide() {
    overlay.style.display = 'none';
  }

  function draw() {
    ctx.clearRect(0, 0, BG_W, BG_H);
    if (bgImg) ctx.drawImage(bgImg, 0, 0, BG_W, BG_H);
    if (pieceImg) {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.drawImage(pieceImg, sliderX, pieceY, pieceSize, pieceSize);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  }

  function showStatus(text, color, bg) {
    statusEl.textContent = text;
    statusEl.style.display = 'flex';
    statusEl.style.color = color;
    statusEl.style.background = bg;
  }
  function hideStatus() { statusEl.style.display = 'none'; }

  function resetSlider() {
    sliderX = 0;
    knob.style.left = '0px';
    fill.style.width = '22px';
    hint.style.display = '';
    knob.style.background = '#00538C';
    draw();
  }

  async function loadChallenge() {
    verified = false;
    hideStatus();
    resetSlider();
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, BG_W, BG_H);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', BG_W / 2, BG_H / 2);

    try {
      const res = await fetch(`${apiUrl}/api/captcha/challenge?portal=${portal}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      token = data.token;
      pieceY = data.pieceY;
      pieceSize = data.pieceSize || 70;

      bgImg = new Image();
      pieceImg = new Image();
      await Promise.all([
        new Promise((ok, fail) => { bgImg.onload = ok; bgImg.onerror = fail; bgImg.src = `data:image/png;base64,${data.background}`; }),
        new Promise((ok, fail) => { pieceImg.onload = ok; pieceImg.onerror = fail; pieceImg.src = `data:image/png;base64,${data.piece}`; }),
      ]);
      draw();
    } catch (err) {
      ctx.clearRect(0, 0, BG_W, BG_H);
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(0, 0, BG_W, BG_H);
      ctx.fillStyle = '#ef4444';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Error loading. Click refresh.', BG_W / 2, BG_H / 2);
    }
  }

  // Drag handlers
  const maxSlide = BG_W - pieceSize;

  function onDown(e) {
    if (verified) return;
    isDragging = true;
    knob.style.cursor = 'grabbing';
    hint.style.display = 'none';
    e.preventDefault();
  }

  function onMove(e) {
    if (!isDragging) return;
    const rect = track.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    let x = clientX - rect.left - 20;
    x = Math.max(0, Math.min(x, rect.width - 40));
    // Map slider position to image position
    const ratio = x / (rect.width - 40);
    sliderX = ratio * maxSlide;
    knob.style.left = `${x}px`;
    fill.style.width = `${x + 22}px`;
    draw();
  }

  async function onUp() {
    if (!isDragging) return;
    isDragging = false;
    knob.style.cursor = 'grab';
    if (!token) return;

    try {
      const res = await fetch(`${apiUrl}/api/captcha/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, x: Math.round(sliderX) }),
      });
      const data = await res.json();

      if (data.success) {
        verified = true;
        showStatus('✓', '#16a34a', 'rgba(220,252,231,0.85)');
        knob.style.background = '#16a34a';
        if (onVerified) onVerified(data.verificationToken);
        setTimeout(() => hide(), 600);
      } else {
        showStatus('✗', '#dc2626', 'rgba(254,226,226,0.85)');
        knob.style.background = '#dc2626';
        setTimeout(() => loadChallenge(), 800);
      }
    } catch (err) {
      showStatus('Error', '#dc2626', 'rgba(254,226,226,0.85)');
      setTimeout(() => loadChallenge(), 1000);
    }
  }

  knob.addEventListener('mousedown', onDown);
  knob.addEventListener('touchstart', onDown, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);

  // Close on overlay click
  overlay.addEventListener('click', (e) => { if (e.target === overlay) hide(); });

  // Public API
  return { show, hide, refresh: loadChallenge };
}

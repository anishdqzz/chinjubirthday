import React, { useEffect, useRef, useState } from 'react';

function SunflowerBackdrop() {
  return (
    <div className="sunflower-backdrop" aria-hidden="true">
      {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-right'].map((position) => (
        <svg className={`sunflower sunflower-${position}`} key={position} viewBox="0 0 120 120">
          <g fill="#f4c62d" stroke="#171717" strokeWidth="2">
            <ellipse cx="60" cy="22" rx="10" ry="25" />
            <ellipse cx="60" cy="22" rx="10" ry="25" transform="rotate(45 60 60)" />
            <ellipse cx="60" cy="22" rx="10" ry="25" transform="rotate(90 60 60)" />
            <ellipse cx="60" cy="22" rx="10" ry="25" transform="rotate(135 60 60)" />
            <ellipse cx="60" cy="22" rx="10" ry="25" transform="rotate(180 60 60)" />
            <ellipse cx="60" cy="22" rx="10" ry="25" transform="rotate(225 60 60)" />
            <ellipse cx="60" cy="22" rx="10" ry="25" transform="rotate(270 60 60)" />
            <ellipse cx="60" cy="22" rx="10" ry="25" transform="rotate(315 60 60)" />
          </g>
          <circle cx="60" cy="60" r="23" fill="#222" stroke="#111" strokeWidth="3" />
          <circle cx="60" cy="60" r="13" fill="none" stroke="#f4c62d" strokeDasharray="1 5" strokeWidth="3" />
        </svg>
      ))}
    </div>
  );
}

async function getErrorMessage(response) {
  const result = await response.json().catch(() => ({}));
  return result.error || `Request failed (${response.status})`;
}

function App() {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isShooting, setIsShooting] = useState(false);
  const [isDraggingArrow, setIsDraggingArrow] = useState(false);
  const [arrowPosition, setArrowPosition] = useState(null);
  const [shotMessage, setShotMessage] = useState('Drag the arrow to the heart, then release');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('love');
  const [password, setPassword] = useState('love');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [images, setImages] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const archeryStageRef = useRef(null);
  const heartTargetRef = useRef(null);
  const arrowRef = useRef(null);
  const dragStartRef = useRef(null);
  const featuredImage = images[0];

  useEffect(() => {
    if (!isShooting) {
      return undefined;
    }

    const revealTimer = window.setTimeout(() => {
      setIsRevealed(true);
      setIsShooting(false);
      setArrowPosition(null);
    }, 850);

    return () => window.clearTimeout(revealTimer);
  }, [isShooting]);

  async function refreshImages() {
    const response = await fetch('/api/images');
    if (response.status === 401) {
      setIsAuthenticated(false);
      setIsRevealed(false);
      setIsShooting(false);
      setArrowPosition(null);
      throw new Error('Your login session expired. Please log in again.');
    }
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const result = await response.json();
    setImages(result.images);
    setGalleryError('');
  }

  useEffect(() => {
    let isActive = true;

    fetch('/api/auth/session')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }
        return response.json();
      })
      .then(async (result) => {
        if (isActive && result.authenticated) {
          setIsAuthenticated(true);
          setIsLoadingImages(true);
          const response = await fetch('/api/images');
          if (!response.ok) {
            throw new Error(await getErrorMessage(response));
          }
          const imageResult = await response.json();
          if (isActive) {
            setImages(imageResult.images);
          }
        }
      })
      .catch((error) => {
        if (isActive) {
          setGalleryError(error.message);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsCheckingSession(false);
          setIsLoadingImages(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    if (isLoggingIn) {
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setIsAuthenticated(true);
      setIsLoadingImages(true);
      await refreshImages();
    } catch (error) {
      setLoginError(error.message);
      setIsAuthenticated(false);
    } finally {
      setIsLoggingIn(false);
      setIsLoadingImages(false);
    }
  }

  async function handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setIsAuthenticated(false);
      setIsRevealed(false);
      setIsShooting(false);
      setArrowPosition(null);
      setShotMessage('Drag the arrow to the heart, then release');
      setImages([]);
      setSelectedFile(null);
      setLoginError('');
      setUploadError('');
      setUploadMessage('');
      setPassword('love');
      setUsername('love');
    } catch (error) {
      setLoginError(error.message);
    }
  }

  function handleArrowPointerDown(event) {
    if (isShooting || !archeryStageRef.current) {
      return;
    }

    event.preventDefault();
    const stageBounds = archeryStageRef.current.getBoundingClientRect();
    const arrowBounds = event.currentTarget.getBoundingClientRect();
    const start = {
      x: arrowBounds.left - stageBounds.left + arrowBounds.width / 2,
      y: arrowBounds.top - stageBounds.top + arrowBounds.height / 2,
    };
    dragStartRef.current = start;
    setArrowPosition({ ...start, angle: 0 });
    setShotMessage('Keep aiming at the heart…');
    setIsDraggingArrow(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleArrowPointerMove(event) {
    if (!isDraggingArrow || !archeryStageRef.current || !dragStartRef.current) {
      return;
    }

    const stageBounds = archeryStageRef.current.getBoundingClientRect();
    const x = event.clientX - stageBounds.left;
    const y = event.clientY - stageBounds.top;
    const angle = Math.atan2(y - dragStartRef.current.y, x - dragStartRef.current.x);
    setArrowPosition({ x, y, angle });
  }

  function handleArrowPointerUp(event) {
    if (!isDraggingArrow || !archeryStageRef.current || !heartTargetRef.current) {
      return;
    }

    const stageBounds = archeryStageRef.current.getBoundingClientRect();
    const x = event.clientX - stageBounds.left;
    const y = event.clientY - stageBounds.top;
    const angle = dragStartRef.current
      ? Math.atan2(y - dragStartRef.current.y, x - dragStartRef.current.x)
      : 0;
    const arrowLength = arrowRef.current?.getBoundingClientRect().width || 100;
    const arrowTipX = stageBounds.left + x + Math.cos(angle) * arrowLength / 2;
    const arrowTipY = stageBounds.top + y + Math.sin(angle) * arrowLength / 2;
    const heartBounds = heartTargetRef.current.getBoundingClientRect();
    const hitHeart = arrowTipX >= heartBounds.left - 10
      && arrowTipX <= heartBounds.right + 10
      && arrowTipY >= heartBounds.top - 10
      && arrowTipY <= heartBounds.bottom + 10;

    setIsDraggingArrow(false);
    dragStartRef.current = null;
    if (hitHeart) {
      setArrowPosition({ x, y, angle });
      setShotMessage('Bullseye! Your birthday surprise is here…');
      setIsShooting(true);
    } else {
      setArrowPosition(null);
      setShotMessage('Not quite! Drag the arrow to the heart and try again');
    }
  }

  function handleArrowPointerCancel() {
    setIsDraggingArrow(false);
    setArrowPosition(null);
    dragStartRef.current = null;
    setShotMessage('Drag the arrow to the heart, then release');
  }

  function handleKeyboardShoot() {
    if (!isShooting) {
      setShotMessage('Your birthday surprise is here…');
      setIsShooting(true);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!selectedFile || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      const response = await fetch('/api/images', {
        method: 'POST',
        body: formData,
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        setIsRevealed(false);
        throw new Error('Your login session expired. Please log in again.');
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      setUploadMessage('Birthday photo updated.');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await refreshImages();
    } catch (error) {
      setUploadError(error.message);
      try {
        await refreshImages();
      } catch (refreshError) {
        setGalleryError(refreshError.message);
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="scene">
      <SunflowerBackdrop />

      {isCheckingSession ? (
        <section className="login-card login-loading" aria-label="Loading login">
          <span className="login-spinner" aria-hidden="true" />
          <p>Getting your surprise ready…</p>
        </section>
      ) : !isAuthenticated ? (
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-icon" aria-hidden="true">♥</div>
          <p className="eyebrow">A little surprise awaits</p>
          <h1 id="login-title">Welcome, Chinju</h1>
          <p className="login-description">Sign in to open your birthday surprise</p>
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Username
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {loginError && <p className="login-error" role="alert">{loginError}</p>}
            <button className="login-button" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="login-footer">Made with love, just for you</p>
        </section>
      ) : (
        <div className="authenticated-content">
          <button className="logout-button" type="button" onClick={handleLogout}>
            Log out
          </button>
          {!isRevealed ? (
            <section
              className={`welcome${isShooting ? ' is-shooting' : ''}${isDraggingArrow ? ' is-dragging-arrow' : ''}`}
              aria-label="Birthday surprise"
            >
              <p className="eyebrow">A little surprise for you</p>
              <div
                className="archery-stage"
                ref={archeryStageRef}
                onPointerMove={handleArrowPointerMove}
                onPointerUp={handleArrowPointerUp}
                onPointerCancel={handleArrowPointerCancel}
              >
                <svg className="bow" viewBox="0 0 100 180" role="img" aria-label="A bow ready to shoot">
                  <path d="M72 10 Q5 90 72 170" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                  <path d="M72 10 L72 170" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <button
                  ref={arrowRef}
                  className="flying-arrow"
                  type="button"
                  aria-label="Drag the arrow to the heart to reveal your birthday surprise"
                  disabled={isShooting}
                  onPointerDown={handleArrowPointerDown}
                  onClick={(event) => {
                    if (event.detail === 0) {
                      handleKeyboardShoot();
                    }
                  }}
                  style={arrowPosition ? {
                    left: `${arrowPosition.x}px`,
                    top: `${arrowPosition.y}px`,
                    transform: `translate(-50%, -50%) rotate(${arrowPosition.angle}rad)`,
                  } : undefined}
                >
                  <svg viewBox="0 0 110 24" aria-hidden="true">
                    <path d="M4 12 H100 M4 12 L16 4 M4 12 L16 20 M88 12 L100 4 M88 12 L100 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M100 12 L86 5 L88 12 L86 19 Z" fill="currentColor" />
                  </svg>
                </button>
                <div className="heart-target" ref={heartTargetRef} aria-hidden="true">♥</div>
              </div>
              <p className="welcome-hint" role="status">{shotMessage}</p>
            </section>
          ) : (
            <div className="birthday-content" id="birthday-reveal">
              <section className="birthday-card" aria-labelledby="birthday-title">
                <div className="portrait-frame">
                  <img
                    className="birthday-photo"
                    src={featuredImage ? `/api/images/${encodeURIComponent(featuredImage.id)}` : '/birthday-girl-placeholder.svg'}
                    alt={featuredImage ? 'Birthday girl' : 'Placeholder for the birthday girl photo'}
                  />
                </div>
                <p className="eyebrow">Today is all about you</p>
                <h1 id="birthday-title">Happy Birthday, Chinju!</h1>
                <p className="birthday-message">Wishing you a day filled with love, laughter, and all the happiness you deserve.</p>
              </section>

              <details className="photo-update feature-panel">
                <summary>
                  <span>Image Gallery</span>
                  <span className="feature-summary-hint">Your favorite memories</span>
                </summary>
                <div className="photo-update-content">
                  <p>Add a favorite picture to the gallery. The first picture becomes the birthday portrait.</p>
                  <form onSubmit={handleUpload}>
                    <label className="file-picker">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        onChange={(event) => {
                          setSelectedFile(event.target.files?.[0] || null);
                          setUploadMessage('');
                          setUploadError('');
                        }}
                      />
                      <span>{selectedFile ? 'Choose a different photo' : 'Choose a photo'}</span>
                    </label>
                    {selectedFile && <p className="selected-file">{selectedFile.name}</p>}
                    <button
                      className="upload-submit"
                      type="submit"
                      disabled={!selectedFile || isUploading}
                    >
                      {isUploading ? 'Uploading…' : 'Save birthday photo'}
                    </button>
                  </form>
                  {uploadMessage && <p className="form-message success-message" role="status">{uploadMessage}</p>}
                  {uploadError && <p className="form-message error-message" role="alert">{uploadError}</p>}
                  {galleryError && <p className="form-message error-message" role="alert">{galleryError}</p>}
                  {isLoadingImages ? (
                    <p className="gallery-empty">Loading your memories…</p>
                  ) : images.length > 0 ? (
                    <div className="photo-grid">
                      {images.map((image) => (
                        <figure className="photo-card" key={image.id}>
                          <img
                            src={`/api/images/${encodeURIComponent(image.id)}`}
                            alt={image.filename}
                            loading="lazy"
                          />
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <p className="gallery-empty">Your gallery is waiting for its first memory.</p>
                  )}
                </div>
              </details>

              <details className="photo-update feature-panel love-letter">
                <summary>
                  <span>A Little Love Letter</span>
                  <span className="feature-summary-hint">Just for you, Chinju</span>
                </summary>
                <div className="love-letter-content">
                  <p className="love-letter-salutation">Dear Chinju,</p>
                  <p>
                    You make ordinary days feel special just by being you. I hope your birthday
                    brings you the same warmth, laughter, and happiness you share with everyone
                    around you.
                  </p>
                  <p>Keep smiling, keep shining, and always remember how loved you are.</p>
                  <p className="love-letter-signoff">With all my love ♥</p>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default App;

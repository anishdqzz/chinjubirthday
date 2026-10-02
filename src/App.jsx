import React, { useEffect, useMemo, useRef, useState } from 'react';

function createFloatingHearts() {
  return Array.from({ length: 18 }, (_, index) => ({
    id: index,
    style: {
      left: `${Math.random() * 100}%`,
      fontSize: `${14 + Math.random() * 24}px`,
      animationDelay: `${Math.random() * 12}s`,
      animationDuration: `${12 + Math.random() * 12}s`,
      '--heart-drift': `${-70 + Math.random() * 140}px`,
      opacity: 0.35 + Math.random() * 0.45,
    },
  }));
}

async function getErrorMessage(response) {
  const result = await response.json().catch(() => ({}));
  return result.error || `Request failed (${response.status})`;
}

function App() {
  const [isRevealed, setIsRevealed] = useState(false);
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
  const floatingHearts = useMemo(createFloatingHearts, []);
  const featuredImage = images[0];

  async function refreshImages() {
    const response = await fetch('/api/images');
    if (response.status === 401) {
      setIsAuthenticated(false);
      setIsRevealed(false);
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
      <div className="floating-hearts" aria-hidden="true">
        {floatingHearts.map(({ id, style }) => (
          <span className="floating-heart" key={id} style={style}>♥</span>
        ))}
      </div>

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
            <section className="welcome" aria-label="Birthday surprise">
              <p className="eyebrow">A little surprise for you</p>
              <button className="reveal-button" type="button" onClick={() => setIsRevealed(true)}>
                Click Me
              </button>
              <p className="welcome-hint">There is something special waiting</p>
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

              <details className="photo-update">
                <summary>Image Gallery</summary>
                <div className="photo-update-content">
                  <p>Upload one photo to make it the birthday picture. It will be saved to MongoDB Atlas.</p>
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
                </div>
              </details>

              {!isLoadingImages && images.length > 1 && (
                <section className="memories" aria-labelledby="memories-title">
                  <h2 id="memories-title">Birthday memories</h2>
                  <div className="photo-grid">
                    {images.slice(1).map((image) => (
                      <figure className="photo-card" key={image.id}>
                        <img
                          src={`/api/images/${encodeURIComponent(image.id)}`}
                          alt={image.filename}
                          loading="lazy"
                        />
                      </figure>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default App;

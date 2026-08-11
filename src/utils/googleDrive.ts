import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Authentication only (openid + email + profile) by default.
// Google API scopes are requested incrementally via googleSignIn(scope)
// only when the corresponding service action is actually performed.
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let grantedScopes = new Set<string>();

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (
  scope?: string
): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    if (scope && !grantedScopes.has(scope)) {
      provider.addScope(scope);
      provider.setCustomParameters({ prompt: 'consent', access_type: 'offline' });
    }
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    if (scope) grantedScopes.add(scope);
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const uploadFileToDrive = async (accessToken: string, fileBlob: Blob, filename: string) => {
  const metadata = {
    name: filename,
    mimeType: 'application/zip',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', fileBlob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload to Google Drive: ${await res.text()}`);
  }

  return await res.json();
};

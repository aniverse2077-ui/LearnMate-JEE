import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export function loadValidatedFirebaseConfig(): FirebaseEnvConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
  const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID as string | undefined;

  const missingKeys: string[] = [];
  if (!apiKey) missingKeys.push('VITE_FIREBASE_API_KEY');
  if (!authDomain) missingKeys.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!projectId) missingKeys.push('VITE_FIREBASE_PROJECT_ID');
  if (!storageBucket) missingKeys.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!messagingSenderId) missingKeys.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!appId) missingKeys.push('VITE_FIREBASE_APP_ID');

  if (missingKeys.length > 0) {
    console.warn(
      `[LearnMate JEE]: Missing Firebase environment variables (${missingKeys.join(
        ', '
      )}). Running in local-session fallback mode.`
    );
    return null;
  }

  return {
    apiKey: apiKey!,
    authDomain: authDomain!,
    projectId: projectId!,
    storageBucket: storageBucket!,
    messagingSenderId: messagingSenderId!,
    appId: appId!,
    firestoreDatabaseId:
      firestoreDatabaseId && firestoreDatabaseId !== '(default)'
        ? firestoreDatabaseId
        : undefined,
  };
}

const firebaseConfig = loadValidatedFirebaseConfig();
export const isFirebaseConfigured = Boolean(firebaseConfig);
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
export const db = app
  ? firebaseConfig?.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app)
  : (null as unknown as ReturnType<typeof getFirestore>);
export const auth = app
  ? getAuth(app)
  : ({ currentUser: null } as unknown as ReturnType<typeof getAuth>);

// Google Workspace Scopes configured via set_up_oauth
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
];

const basicGoogleProvider = new GoogleAuthProvider();
basicGoogleProvider.setCustomParameters({ prompt: 'select_account' });

const workspaceGoogleProvider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  workspaceGoogleProvider.addScope(scope);
}
workspaceGoogleProvider.setCustomParameters({ prompt: 'consent' });

// In-memory cache for the Google Workspace OAuth access token (never stored in localStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let fallbackUser: User | null = null;
const authListeners = new Set<(user: User | null) => void>();
const activeVoiceSockets = new Set<WebSocket>();

export function registerActiveVoiceSocket(ws: WebSocket) {
  activeVoiceSockets.add(ws);
  ws.addEventListener('close', () => {
    activeVoiceSockets.delete(ws);
  });
}

export function closeAllActiveVoiceSockets() {
  for (const ws of activeVoiceSockets) {
    try {
      ws.close();
    } catch {
      // ignore close errors
    }
  }
  activeVoiceSockets.clear();
}

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getWorkspaceAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getFirebaseIdToken = async (): Promise<string | null> => {
  if (isFirebaseConfigured && auth.currentUser && typeof auth.currentUser.getIdToken === 'function') {
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }
  if (fallbackUser?.uid) {
    return `local_token_${fallbackUser.uid}`;
  }
  return null;
};

export const getCurrentActiveUid = (): string => {
  return auth?.currentUser?.uid || fallbackUser?.uid || 'anonymous';
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  const notify = (user: User | null) => {
    const activeUser = user || fallbackUser;
    if (activeUser) {
      if (onAuthSuccess) onAuthSuccess(activeUser, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  };
  authListeners.add(notify);
  if (!isFirebaseConfigured) {
    queueMicrotask(() => notify(null));
    return () => {
      authListeners.delete(notify);
    };
  }
  const unsub = onAuthStateChanged(auth, (user: User | null) => {
    notify(user);
  });
  return () => {
    authListeners.delete(notify);
    unsub();
  };
};

export interface GoogleSignInOutcome {
  user: User | null;
  accessToken: string | null;
  token?: string | null;
  cancelled?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export const googleSignIn = async (
  includeWorkspaceScopes = false
): Promise<GoogleSignInOutcome> => {
  if (!isFirebaseConfigured) {
    return {
      user: null,
      accessToken: null,
      token: null,
      cancelled: false,
      errorCode: 'FIREBASE_NOT_CONFIGURED',
      errorMessage: 'Google Sign-In requires Firebase configuration. Please use email sign-in or configure Firebase.',
    };
  }
  try {
    isSigningIn = true;
    const provider = includeWorkspaceScopes ? workspaceGoogleProvider : basicGoogleProvider;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      token: cachedAccessToken,
      cancelled: false,
    };
  } catch (error: any) {
    const code = error?.code || '';
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/popup-blocked'
    ) {
      return {
        user: auth.currentUser,
        accessToken: cachedAccessToken,
        token: cachedAccessToken,
        cancelled: true,
        errorCode: code,
      };
    }
    return {
      user: null,
      accessToken: null,
      token: null,
      cancelled: false,
      errorCode: code,
      errorMessage: error?.message || 'Unable to complete Google Sign-In.',
    };
  } finally {
    isSigningIn = false;
  }
};

export const signInWithGoogleWorkspace = async (): Promise<GoogleSignInOutcome> => {
  return googleSignIn(true);
};

function createLocalAccountSession(name: string, email: string): User {
  const cleanEmail = email.trim().toLowerCase();
  const display = name.trim() || cleanEmail.split('@')[0] || 'Scholar';
  const uid =
    'local_' +
    Array.from(cleanEmail)
      .map((c) => c.charCodeAt(0).toString(16))
      .join('')
      .slice(0, 24);
  const pseudoUser = {
    uid,
    email: cleanEmail,
    displayName: display,
    emailVerified: true,
    isAnonymous: false,
    providerData: [{ providerId: 'password', email: cleanEmail }],
  } as unknown as User;
  fallbackUser = pseudoUser;
  authListeners.forEach((fn) => fn(pseudoUser));
  return pseudoUser;
}

export const emailSignUp = async (
  name: string,
  email: string,
  password: string
): Promise<User> => {
  if (!isFirebaseConfigured) {
    return createLocalAccountSession(name, email);
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    return cred.user;
  } catch (err: any) {
    const code = err?.code || '';
    if (
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found' ||
      code === 'auth/admin-restricted-operation'
    ) {
      return createLocalAccountSession(name, email);
    }
    throw err;
  }
};

export const emailSignIn = async (email: string, password: string): Promise<User> => {
  if (!isFirebaseConfigured) {
    return createLocalAccountSession(email.split('@')[0] || 'Scholar', email);
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err: any) {
    const code = err?.code || '';
    if (
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found' ||
      code === 'auth/admin-restricted-operation'
    ) {
      return createLocalAccountSession(email.split('@')[0] || 'Scholar', email);
    }
    throw err;
  }
};

/**
 * Purges all user-scoped localStorage keys (`learnmate_*`) so shared-device sign-outs
 * leave zero residual personal or study data on the machine.
 */
export function purgeUserLocalStorage(uid?: string) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (
      key.startsWith('learnmate_') ||
      (uid && key.includes(uid))
    ) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}

export const logoutUser = async (uid?: string) => {
  const activeUid = uid || auth?.currentUser?.uid || fallbackUser?.uid;
  closeAllActiveVoiceSockets();
  purgeUserLocalStorage(activeUid);
  fallbackUser = null;
  cachedAccessToken = null;
  if (isFirebaseConfigured && typeof auth.signOut === 'function') {
    try {
      await auth.signOut();
    } catch {
      // ignore signOut errors on local sessions
    }
  }
  authListeners.forEach((fn) => fn(null));
};

export const signOutUser = logoutUser;

// Mandatory connection check on boot
async function testConnection() {
  if (!isFirebaseConfigured || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Mandatory structured Firestore error handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

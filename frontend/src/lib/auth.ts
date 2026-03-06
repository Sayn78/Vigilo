import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const getUserPool = () =>
  new CognitoUserPool({
    UserPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
    ClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
  });

export async function signIn(email: string, password: string): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const user = new CognitoUser({ Username: email, Pool: pool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess: resolve,
      onFailure: reject,
      newPasswordRequired: () => reject(new Error('Password change required')),
    });
  });
}

export async function signOut(): Promise<void> {
  return new Promise((resolve) => {
    const pool = getUserPool();
    const user = pool.getCurrentUser();
    if (user) {
      user.signOut(() => resolve());
    } else {
      resolve();
    }
  });
}

export async function getSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve) => {
    const pool = getUserPool();
    const user = pool.getCurrentUser();
    if (!user) return resolve(null);

    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return resolve(null);
      resolve(session);
    });
  });
}

export async function getIdToken(): Promise<string | null> {
  const session = await getSession();
  return session?.getIdToken().getJwtToken() ?? null;
}

export function signUp(
  email: string,
  password: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    pool.signUp(email, password, [], [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pool = getUserPool();
    const user = new CognitoUser({ Username: email, Pool: pool });
    user.confirmRegistration(code, true, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

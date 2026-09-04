import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';

export type WebAuthnRegistrationOptions = PublicKeyCredentialCreationOptionsJSON & {
  challengeId: string;
};

export type WebAuthnLoginOptions = PublicKeyCredentialRequestOptionsJSON & {
  challengeId: string;
};

export interface WebAuthnRegistrationPayload {
  challengeId: string;
  response: RegistrationResponseJSON;
  deviceName: string;
  clientType: 'web';
}

export interface WebAuthnLoginPayload {
  challengeId: string;
  response: AuthenticationResponseJSON;
  clientType: 'web';
  deviceName: string;
}

export async function isPasskeySupported(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

export async function executePasskeyRegistration(
  options: WebAuthnRegistrationOptions,
  deviceName = 'Admin Workstation'
): Promise<WebAuthnRegistrationPayload> {
  const { challengeId, ...optionsJSON } = options;
  const response = await startRegistration({ optionsJSON });

  return {
    challengeId,
    response,
    deviceName,
    clientType: 'web',
  };
}

export async function executePasskeyLogin(
  options: WebAuthnLoginOptions
): Promise<WebAuthnLoginPayload> {
  const { challengeId, ...optionsJSON } = options;
  const response = await startAuthentication({ optionsJSON });

  return {
    challengeId,
    response,
    clientType: 'web',
    deviceName: navigator.userAgent.includes('Mac') ? 'macOS Safari / Touch ID' : 'Web Browser',
  };
}

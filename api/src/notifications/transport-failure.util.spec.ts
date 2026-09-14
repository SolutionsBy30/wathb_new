import { isNetworkError, isTransportFailure, isUnavailableStatus } from './transport-failure.util';

describe('isUnavailableStatus', () => {
  it('condemns the sender on a rejected key', () => {
    expect(isUnavailableStatus(401)).toBe(true);
    expect(isUnavailableStatus(403)).toBe(true);
  });

  it('condemns the sender on provider-side failure', () => {
    expect(isUnavailableStatus(500)).toBe(true);
    expect(isUnavailableStatus(502)).toBe(true);
    expect(isUnavailableStatus(503)).toBe(true);
    expect(isUnavailableStatus(408)).toBe(true);
  });

  it('treats a rate limit as the sender being spent', () => {
    // Wasender throttles the whole session, and the backup is a different
    // phone — moving across is the only thing that can still deliver.
    expect(isUnavailableStatus(429)).toBe(true);
  });

  it('leaves ordinary rejections with the message', () => {
    // 400/404/422 are this message's problem — a malformed number, say.
    // Retrying them on the backup would deliver the same rejection twice.
    expect(isUnavailableStatus(400)).toBe(false);
    expect(isUnavailableStatus(404)).toBe(false);
    expect(isUnavailableStatus(422)).toBe(false);
    expect(isUnavailableStatus(200)).toBe(false);
  });
});

describe('isTransportFailure', () => {
  it('recognises the wording Wasender actually sends when the phone drops', () => {
    expect(isTransportFailure('Your Whatsapp Session is not connected please connect your session first')).toBe(true);
  });

  it('recognises the other ways a dropped link is worded', () => {
    // The regression this file exists for: the old check required the word
    // "session" AND a disconnect word, so each of these fell through as an
    // ordinary error and the backup sender was never tried.
    for (const message of [
      'Device logged out',
      'WhatsApp session expired',
      'Session closed by the phone',
      'No active session for this account',
      'Please scan the QR code to reconnect',
      'Request not authenticated',
      'Invalid API key',
      'device not found',
    ]) {
      expect({ message, transport: isTransportFailure(message) }).toEqual({ message, transport: true });
    }
  });

  it('recognises failures that never reached the provider', () => {
    for (const message of ['fetch failed', 'connect ECONNREFUSED 10.0.0.1:443', 'getaddrinfo ENOTFOUND api.example', 'socket hang up']) {
      expect({ message, transport: isTransportFailure(message) }).toEqual({ message, transport: true });
    }
  });

  it('leaves a message-specific rejection alone', () => {
    expect(isTransportFailure('recipient number is not registered on WhatsApp')).toBe(false);
    expect(isTransportFailure('message body is too long')).toBe(false);
  });

  it('uses the status even when the wording is unhelpful', () => {
    expect(isTransportFailure('Wasender API error 503', 503)).toBe(true);
    expect(isTransportFailure('something went wrong', 500)).toBe(true);
    expect(isTransportFailure('something went wrong', 422)).toBe(false);
  });

  it('is false for an empty message with no status', () => {
    expect(isTransportFailure(undefined)).toBe(false);
    expect(isTransportFailure('')).toBe(false);
  });
});

describe('isNetworkError', () => {
  it('classifies a fetch rejection by its cause code', () => {
    const e = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    expect(isNetworkError(e)).toBe(true);
  });

  it('classifies a bare timeout', () => {
    expect(isNetworkError(new Error('The operation was aborted'))).toBe(true);
  });

  it('is false for an ordinary application error', () => {
    expect(isNetworkError(new Error('template not approved'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

import config from '../../../config/env';
import { BadRequestError } from '../../../utils/errors';

interface CJTokenResponse {
  code: number;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiryDate: string;
    refreshTokenExpiryDate?: string;
  };
}

interface CJRefreshResponse {
  code: number;
  message: string;
  data: {
    accessToken: string;
    refreshToken?: string;
    accessTokenExpiryDate: string;
    refreshTokenExpiryDate?: string;
  };
}

class CJAuthService {
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private tokenExpiry: number = 0;
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000;

  constructor() {
    if (config.cj.accessToken) {
      this.accessToken = config.cj.accessToken;
      this.refreshTokenValue = config.cj.refreshToken;
      this.tokenExpiry = Date.now() + 180 * 24 * 60 * 60 * 1000;
    }
  }

  private parseExpiryDate(dateString: string | undefined, fallbackMs: number): number {
    if (dateString) {
      const parsed = new Date(dateString).getTime();
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return Date.now() + fallbackMs;
  }

  private persistTokenUpdate(newAccessToken: string, newRefreshToken?: string) {
    this.accessToken = newAccessToken;

    if (newRefreshToken) {
      this.refreshTokenValue = newRefreshToken;
      config.cj.refreshToken = newRefreshToken;
      console.warn('[CJ] Refresh token updated. Persist the new CJ_REFRESH_TOKEN in your .env file.');
    }

    config.cj.accessToken = newAccessToken;
  }

  private async requestNewToken(): Promise<string> {
    if (!config.cj.apiKey) {
      throw new BadRequestError('CJ API key not configured');
    }

    const response = await fetch(`${config.cj.baseUrl}/authentication/getAccessToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: config.cj.apiKey,
      }),
    });

    const data = (await response.json()) as CJTokenResponse;

    if (data.code !== 200 || !data.data?.accessToken) {
      throw new BadRequestError(`CJ authentication failed: ${data.message || response.statusText}`);
    }

    this.persistTokenUpdate(data.data.accessToken, data.data.refreshToken);
    this.tokenExpiry = this.parseExpiryDate(data.data.accessTokenExpiryDate, 180 * 24 * 60 * 60 * 1000);

    return this.accessToken!;
  }

  private async refreshToken(): Promise<string> {
    if (!this.refreshTokenValue) {
      return this.requestNewToken();
    }

    const response = await fetch(`${config.cj.baseUrl}/authentication/refreshAccessToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: this.refreshTokenValue,
      }),
    });

    const data = (await response.json()) as CJRefreshResponse;

    if (data.code !== 200 || !data.data?.accessToken) {
      if (data.code === 1600003 || data.message?.includes('Refresh token')) {
        console.warn('[CJ] Refresh token expired or invalid. Reauthorization required.');
        throw new BadRequestError('CJ authentication failed: Refresh token expired. Reauthorization required.');
      }
      console.warn('[CJ] Token refresh failed, requesting new token:', data.message);
      return this.requestNewToken();
    }

    this.persistTokenUpdate(data.data.accessToken, data.data.refreshToken);
    this.tokenExpiry = this.parseExpiryDate(data.data.accessTokenExpiryDate, 180 * 24 * 60 * 60 * 1000);

    return this.accessToken!;
  }

  async getAccessToken(): Promise<string> {
    if (!this.accessToken) {
      return this.requestNewToken();
    }

    if (Date.now() >= this.tokenExpiry - this.REFRESH_BUFFER_MS) {
      return this.refreshToken();
    }

    return this.accessToken;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      'Content-Type': 'application/json',
      'CJ-Access-Token': token,
    };
  }
}

export default new CJAuthService();

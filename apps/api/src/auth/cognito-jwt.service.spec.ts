import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigurationReader } from '../config/runtime-config';
import { CognitoJwtService } from './cognito-jwt.service';

describe('CognitoJwtService authentication mode', () => {
  it('does not call Cognito or create a fake identity in disabled test mode', async () => {
    const configuration: ConfigurationReader = {
      get(key: string): unknown {
        const values: Record<string, string> = {
          NODE_ENV: 'test',
          AUTH_MODE: 'disabled',
        };
        return values[key];
      },
    };
    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = new CognitoJwtService(configuration);

    await expect(service.verifyToken('not-a-token')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects production startup when authentication is disabled', () => {
    const configuration: ConfigurationReader = {
      get(key: string): unknown {
        const values: Record<string, string> = {
          NODE_ENV: 'production',
          AUTH_MODE: 'disabled',
        };
        return values[key];
      },
    };

    expect(() => new CognitoJwtService(configuration)).toThrow('AUTH_MODE=disabled is permitted only');
  });
});

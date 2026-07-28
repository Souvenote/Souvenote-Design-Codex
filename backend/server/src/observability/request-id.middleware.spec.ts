import type { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  RequestIdMiddleware,
  type RequestWithRequestId,
  selectRequestId,
} from './request-id.middleware';

describe('request ID handling', () => {
  it('normalizes a valid caller-provided UUID', () => {
    expect(
      selectRequestId(
        '018F8B9E-7F27-7DC3-951B-F53E4FA78E3D',
        () => 'generated',
      ),
    ).toBe('018f8b9e-7f27-7dc3-951b-f53e4fa78e3d');
  });

  it.each([
    'not-a-uuid',
    '018f8b9e-7f27-7dc3-751b-f53e4fa78e3d',
    '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d\nforged-log-line',
  ])('replaces an unsafe caller value %s', (value) => {
    expect(selectRequestId(value, () => 'generated')).toBe('generated');
  });

  it('rejects ambiguous repeated request ID headers', () => {
    expect(
      selectRequestId(
        [
          '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
          '018f8b9e-7f27-7dc3-951b-f53e4fa78e3e',
        ],
        () => 'generated',
      ),
    ).toBe('generated');
  });

  it('attaches and returns the selected ID before continuing', () => {
    const request = {
      headers: {
        'x-request-id': '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
      },
    } as unknown as Request;
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    new RequestIdMiddleware().use(request, response, next);

    expect((request as RequestWithRequestId).requestId).toBe(
      '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
    );
    expect(setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});

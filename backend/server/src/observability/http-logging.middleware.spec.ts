import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import {
  HttpLoggingMiddleware,
  safeRouteTemplate,
} from './http-logging.middleware';
import type { RequestWithRequestId } from './request-id.middleware';

function responseEvents(statusCode: number) {
  const events = new EventEmitter();
  return {
    events,
    response: {
      statusCode,
      writableEnded: false,
      once: (eventName: string, listener: () => void) => {
        events.once(eventName, listener);
      },
    } as unknown as Response,
  };
}

describe('HttpLoggingMiddleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs only a route template and PII-safe request metadata', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const request = {
      requestId: '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
      method: 'POST',
      route: { path: '/api/orders/:orderId' },
      originalUrl: '/api/orders/private-order?email=private@example.com',
      headers: { authorization: 'Bearer private-token' },
      body: { insideMessage: 'private card message' },
    } as unknown as RequestWithRequestId;
    const { events, response } = responseEvents(201);
    const next = jest.fn() as NextFunction;

    new HttpLoggingMiddleware().use(request, response, next);
    events.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatchObject({
      event: 'http_request_completed',
      requestId: request.requestId,
      method: 'POST',
      route: '/api/orders/:orderId',
      statusCode: 201,
    });
    expect(JSON.stringify(log.mock.calls[0][0])).not.toMatch(
      /private|authorization|insideMessage|email/i,
    );
  });

  it('records guard and handler failures from their final status only', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const request = {
      requestId: '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
      method: 'GET',
      route: { path: '/api/card-drafts' },
      headers: { authorization: 'private bearer token' },
    } as unknown as RequestWithRequestId;
    const { events, response } = responseEvents(401);

    new HttpLoggingMiddleware().use(
      request,
      response,
      jest.fn() as NextFunction,
    );
    events.emit('finish');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatchObject({
      event: 'http_request_failed',
      route: '/api/card-drafts',
      statusCode: 401,
    });
    expect(JSON.stringify(warn.mock.calls[0][0])).not.toContain('private');
  });

  it('records unexpected failures as safe server errors', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const request = {
      requestId: '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
      method: 'GET',
      route: { path: '/api/orders/:orderId' },
    } as unknown as RequestWithRequestId;
    const { events, response } = responseEvents(500);

    new HttpLoggingMiddleware().use(
      request,
      response,
      jest.fn() as NextFunction,
    );
    events.emit('finish');

    expect(error.mock.calls[0][0]).toMatchObject({
      event: 'http_request_failed',
      statusCode: 500,
    });
  });

  it('records an interrupted connection once without a request URL', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const request = {
      requestId: '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
      method: 'POST',
      route: { path: '/api/checkout' },
      originalUrl: '/api/checkout?secret=value',
    } as unknown as RequestWithRequestId;
    const { events, response } = responseEvents(200);

    new HttpLoggingMiddleware().use(
      request,
      response,
      jest.fn() as NextFunction,
    );
    events.emit('close');
    events.emit('finish');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatchObject({
      event: 'http_request_aborted',
      route: '/api/checkout',
      statusCode: 499,
    });
    expect(JSON.stringify(warn.mock.calls[0][0])).not.toContain('secret');
  });

  it('does not emit completion noise for successful health probes', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const request = {
      requestId: '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
      method: 'GET',
      route: { path: '/api/health/ready' },
    } as unknown as RequestWithRequestId;
    const { events, response } = responseEvents(200);

    new HttpLoggingMiddleware().use(
      request,
      response,
      jest.fn() as NextFunction,
    );
    events.emit('finish');

    expect(log).not.toHaveBeenCalled();
  });

  it('uses a safe placeholder when no route template exists', () => {
    expect(
      safeRouteTemplate({
        originalUrl: '/api/orders/private-order',
      } as Request),
    ).toBe('unmatched');
  });
});

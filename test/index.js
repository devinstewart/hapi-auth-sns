'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Nock = require('nock');
const Hapi = require('@hapi/hapi');

const Sns = require('..');
const Mock = require('./mock');

const { describe, it, beforeEach } = exports.lab = Lab.script();
const expect = Code.expect;

const setupCertNock = () => {

    Nock(Mock.SigningCertHost)
        .get(Mock.SigningCertPath)
        .reply(200, Mock.pem);
};

const setupSubscribeNock = () => {

    Nock(Mock.SubscribeHost)
        .get(Mock.SubscribePath)
        .query(Mock.SubscribeParams)
        .reply(200, { success: true });
};

const setupSubscribeNockFailure = () => {

    Nock(Mock.SubscribeHost)
        .get(Mock.SubscribePath)
        .query(Mock.SubscribeParams)
        .replyWithError('something went wrong');
};

const successHandler = () => {

    return { success: true };
};

describe('Plugin', () => {

    beforeEach(() => setupCertNock());

    it('returns 200 on valid payload', async () => {

        const server = Hapi.server();
        await server.register(Sns);
        server.auth.strategy('sns', 'sns', { autoSubscribe: false, autoResubscribe: false });

        server.auth.default('sns');
        server.route({ path: '/', method: 'POST', handler: (request) => request.auth.credentials.sns });

        const res = await server.inject({ method: 'POST', url: '/', payload: Mock.validNotification });
        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal(true);
    });

    it('subscribes to topic on subscription confirmation', async () => {

        setupSubscribeNock();

        const server = Hapi.server();
        await server.register(Sns);
        server.auth.strategy('sns', 'sns');

        server.auth.default('sns');
        server.route({ path: '/', method: 'POST', handler: successHandler });

        const res = await server.inject({ method: 'POST', url: '/', payload: Mock.validSubscriptionConfirmation });
        expect(res.statusCode).to.equal(200);
    });

    it('resubscribes to topic on unsubscription confirmation', async () => {

        setupSubscribeNock();

        const server = Hapi.server();
        await server.register(Sns);
        server.auth.strategy('sns', 'sns');

        server.auth.default('sns');
        server.route({ path: '/', method: 'POST', handler: successHandler });

        const res = await server.inject({ method: 'POST', url: '/', payload: Mock.validUnsubscribeConfirmation });
        expect(res.statusCode).to.equal(200);

    });

    it('does not subscribe to topic on subscription confirmation if autoSubscribe is false', async () => {

        const server = Hapi.server();
        await server.register(Sns);
        server.auth.strategy('sns', 'sns', { autoSubscribe: false });

        server.auth.default('sns');
        server.route({ path: '/', method: 'POST', handler: successHandler });

        const res = await server.inject({ method: 'POST', url: '/', payload: Mock.validSubscriptionConfirmation });
        expect(res.statusCode).to.equal(200);

    });

    it('does not resubscribe to topic on unsubscription confirmation if autoResubscribe is false', async () => {

        const server = Hapi.server();
        await server.register(Sns);
        server.auth.strategy('sns', 'sns', { autoResubscribe: false });

        server.auth.default('sns');
        server.route({ path: '/', method: 'POST', handler: successHandler });

        const res = await server.inject({ method: 'POST', url: '/', payload: Mock.validUnsubscribeConfirmation });
        expect(res.statusCode).to.equal(200);
    });

    it('returns 200 when scope is set to topic name', async () => {

        const server = Hapi.server();
        await server.register(Sns);
        server.auth.strategy('sns', 'sns');

        server.auth.default('sns');
        server.route({ path: '/', method: 'POST', handler: successHandler, options: { auth: { scope: 'test' } } });

        const res = await server.inject({ method: 'POST', url: '/', payload: Mock.validNotification });
        expect(res.statusCode).to.equal(200);
    });

    it('returns 403 when scope does not match topic name', async () => {

        const server = Hapi.server();
        await server.register(Sns);
        server.auth.strategy('sns', 'sns');

        server.auth.default('sns');
        server.route({ path: '/', method: 'POST', handler: successHandler, config: { auth: { scope: 'wrongScope' } } });

        const res = await server.inject({ method: 'POST', url: '/', payload: Mock.validNotification });
        expect(res.statusCode).to.equal(403);
        expect(res.result.message).to.equal('Insufficient scope');
    });

    it('returns 401 on an invalid SNS payload', async () => {

        const server = Hapi.server();
        await server.register(Sns);
        server.auth.strategy('sns', 'sns');

        server.auth.default('sns');
        server.route({ path: '/', method: 'POST', handler: successHandler });

        const res = await server.inject({ url: '/', method: 'POST', payload: { Message: 'invalid' } });
        expect(res.statusCode).to.equal(401);
        expect(res.result.message).to.equal('Invalid SNS payload');
    });

    it('returns 400 if subcription confirmation fails', async () => {

        setupSubscribeNockFailure();

        const server = Hapi.server();
        await server.register(Sns);
        server.auth.strategy('sns', 'sns');

        server.auth.default('sns');
        server.route({ path: '/', method: 'POST', handler: successHandler });

        const res = await server.inject({ method: 'POST', url: '/', payload: Mock.validSubscriptionConfirmation });
        expect(res.statusCode).to.equal(400);
        expect(res.result.message).to.equal('Failed to subscribe to topic');
    });

    it('throws an error when an invalid option is set on the strategy', async () => {

        try {
            const server = Hapi.server();
            await server.register(Sns);
            server.auth.strategy('sns', 'sns', { badOption: true });
        }
        catch (err) {
            expect(err.message).to.equal('"badOption" is not allowed');
        }
    });

    it('throws an error when an autoSubscribe is not boolean', async () => {

        try {
            const server = Hapi.server();
            await server.register(Sns);
            server.auth.strategy('sns', 'sns', { autoSubscribe: 'dog' });
        }
        catch (err) {
            expect(err.message).to.equal('"autoSubscribe" must be a boolean');
        }
    });

    it('throws an error when an autoResubscribe is not boolean', async () => {

        try {
            const server = Hapi.server();
            await server.register(Sns);
            server.auth.strategy('sns', 'sns', { autoResubscribe: null });
        }
        catch (err) {
            expect(err.message).to.equal('"autoResubscribe" must be a boolean');
        }
    });

});

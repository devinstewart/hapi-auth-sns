'use strict';

const Boom = require('@hapi/boom');
const Validator = require('sns-payload-validator');
const Hoek = require('@hapi/hoek');
const Joi = require('joi');
const Https = require('https');

const internals = {};

exports.plugin = {
    pkg: require('../package.json'),
    requirements: {
        hapi: '>=20.0.0'
    },

    register: (server, _options) => {

        server.auth.scheme('sns', internals.implementation);
    }
};

internals.schema = {
    strategy: Joi.object({
        autoSubscribe: Joi.boolean().default(true),
        autoResubscribe: Joi.boolean().default(true),
        useCache: Joi.boolean().default(true),
        maxCerts: Joi.number().integer().min(1).default(5000)
    })
};

internals.subscribe = (url) => {

    return new Promise((resolve, reject) => {

        Https.get(url, (res) => {

            let data = '';
            res.on('data', (d) => {

                data += d;
            });
            res.on('end', () => {

                resolve(data);
            });
        }).on('error', (err) => {

            reject(err);
        });
    });
};

internals.implementation = (_server, options) => {

    const settings = Joi.attempt(Hoek.clone(options), internals.schema.strategy);

    return {
        authenticate: (_request, h) => {

            return h.authenticated({ credentials: { sns: true } });
        },
        payload: async (request, h) => {

            try {
                const validator = new Validator({ useCache: settings.useCache, maxCerts: settings.maxCerts });
                const snsPayload = await validator.validate(request.payload);
                const topicName = snsPayload.TopicArn.split(':').pop();
                request.auth.credentials.scope = topicName;

                if ((settings.autoSubscribe && snsPayload.Type === 'SubscriptionConfirmation') ||
                    (settings.autoResubscribe && snsPayload.Type === 'UnsubscribeConfirmation')) {
                    try {
                        await internals.subscribe(snsPayload.SubscribeURL);
                        return h.continue;
                    }
                    catch {
                        return Boom.badRequest('Failed to subscribe to topic');
                    }

                }
                else {
                    return h.continue;
                }
            }
            catch (err) {
                return Boom.unauthorized('Invalid SNS payload');
            }
        },
        options: {
            payload: true
        }
    };
};

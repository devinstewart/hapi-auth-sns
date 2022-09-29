'use strict';

const Forge = require('node-forge');
const Crypto = require('crypto');

// Create mock certificate
const pair = Forge.pki.rsa.generateKeyPair(2048);
const now = new Date();
const cert = Forge.pki.createCertificate();
cert.publicKey = pair.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = now;
cert.validity.notAfter = now;
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
cert.setSubject([{ name: 'commonName', value: 'http://example.com' }]);
cert.sign(pair.privateKey);
const privateKeyPem = Forge.pki.privateKeyToPem(pair.privateKey);

const internals = {};

internals.getKeys = (type) => {

    if (type === 'SubscriptionConfirmation' || type === 'UnsubscribeConfirmation') {
        return ['Message', 'MessageId', 'SubscribeURL', 'SubscribeUrl', 'Timestamp', 'Token', 'TopicArn', 'Type'];
    }
    else if (type === 'Notification') {
        return ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'];
    }

    throw new Error('Invalid Type');

};

internals.addSignature = (payload, signatureVersion = '1') => {

    const sign = signatureVersion === '1' ? Crypto.createSign('sha1WithRSAEncryption') : Crypto.createSign('sha256WithRSAEncryption');
    const keys = internals.getKeys(payload.Type);
    for (const key of keys) {
        if (key in payload) {
            sign.write(`${key}\n${payload[key]}\n`);
        }
    }

    sign.end();

    payload.Signature = sign.sign(privateKeyPem, 'base64');

    return payload;
};

internals.MessageId = 'edeb3e00-ad32-5092-abe9-67ad99b82fdc';
internals.TopicArn = 'arn:aws:sns:us-east-1:012345678910:test';
internals.SigningCertHost = 'https://sns.us-east-1.amazonaws.com';
internals.SigningCertPath = '/SimpleNotificationService-0123456789abcdef0123456789abcdef.pem';
internals.SigningCertURL = internals.SigningCertHost + internals.SigningCertPath;
internals.SubscribeHost = 'https://sns.us-east-1.amazonaws.com';
internals.SubscribePath = '/';
internals.SubscribeParams = { Action: 'ConfirmSubscription', MoreStuff: 'MoreStuff' };
internals.SubscribeURL = internals.SubscribeHost + internals.SubscribePath + '?Action' + '=' + internals.SubscribeParams.Action + '&MoreStuff' + '=' + internals.SubscribeParams.MoreStuff;

internals.validNotificationSigV1 = {
    Type: 'Notification',
    MessageId: internals.MessageId,
    TopicArn: internals.TopicArn,
    Subject: 'Regarding SNS',
    Message: 'Hello SNS!',
    Timestamp: (new Date()).toISOString(),
    SignatureVersion: '1',
    SigningCertURL: internals.SigningCertURL
};

internals.validNotificationSigV2 = {
    Type: 'Notification',
    MessageId: internals.MessageId,
    TopicArn: internals.TopicArn,
    Subject: 'Regarding SNS',
    Message: 'Hello SNS!',
    Timestamp: (new Date()).toISOString(),
    SignatureVersion: '2',
    SigningCertURL: internals.SigningCertURL
};

internals.validSubscriptionConfirmation = {
    Type: 'SubscriptionConfirmation',
    MessageId: internals.MessageId,
    Token: '0123456789abcdef',
    TopicArn: internals.TopicArn,
    Message: 'You have chosen to subscribe to the topic...',
    SubscribeURL: internals.SubscribeURL,
    Timestamp: (new Date()).toISOString(),
    SignatureVersion: '1',
    SigningCertURL: internals.SigningCertURL
};

internals.validUnsubscribeConfirmation = {
    Type: 'UnsubscribeConfirmation',
    MessageId: internals.MessageId,
    Token: '0123456789abcdef',
    TopicArn: internals.TopicArn,
    Message: 'You have chosen to deactivate subscription...',
    SubscribeURL: internals.SubscribeURL,
    Timestamp: (new Date()).toISOString(),
    SignatureVersion: '1',
    SigningCertURL: internals.SigningCertURL
};

internals.Mock = class {

    pem = Forge.pki.certificateToPem(cert);
    SigningCertHost = internals.SigningCertHost;
    SigningCertPath = internals.SigningCertPath;
    SubscribeHost = internals.SubscribeHost;
    SubscribeParams = internals.SubscribeParams;
    SubscribePath = internals.SubscribePath;
    validNotificationSigV1 = internals.addSignature(internals.validNotificationSigV1);
    validNotificationSigV2 = internals.addSignature(internals.validNotificationSigV2, '2');
    validSubscriptionConfirmation = internals.addSignature(internals.validSubscriptionConfirmation);
    validUnsubscribeConfirmation = internals.addSignature(internals.validUnsubscribeConfirmation);
};

module.exports = new internals.Mock();
